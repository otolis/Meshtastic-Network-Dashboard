# Meshtastic Network Dashboard

A dashboard for visualizing a [Meshtastic](https://meshtastic.org/) mesh network — abstract topology, live telemetry, dark HUD aesthetic. Ships with mock data first; the data layer is designed so swapping to a real device feed later is a one-file change.

**Live site:** https://otolis.github.io/meshtastic-dashboard/

## What it does

Four views of a mesh network:

- **Network** — abstract D3 force-directed graph with event-driven pulses and animated signal lines. Motion encodes telemetry, not decoration.
- **Messages** — chronological log of packets, filterable, with hop-path highlight on selection.
- **Health** — metric cards and time-series charts over a single coherent dataset.
- **Devices** — sortable, filterable table of every node with full-JSON inspector.

## Tech

React 18 + Vite + TypeScript + D3 + GSAP + Recharts. CSS Modules with design tokens. Static SPA, deployed to GitHub Pages.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173/meshtastic-dashboard/

## Build

```bash
npm run build       # typecheck + production build into dist/
npm run preview     # serve dist/ locally
npm run lint        # eslint
npm run format      # prettier
```

## Deploy

Pushing to `main` runs the GitHub Actions workflow in `.github/workflows/deploy.yml`, which builds and publishes to GitHub Pages.

## Status

Under active development toward v1. See the live site for current progress.
