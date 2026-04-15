import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
} from 'd3-force';
import type { Simulation, SimulationLinkDatum, SimulationNodeDatum } from 'd3-force';
import { select } from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';
import type { ZoomBehavior, ZoomTransform } from 'd3-zoom';
import { drag } from 'd3-drag';
import type { D3DragEvent } from 'd3-drag';
import type { Edge, Node, NodeId } from '../../types';
import { PHYSICS, edgeWidth, nodeRadius } from './physics';

export interface GraphNode extends SimulationNodeDatum {
  id: NodeId;
  ref: Node;
  radius: number;
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  id: string;
  ref: Edge;
  source: GraphNode | NodeId;
  target: GraphNode | NodeId;
}

interface ForceGraphOptions {
  onNodeClick?: (id: NodeId) => void;
  onNodeHover?: (id: NodeId | null, pos: { x: number; y: number } | null) => void;
  onBackgroundClick?: () => void;
}

interface PulseOptions {
  durationMs?: number;
  intensity?: number;
}

const ATTR_NODE_ID = 'data-node-id';
const ATTR_LINK_ID = 'data-link-id';

/**
 * Plain D3 class that owns the force simulation, node/edge attribute writes,
 * zoom, and drag. React owns the <svg> shell and calls `update()` when data
 * changes and `dispose()` on unmount.
 *
 * Non-negotiable rules:
 * - React never renders simulation children from JSX.
 * - setState is never called in the tick handler.
 * - `dispose()` must stop the simulation and detach listeners.
 */
export class ForceGraph {
  private readonly rootGroup: SVGGElement;
  private readonly linksGroup: SVGGElement;
  private readonly nodesGroup: SVGGElement;
  private readonly zoomBg: SVGRectElement;
  private simulation: Simulation<GraphNode, GraphLink> | null = null;
  private nodes: GraphNode[] = [];
  private links: GraphLink[] = [];
  private zoomBehavior: ZoomBehavior<SVGRectElement, unknown>;
  private currentTransform: ZoomTransform = zoomIdentity;
  private readonly opts: ForceGraphOptions;
  private resizeObserver: ResizeObserver | null = null;
  private viewBoxWidth = 1200;
  private viewBoxHeight = 720;
  private visibilityHandler: (() => void) | null = null;
  private disposed = false;

