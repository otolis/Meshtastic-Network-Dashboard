# Meshtastic Network Dashboard

A client-side dashboard for visualizing a [Meshtastic](https://meshtastic.org/) mesh network — abstract topology, live telemetry, dark HUD aesthetic. Ships with a mock-first data layer and a `MeshDataSource` interface so swapping to a real device feed later is a one-file change.

**Live site:** <https://otolis.github.io/meshtastic-dashboard/>

---

## The views

Four views of a mesh network, shared chrome between them:

### Network — the hero view

An abstract **D3 force-directed graph** of the mesh. Not a map; a living topology.

- **Role** maps to node color (router, repeater, client, tracker, sensor, TAK).
- **SNR** maps to glow intensity — weaker RF = dimmer halo.
- **Throughput** maps to node radius.
- **Status** shades the border — solid for online, dashed amber for stale, dashed red for offline.
- **Edges** encode link quality in thickness and color; MQTT-gated edges dash in magenta.
- **Motion is telemetry.** Idle is still. When a packet traverses the mesh, its hop path animates a signal line edge-by-edge and pulses the nodes along the way. No ambient perpetual pulsing.

Zoom (`d3-zoom` clamped 0.3–4×), pan (mouse drag on background), drag nodes to pin them, click to inspect.

### Messages

Chronological packet log with filters:

- Portnum chips (text, position, telemetry, nodeinfo, neighborinfo, traceroute, routing)
- Free-text search across message text, sender, destination
- MQTT-only toggle
- Per-row: priority stripe, timestamp, sender → destination, portnum badge, hop bar, SNR

Clicking a row selects it → Inspector opens with full `MeshPacket` JSON AND the hop path lights up on the Network graph if you flip over to it.

### Health

Eight metric cards with delta-vs-previous-sample indicators, then four time-series charts (messages/hour area, packet loss, nodes online, avg SNR). One global time range drives every card and chart; no per-card ranges.

### Devices

Sortable/filterable device inventory table. Name, status chip, role, hardware, battery (with visual bar), SNR, last heard. `↗ graph` button on each row jumps to Network view with that node selected and highlighted.

---

## Shared chrome

- Collapsible left nav with persisted state; `1` / `2` / `3` / `4` jump between views.
- Top bar: live status pill (`LIVE` / `STALE` / `OFFLINE` / `MOCK`) + online-count meta + 5m / 15m / 1h / 6h / 24h / 7d time range presets.
- Right inspector: slides in on selection, closes on `Esc`. Pretty-printed full JSON of the selected node / message / device.
- `/` focuses the current view's search input; `?` opens a keyboard-shortcut overlay.
- URL-synced via `HashRouter` — refresh on any view returns to that view.
- `prefers-reduced-motion: reduce` collapses all animation durations to zero.
- WCAG AA contrast pairs baked into the palette tokens.

---

## Tech

- **React 18.3** + **Vite 7.3** + **TypeScript 5.8** (strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`)
- **D3** — `d3-force`, `d3-selection`, `d3-zoom`, `d3-drag` (submodules only, not the full package)
- **GSAP 3** with `@gsap/react` — `useGSAP` hook is the only JS animation entry point
- **Recharts 3** — time-series and metric charts
- **CSS Modules** + **CSS custom-property tokens** in `src/theme/tokens.css`
- **React Router v7** with `HashRouter` for GitHub-Pages-safe routing
- **ESLint 9** flat config + **Prettier 3**
- Zero runtime network dependencies — everything is bundled or generated locally.

---

## Run locally

```bash
npm install
npm run dev
```

Opens at <http://localhost:5173/meshtastic-dashboard/>. The mock event stream starts emitting bursts of messages within a few seconds of load.

```bash
npm run build       # typecheck + production build + 404.html fallback
npm run typecheck   # standalone tsc pass
npm run preview     # serve dist/ locally
npm run lint        # eslint with --max-warnings 0
npm run format      # prettier
```

---

## Architecture

One seam: `src/data/source.ts` — the `MeshDataSource` interface. Promise-returning queries and a callback-based `subscribe(event, handler)` live-event channel. Five event types: `node:update`, `edge:update`, `message:new`, `health:sample`, `status:change`.

Two implementations:

- `MockDataSource` — coherent in-memory scenario built from a seeded RNG (`src/data/mock/scenario.ts`). Meshtastic-style hex ids, plausible short names, log-normal battery / SNR / RSSI distributions, intentional offline / stale / low-battery outliers, bursty message timeline (3–7 messages per 30-second burst, 3–15 minute gaps), BFS-computed hop paths. Reads simulate 150–300ms latency + 2% failure rate so loading / error states get exercised from day one.
- `LiveDataSource` — stub for v2. Throws `not implemented` from every read. Same interface, so swapping is literally one line in `src/app/Providers.tsx`:

  ```ts
  const source: MeshDataSource = new MockDataSource();  // v1
  // const source: MeshDataSource = new LiveDataSource({ url });  // v2
  ```

React contexts are split by concern to avoid re-render cascades:

- `DataSourceContext` — the stable source instance
- `DataProvider` — per-slice hooks (`useNodes`, `useEdges`, `useAllMessages`, `useDevices`, `useLiveMessages`, `useConnectionStatus`) so a messages refresh doesn't re-render the graph
- `FilterContext` — global time range + query
- `SelectionContext` — selected node / message / device (high-frequency on click)

The Network view enforces the D3/React ownership boundary as a hard rule: **React owns the `<svg>` shell, `<defs>`, overlays, tooltips, and the inspector; D3 owns the `<g class="graph-root">` inside it** via a plain `ForceGraph` class instantiated with `useRef`. Tick handlers write SVG attributes directly — positions never go through React state.

---

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which:

1. Installs dependencies with `npm ci`
2. Runs `npm run lint`
3. Runs `npm run build` (typecheck + bundle + 404.html fallback)
4. Publishes `dist/` via the official `actions/deploy-pages` flow (no `gh-pages` branch)

Workflow requires `permissions: {contents: read, pages: write, id-token: write}`. In repo Settings → Pages, source must be set to **GitHub Actions**.

---

## Project identity

- **Owner:** Apostolos Lagonikas ([otolis](https://github.com/otolis))
- **License:** private portfolio project
