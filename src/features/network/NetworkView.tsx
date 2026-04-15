import { useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import styles from './NetworkView.module.css';
import { ForceGraph } from './ForceGraph';
import { Legend } from './Legend';
import { Tooltip } from './Tooltip';
import { useDataSource } from '../../state/DataSourceContext';
import { useAllMessages, useEdges, useNodes, useSelection } from '../../state/hooks';
import type { Node, NodeId } from '../../types';
import type { MeshEventPayload } from '../../data/source';

export default function NetworkView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraph | null>(null);
  const nodes = useNodes();
  const edges = useEdges();
  const messages = useAllMessages();
  const { selectNode, clear, kind, id: selectedId } = useSelection();
  const source = useDataSource();
  const [hoverNode, setHoverNode] = useState<Node | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  const onlineCount = useMemo(() => nodes.data.filter((n) => n.status === 'online').length, [nodes.data]);

  // Build / tear down the ForceGraph class in an effect. React owns the <svg> shell;
  // D3 owns the simulation, ticks, zoom, drag inside it.
  useEffect(() => {
    if (!svgRef.current) return;
    if (nodes.loading || edges.loading) return;
    if (!graphRef.current) {
      graphRef.current = new ForceGraph(svgRef.current, {
        onNodeClick: (id) => selectNode(id),
        onBackgroundClick: () => clear(),
        onNodeHover: (id, pos) => {
          if (id) {
            const n = nodes.data.find((x) => x.id === id);
            setHoverNode(n ?? null);
            setHoverPos(pos);
          } else {
            setHoverNode(null);
            setHoverPos(null);
          }
        },
      });
      graphRef.current.init(nodes.data, edges.data);
    } else {
      graphRef.current.update(nodes.data, edges.data);
    }
    return () => {
      // Cleanup only on unmount — identity of nodes/edges arrays changes frequently,
      // we don't want to rebuild the simulation on every data refresh.
    };
    // Intentionally run once when loading flips false, then updates in the other effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.loading, edges.loading]);

  // Push data updates into the existing graph without rebuilding the simulation
  useEffect(() => {
    if (!graphRef.current) return;
    if (nodes.loading || edges.loading) return;
    graphRef.current.update(nodes.data, edges.data);
  }, [nodes.data, edges.data, nodes.loading, edges.loading]);

  // Dispose cleanly on unmount
  useEffect(() => {
    return () => {
      graphRef.current?.dispose();
      graphRef.current = null;
    };
  }, []);

  // Subscribe to live message stream: pulse the hop path and animate edges
  useEffect(() => {
    const unsub = source.subscribe('message:new', (msg: MeshEventPayload['message:new']) => {
      if (!graphRef.current) return;
      if (msg.path && msg.path.length > 1) {
        graphRef.current.pulsePath(msg.path, { durationMs: 900 });
      } else {
        graphRef.current.pulseNode(msg.fromNode, { durationMs: 700, intensity: 0.7 });
      }
    });
    return unsub;
  }, [source]);

  // Highlight selection from cross-view actions
  useEffect(() => {
    if (!graphRef.current) return;
    if (kind === 'node' && selectedId) {
      graphRef.current.highlightPath([selectedId as NodeId]);
      graphRef.current.pulseNode(selectedId as NodeId, { durationMs: 700, intensity: 0.6 });
    } else if (kind === 'message' && selectedId) {
      const msg = messages.data.find((m) => m.id === selectedId);
      if (msg?.path && msg.path.length > 1) {
        graphRef.current.highlightPath(msg.path);
        graphRef.current.pulsePath(msg.path, { durationMs: 900 });
      } else {
        graphRef.current.highlightPath(null);
      }
    } else {
      graphRef.current.highlightPath(null);
    }
  }, [kind, selectedId, messages.data]);

  // GSAP reveal animation on mount — single-fire, cleans up on unmount via useGSAP scope
  useGSAP(
    () => {
      if (nodes.loading) return;
      gsap.from('.gnode', {
        opacity: 0,
        scale: 0.4,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.03,
        transformOrigin: 'center',
      });
      gsap.from('.glink', {
        opacity: 0,
        duration: 0.6,
        ease: 'power2.out',
        stagger: 0.01,
        delay: 0.1,
      });
    },
    { scope: wrapRef, dependencies: [nodes.loading] },
  );

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <header className={styles.headerBar}>
        <div>
          <h1 className={styles.headerTitle}>Network Topology</h1>
          <span className={styles.headerSub}>abstract · force-directed · live</span>
        </div>
        <div className={styles.headerMeta}>
          <span>
            Nodes <strong>{nodes.loading ? '—' : `${onlineCount}/${nodes.data.length}`}</strong>
          </span>
          <span>
            Edges <strong>{edges.loading ? '—' : edges.data.length}</strong>
          </span>
          <span>
            MQTT <strong>{edges.data.filter((e) => e.viaMqtt).length}</strong>
          </span>
        </div>
      </header>
      <div className={styles.canvas}>
        <svg ref={svgRef} className={styles.svg} role="img" aria-label="Mesh network topology">
          <defs>
            <filter id="soft-glow">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>
          <rect className="graph-zoombg" fill="transparent" />
          <g className="graph-root">
            <g className="graph-links" />
            <g className="graph-nodes" />
          </g>
        </svg>
        <Legend />
        <Tooltip node={hoverNode} position={hoverPos} />
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.ctrlBtn}
            aria-label="Zoom in"
            onClick={() => graphRef.current?.zoomBy(1.3)}
          >
            +
          </button>
          <button
            type="button"
            className={styles.ctrlBtn}
            aria-label="Zoom out"
            onClick={() => graphRef.current?.zoomBy(1 / 1.3)}
          >
            −
          </button>
          <button
            type="button"
            className={styles.ctrlBtn}
            aria-label="Reset view"
            onClick={() => graphRef.current?.resetView()}
          >
            ◉
          </button>
        </div>
        {nodes.loading && <div className={styles.loading}>Loading mesh…</div>}
        {nodes.error && <div className={styles.errorBox}>⚠ {nodes.error.message}</div>}
      </div>
    </div>
  );
}