  constructor(svg: SVGSVGElement, opts: ForceGraphOptions = {}) {
    this.opts = opts;
    this.rootGroup = svg.querySelector('.graph-root') as SVGGElement;
    this.linksGroup = svg.querySelector('.graph-links') as SVGGElement;
    this.nodesGroup = svg.querySelector('.graph-nodes') as SVGGElement;
    this.zoomBg = svg.querySelector('.graph-zoombg') as SVGRectElement;
    if (!this.rootGroup || !this.linksGroup || !this.nodesGroup || !this.zoomBg) {
      throw new Error('ForceGraph: missing required <g>/<rect> elements in SVG shell');
    }

    this.zoomBehavior = zoom<SVGRectElement, unknown>()
      .scaleExtent([PHYSICS.zoom.min, PHYSICS.zoom.max])
      .filter((event: Event) => {
        // Don't steal clicks on nodes or edges
        const target = event.target as Element | null;
        if (target && (target.closest('.gnode') || target.closest('.glink'))) return false;
        return !(event as MouseEvent).button;
      })
      .on('zoom', (event) => {
        this.currentTransform = event.transform;
        select(this.rootGroup).attr('transform', event.transform.toString());
      });

    select(this.zoomBg)
      .call(this.zoomBehavior)
      .on('click', () => this.opts.onBackgroundClick?.());

    // Responsive viewBox — keep fixed to avoid simulation jiggle when panel resizes
    const bbox = svg.getBoundingClientRect();
    this.viewBoxWidth = Math.max(800, bbox.width || 1200);
    this.viewBoxHeight = Math.max(500, bbox.height || 720);
    svg.setAttribute('viewBox', `0 0 ${this.viewBoxWidth} ${this.viewBoxHeight}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    this.zoomBg.setAttribute('x', '-2000');
    this.zoomBg.setAttribute('y', '-2000');
    this.zoomBg.setAttribute('width', String(this.viewBoxWidth + 4000));
    this.zoomBg.setAttribute('height', String(this.viewBoxHeight + 4000));

    this.resizeObserver = new ResizeObserver(() => {
      const b = svg.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) return;
      // We keep the viewBox stable; only adjust the zoomBg so it always covers the visible area
    });
    this.resizeObserver.observe(svg);

    this.visibilityHandler = () => {
      if (!this.simulation) return;
      if (document.hidden) {
        this.simulation.stop();
      } else {
        this.simulation.alphaTarget(0.1).restart();
        setTimeout(() => this.simulation?.alphaTarget(0), 600);
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  /** Initial population of nodes/edges. Safe to call once. */
  init(nodes: Node[], edges: Edge[]): void {
    if (this.disposed) return;
    this.nodes = nodes.map((n) => toGraphNode(n, this.viewBoxWidth, this.viewBoxHeight));
    this.links = edges
      .filter((e) => this.nodes.find((n) => n.id === e.source) && this.nodes.find((n) => n.id === e.target))
      .map((e) => ({ id: e.id, ref: e, source: e.source, target: e.target }));

    this.simulation = forceSimulation<GraphNode>(this.nodes)
      .force(
        'link',
        forceLink<GraphNode, GraphLink>(this.links)
          .id((d) => d.id)
          .distance(PHYSICS.link.distance)
          .strength(PHYSICS.link.strength),
      )
      .force('charge', forceManyBody<GraphNode>().strength(PHYSICS.charge.strength).distanceMax(PHYSICS.charge.distanceMax))
      .force('center', forceCenter<GraphNode>(this.viewBoxWidth / 2, this.viewBoxHeight / 2).strength(PHYSICS.center.strength))
      .force('collide', forceCollide<GraphNode>().radius((d) => d.radius + PHYSICS.collide.padding))
      .alphaDecay(PHYSICS.sim.alphaDecay)
      .velocityDecay(PHYSICS.sim.velocityDecay)
      .alphaMin(PHYSICS.sim.alphaMin);

    // Pre-tick so first paint is already settled
    for (let i = 0; i < PHYSICS.sim.preTicks; i++) this.simulation.tick();

    this.renderStructure();
    this.bindInteractions();
    this.simulation.on('tick', () => this.applyPositions());
    this.applyPositions();
  }

  /** Called when the underlying data (nodes or edges) changes. */
  update(nodes: Node[], edges: Edge[]): void {
    if (this.disposed) return;
    if (!this.simulation) {
      this.init(nodes, edges);
      return;
    }
    // Merge node state — preserve existing positions for unchanged ids
    const existing = new Map(this.nodes.map((n) => [n.id, n]));
    this.nodes = nodes.map((n) => {
      const prev = existing.get(n.id);
      if (prev) {
        prev.ref = n;
        prev.radius = nodeRadius(n.throughput);
        return prev;
      }
      return toGraphNode(n, this.viewBoxWidth, this.viewBoxHeight);
    });
    const idSet = new Set(this.nodes.map((n) => n.id));
    this.links = edges
      .filter((e) => idSet.has(e.source) && idSet.has(e.target))
      .map((e) => ({ id: e.id, ref: e, source: e.source, target: e.target }));
    this.simulation.nodes(this.nodes);
    const linkForce = this.simulation.force<ReturnType<typeof forceLink<GraphNode, GraphLink>>>('link');
    linkForce?.links(this.links);
    this.simulation.alpha(0.2).restart();
    this.renderStructure();
    this.bindInteractions();
  }

  /** Pulse a single node — brief scale + glow intensity ramp. Used on message:new. */
  pulseNode(id: NodeId, opts: PulseOptions = {}): void {
    if (this.disposed) return;
    const duration = opts.durationMs ?? 900;
    const intensity = opts.intensity ?? 1;
    const node = this.nodesGroup.querySelector<SVGGElement>(`[${ATTR_NODE_ID}="${CSS.escape(id)}"]`);
    if (!node) return;
    const glow = node.querySelector<SVGCircleElement>('.gnode-glow');
    const circle = node.querySelector<SVGCircleElement>('.gnode-body');
    if (!glow || !circle) return;

    // Cancel any in-flight animations on this node to keep motion finite
    glow.getAnimations().forEach((a) => a.cancel());
    circle.getAnimations().forEach((a) => a.cancel());

    glow.animate(
      [
        { transform: 'scale(1)', opacity: Number(glow.getAttribute('data-base-opacity') ?? '0.5') },
        { transform: `scale(${1 + 0.6 * intensity})`, opacity: 0.9 },
        { transform: 'scale(1)', opacity: Number(glow.getAttribute('data-base-opacity') ?? '0.5') },
      ],
      { duration, easing: 'cubic-bezier(.22,.61,.36,1)' },
    );
    circle.animate(
      [{ transform: 'scale(1)' }, { transform: `scale(${1 + 0.18 * intensity})` }, { transform: 'scale(1)' }],
      { duration, easing: 'cubic-bezier(.22,.61,.36,1)' },
    );
  }

  /** Animate a signal line along an edge (hop path). */
  pulseEdge(sourceId: NodeId, targetId: NodeId, opts: PulseOptions = {}): void {
    if (this.disposed) return;
    const duration = opts.durationMs ?? 800;
    const link = this.linksGroup.querySelector<SVGLineElement>(
      `[${ATTR_LINK_ID}-source="${CSS.escape(sourceId)}"][${ATTR_LINK_ID}-target="${CSS.escape(targetId)}"], ` +
        `[${ATTR_LINK_ID}-source="${CSS.escape(targetId)}"][${ATTR_LINK_ID}-target="${CSS.escape(sourceId)}"]`,
    );
    if (!link) return;
    const length = link.getTotalLength?.() ?? 200;
    // Compose an overlay ping — clone as a new line that draws along the path
    const ns = 'http://www.w3.org/2000/svg';
    const ping = document.createElementNS(ns, 'line');
    ping.setAttribute('x1', link.getAttribute('x1') ?? '0');
    ping.setAttribute('y1', link.getAttribute('y1') ?? '0');
    ping.setAttribute('x2', link.getAttribute('x2') ?? '0');
    ping.setAttribute('y2', link.getAttribute('y2') ?? '0');
    ping.setAttribute('stroke', 'var(--accent-bright)');
    ping.setAttribute('stroke-width', '2.2');
    ping.setAttribute('stroke-linecap', 'round');
    ping.setAttribute('stroke-dasharray', `6 ${length}`);
    ping.setAttribute('stroke-dashoffset', String(length));
    ping.setAttribute('opacity', '0.95');
    ping.style.filter = 'drop-shadow(0 0 4px rgba(125, 211, 252, 0.9))';
    this.linksGroup.appendChild(ping);
    const anim = ping.animate([{ strokeDashoffset: length }, { strokeDashoffset: -length }], {
      duration,
      easing: 'cubic-bezier(.35,.0,.35,1)',
    });
    anim.onfinish = () => ping.remove();
  }

  /** Trigger a pulse along every hop in a path (sequentially staged). */
  pulsePath(path: NodeId[], opts: PulseOptions = {}): void {
    if (path.length < 2) return;
    const step = opts.durationMs ? opts.durationMs / path.length : 180;
    for (let i = 0; i < path.length - 1; i++) {
      const src = path[i];
      const dst = path[i + 1];
      if (!src || !dst) continue;
      setTimeout(() => this.pulseEdge(src, dst, { durationMs: (opts.durationMs ?? 800) / 2 }), i * step);
    }
    const first = path[0];
    const last = path[path.length - 1];
    if (first) this.pulseNode(first, { durationMs: 700, intensity: 0.7 });
    if (last) setTimeout(() => this.pulseNode(last, { durationMs: 900, intensity: 1 }), step * (path.length - 1));
  }

  highlightPath(path: NodeId[] | null): void {
    const links = this.linksGroup.querySelectorAll<SVGLineElement>('.glink');
    const nodes = this.nodesGroup.querySelectorAll<SVGGElement>('.gnode');
    if (!path || path.length < 2) {
      links.forEach((l) => l.classList.remove('highlighted', 'muted'));
      nodes.forEach((n) => n.classList.remove('highlighted', 'muted'));
      return;
    }
    const pathSet = new Set(path);
    const edgePairs = new Set<string>();
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      if (a && b) {
        edgePairs.add(`${a}|${b}`);
        edgePairs.add(`${b}|${a}`);
      }
    }
    links.forEach((l) => {
      const s = l.getAttribute(`${ATTR_LINK_ID}-source`) ?? '';
      const t = l.getAttribute(`${ATTR_LINK_ID}-target`) ?? '';
      const pair = `${s}|${t}`;
      if (edgePairs.has(pair)) {
        l.classList.add('highlighted');
        l.classList.remove('muted');
      } else {
        l.classList.remove('highlighted');
        l.classList.add('muted');
      }
    });
    nodes.forEach((n) => {
      const id = n.getAttribute(ATTR_NODE_ID) ?? '';
      if (pathSet.has(id)) {
        n.classList.add('highlighted');
        n.classList.remove('muted');
      } else {
        n.classList.remove('highlighted');
        n.classList.add('muted');
      }
    });
  }

  resetView(): void {
    select(this.zoomBg).call(this.zoomBehavior.transform, zoomIdentity);
  }

  zoomBy(factor: number): void {
    select(this.zoomBg).call(this.zoomBehavior.scaleBy, factor);
  }

  /** Snap viewport so a specific node is centered. */
  centerOn(id: NodeId): void {
    const node = this.nodes.find((n) => n.id === id);
    if (!node || node.x == null || node.y == null) return;
    const tx = this.viewBoxWidth / 2 - node.x * this.currentTransform.k;
    const ty = this.viewBoxHeight / 2 - node.y * this.currentTransform.k;
    const newTransform = zoomIdentity.translate(tx, ty).scale(this.currentTransform.k);
    select(this.zoomBg).call(this.zoomBehavior.transform, newTransform);
  }

  dispose(): void {
    this.disposed = true;
    if (this.simulation) {
      this.simulation.on('tick', null);
      this.simulation.stop();
      this.simulation = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    // Clear rendered nodes/links — React may rehydrate on re-mount
    while (this.linksGroup.firstChild) this.linksGroup.removeChild(this.linksGroup.firstChild);
    while (this.nodesGroup.firstChild) this.nodesGroup.removeChild(this.nodesGroup.firstChild);
  }

  private renderStructure(): void {
    // d3-selection join pattern
    const ns = 'http://www.w3.org/2000/svg';
    // links
    const existingLinks = new Map<string, SVGLineElement>();
    this.linksGroup.querySelectorAll<SVGLineElement>('.glink').forEach((el) => {
      const id = el.getAttribute(ATTR_LINK_ID);
      if (id) existingLinks.set(id, el);
    });
    const seenLinks = new Set<string>();
    for (const link of this.links) {
      seenLinks.add(link.id);
      let el = existingLinks.get(link.id);
      if (!el) {
        el = document.createElementNS(ns, 'line');
        el.setAttribute('class', 'glink');
        this.linksGroup.appendChild(el);
      }
      el.setAttribute(ATTR_LINK_ID, link.id);
      el.setAttribute(`${ATTR_LINK_ID}-source`, link.ref.source);
      el.setAttribute(`${ATTR_LINK_ID}-target`, link.ref.target);
      el.setAttribute('stroke-width', String(edgeWidth(link.ref.quality)));
      el.setAttribute('data-via-mqtt', link.ref.viaMqtt ? 'true' : 'false');
      el.setAttribute('data-quality', link.ref.quality < 0.25 ? 'low' : link.ref.quality < 0.5 ? 'med' : 'high');
    }
    existingLinks.forEach((el, id) => {
      if (!seenLinks.has(id)) el.remove();
    });

    // nodes (each node = a <g> with a glow circle, body circle, and label)
    const existingNodes = new Map<string, SVGGElement>();
    this.nodesGroup.querySelectorAll<SVGGElement>('.gnode').forEach((el) => {
      const id = el.getAttribute(ATTR_NODE_ID);
      if (id) existingNodes.set(id, el);
    });
    const seenNodes = new Set<string>();
    for (const node of this.nodes) {
      seenNodes.add(node.id);
      let el = existingNodes.get(node.id);
      if (!el) {
        el = document.createElementNS(ns, 'g');
        el.setAttribute('class', 'gnode');
        el.setAttribute(ATTR_NODE_ID, node.id);

        const glow = document.createElementNS(ns, 'circle');
        glow.setAttribute('class', 'gnode-glow');
        el.appendChild(glow);

        const body = document.createElementNS(ns, 'circle');
        body.setAttribute('class', 'gnode-body');
        el.appendChild(body);

        const label = document.createElementNS(ns, 'text');
        label.setAttribute('class', 'gnode-label');
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('dy', String(-node.radius - 8));
        el.appendChild(label);

        this.nodesGroup.appendChild(el);
      }
      const glow = el.querySelector<SVGCircleElement>('.gnode-glow');
      const body = el.querySelector<SVGCircleElement>('.gnode-body');
      const label = el.querySelector<SVGTextElement>('.gnode-label');
      if (!glow || !body || !label) continue;
      const r = node.radius;
      glow.setAttribute('r', String(r * 2.1));
      glow.setAttribute('fill', `var(--role-${roleTokenSuffix(node.ref.role)})`);
      glow.setAttribute('data-base-opacity', String(glowOpacityFor(node)));
      glow.setAttribute('opacity', String(glowOpacityFor(node)));
      glow.style.filter = 'blur(6px)';

      body.setAttribute('r', String(r));
      body.setAttribute('fill', `var(--role-${roleTokenSuffix(node.ref.role)})`);
      body.setAttribute('stroke', 'rgba(14, 16, 20, 0.82)');
      body.setAttribute('stroke-width', '2.5');
      el.setAttribute('data-status', node.ref.status);

      label.setAttribute('dy', String(-r - 8));
      label.textContent = node.ref.shortName;
    }
    existingNodes.forEach((el, id) => {
      if (!seenNodes.has(id)) el.remove();
    });
  }

  private bindInteractions(): void {
    // d3-drag callbacks need `this` bound to the DOM element, so we close over the instance.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const dragBehavior = drag<SVGGElement, GraphNode>()
      .on('start', function (event: D3DragEvent<SVGGElement, GraphNode, GraphNode>) {
        if (!self.simulation) return;
        if (!event.active) self.simulation.alphaTarget(0.18).restart();
        const d = pickNodeForElement(self, this);
        if (d) {
          d.fx = d.x;
          d.fy = d.y;
        }
      })
      .on('drag', function (event: D3DragEvent<SVGGElement, GraphNode, GraphNode>) {
        const d = pickNodeForElement(self, this);
        if (d) {
          d.fx = event.x;
          d.fy = event.y;
        }
      })
      .on('end', function (event: D3DragEvent<SVGGElement, GraphNode, GraphNode>) {
        if (!self.simulation) return;
        if (!event.active) self.simulation.alphaTarget(0);
        const d = pickNodeForElement(self, this);
        if (d) {
          d.fx = null;
          d.fy = null;
        }
      });

    select(this.nodesGroup)
      .selectAll<SVGGElement, GraphNode>('.gnode')
      .data(this.nodes, (d: GraphNode) => d.id)
      .on('click', function (event: MouseEvent, d: GraphNode) {
        event.stopPropagation();
        self.opts.onNodeClick?.(d.id);
      })
      .on('mouseenter', function (event: MouseEvent, d: GraphNode) {
        self.opts.onNodeHover?.(d.id, { x: event.clientX, y: event.clientY });
      })
      .on('mousemove', function (event: MouseEvent, d: GraphNode) {
        self.opts.onNodeHover?.(d.id, { x: event.clientX, y: event.clientY });
      })
      .on('mouseleave', function () {
        self.opts.onNodeHover?.(null, null);
      })
      .call(dragBehavior);
  }

  private applyPositions(): void {
    // Apply directly via DOM attribute writes — bypasses React entirely on tick
    const nodesEls = this.nodesGroup.querySelectorAll<SVGGElement>('.gnode');
    for (const el of nodesEls) {
      const id = el.getAttribute(ATTR_NODE_ID);
      if (!id) continue;
      const n = this.nodes.find((x) => x.id === id);
      if (!n || n.x == null || n.y == null) continue;
      el.setAttribute('transform', `translate(${n.x.toFixed(2)},${n.y.toFixed(2)})`);
    }
    const linkEls = this.linksGroup.querySelectorAll<SVGLineElement>('.glink');
    for (const el of linkEls) {
      const id = el.getAttribute(ATTR_LINK_ID);
      if (!id) continue;
      const link = this.links.find((l) => l.id === id);
      if (!link) continue;
      const s = link.source as GraphNode;
      const t = link.target as GraphNode;
      if (s.x == null || s.y == null || t.x == null || t.y == null) continue;
      el.setAttribute('x1', s.x.toFixed(2));
      el.setAttribute('y1', s.y.toFixed(2));
      el.setAttribute('x2', t.x.toFixed(2));
      el.setAttribute('y2', t.y.toFixed(2));
    }
  }
}

function pickNodeForElement(self: ForceGraph, el: SVGGElement): GraphNode | undefined {
  const id = el.getAttribute(ATTR_NODE_ID);
  if (!id) return undefined;
  return (self as unknown as { nodes: GraphNode[] }).nodes.find((n) => n.id === id);
}

function toGraphNode(node: Node, w: number, h: number): GraphNode {
  return {
    id: node.id,
    ref: node,
    radius: nodeRadius(node.throughput),
    x: w / 2 + (Math.random() - 0.5) * 40,
    y: h / 2 + (Math.random() - 0.5) * 40,
  };
}

function roleTokenSuffix(role: Node['role']): string {
  switch (role) {
    case 'ROUTER':
    case 'ROUTER_CLIENT':
      return 'router';
    case 'REPEATER':
      return 'repeater';
    case 'CLIENT':
      return 'client';
    case 'CLIENT_MUTE':
      return 'client-mute';
    case 'CLIENT_HIDDEN':
      return 'client-hidden';
    case 'TRACKER':
      return 'tracker';
    case 'SENSOR':
      return 'sensor';
    case 'TAK':
      return 'tak';
    case 'TAK_TRACKER':
      return 'tak-tracker';
    case 'LOST_AND_FOUND':
      return 'lost';
    default:
      return 'client';
  }
}

function glowOpacityFor(node: GraphNode): number {
  if (node.ref.status === 'offline') return 0.05;
  const normalized = (node.ref.snr + 20) / 30;
  return Math.max(0.25, Math.min(0.85, 0.3 + normalized * 0.5));
}
