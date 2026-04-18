#!/usr/bin/env node

const BASE_URL = 'https://meshtastic.liamcottle.net';
const TIMEOUT_MS = 10_000;
const ONLINE_WINDOW_MS = 60 * 60 * 1000;
const GR_BBOX = { latMin: 34, latMax: 42, lonMin: 19, lonMax: 29 };

const WRITE_JSON = process.argv.slice(2).includes('--json');

function now() { return process.hrtime.bigint(); }
function ms(start) { return Number(now() - start) / 1e6; }

async function hit(path) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const start = now();
  try {
    const res = await fetch(BASE_URL + path, {
      signal: ctrl.signal,
      headers: { accept: 'application/json', 'user-agent': 'meshtastic-dashboard-preflight/1.0' },
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { ok: res.ok, status: res.status, data, elapsedMs: ms(start) };
  } finally {
    clearTimeout(timer);
  }
}

function section(title) {
  console.log('\n=== ' + title + ' ===');
}

function summarize(data) {
  if (Array.isArray(data)) {
    console.log(`records: ${data.length}`);
    if (data.length > 0) {
      console.log('first record:');
      console.log(JSON.stringify(data[0], null, 2));
    }
    return;
  }
  if (data && typeof data === 'object') {
    const keys = Object.keys(data);
    console.log(`object keys: ${keys.join(', ')}`);
    let sawArray = false;
    for (const k of keys) {
      const v = data[k];
      if (Array.isArray(v)) {
        sawArray = true;
        console.log(`  ${k}: array(${v.length})`);
        if (v.length > 0) {
          console.log(`  ${k}[0]:`);
          console.log(JSON.stringify(v[0], null, 2).split('\n').map(l => '    ' + l).join('\n'));
        }
      }
    }
    if (!sawArray) {
      console.log('body:');
      console.log(JSON.stringify(data, null, 2));
    }
    return;
  }
  console.log('body:', String(data).slice(0, 1000));
}

async function probe(path) {
  section(path);
  try {
    const { ok, status, data, elapsedMs } = await hit(path);
    console.log(`HTTP ${status}   ${elapsedMs.toFixed(0)}ms`);
    if (!ok) {
      console.log('non-OK response body:');
      console.log(typeof data === 'string' ? data.slice(0, 2000) : JSON.stringify(data, null, 2).slice(0, 2000));
      return null;
    }
    summarize(data);
    return data;
  } catch (err) {
    console.log('ERROR:', err?.name ?? 'Error', '-', err?.message ?? String(err));
    return null;
  }
}

function extractNodeList(resp) {
  if (Array.isArray(resp)) return resp;
  if (resp && Array.isArray(resp.nodes)) return resp.nodes;
  if (resp && Array.isArray(resp.data)) return resp.data;
  if (resp && Array.isArray(resp.results)) return resp.results;
  return [];
}

function getNodeId(n) {
  return n?.node_id ?? n?.nodeId ?? n?.id ?? n?.num ?? n?.node_num;
}

function getCoords(n) {
  const pos = (n && typeof n.position === 'object' && n.position) ? n.position : n;
  if (!pos) return { lat: null, lon: null };
  let lat = pos.latitude ?? pos.lat ?? null;
  let lon = pos.longitude ?? pos.lon ?? pos.lng ?? null;
  if (lat == null && pos.latitude_i != null) lat = pos.latitude_i / 1e7;
  if (lon == null && pos.longitude_i != null) lon = pos.longitude_i / 1e7;
  return {
    lat: typeof lat === 'number' && Number.isFinite(lat) ? lat : null,
    lon: typeof lon === 'number' && Number.isFinite(lon) ? lon : null,
  };
}

function getLastHeardMs(n) {
  const v = n?.updated_at ?? n?.last_heard ?? n?.lastHeard ?? n?.last_seen ?? n?.timestamp;
  if (v == null) return null;
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function getShortName(n) {
  return n?.short_name ?? n?.shortName ?? n?.user?.short_name ?? n?.user?.shortName ?? null;
}

function getHwModel(n) {
  return n?.hardware_model ?? n?.hw_model ?? n?.hwModel ?? n?.user?.hw_model ?? n?.user?.hardware_model ?? null;
}

function inBox(lat, lon) {
  return lat != null && lon != null
    && lat >= GR_BBOX.latMin && lat <= GR_BBOX.latMax
    && lon >= GR_BBOX.lonMin && lon <= GR_BBOX.lonMax;
}

function median(xs) {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function fmtTime(t) { return t == null ? 'n/a' : new Date(t).toISOString(); }

console.log('Meshtastic API preflight');
console.log(`base: ${BASE_URL}`);
console.log(`timeout per fetch: ${TIMEOUT_MS}ms`);
console.log(`write json: ${WRITE_JSON}`);

const nodesResponse = await probe('/api/v1/nodes');

const nodeList = extractNodeList(nodesResponse);
const sample = nodeList[0];
const sampleId = sample ? getNodeId(sample) : null;

if (sampleId != null) {
  section(`sample node_id picked: ${sampleId}`);
  await probe(`/api/v1/nodes/${sampleId}`);
  await probe(`/api/v1/nodes/${sampleId}/device-metrics`);
  await probe(`/api/v1/nodes/${sampleId}/position-history`);
  await probe(`/api/v1/nodes/${sampleId}/neighbours`);
} else {
  section('sample node_id: <none — skipping per-node probes>');
}

const annotated = nodeList.map(n => ({
  raw: n,
  ...getCoords(n),
  lastHeardMs: getLastHeardMs(n),
  shortName: getShortName(n),
  hwModel: getHwModel(n),
}));
const inGreece = annotated.filter(a => inBox(a.lat, a.lon));

section('DERIVED: Greek bounding box (lat 34–42, lon 19–29)');
console.log(`total nodes from API: ${nodeList.length}`);
console.log(`nodes in GR bbox:     ${inGreece.length}`);
console.log('first 5 GR nodes:');
for (const a of inGreece.slice(0, 5)) {
  const lat = a.lat != null ? a.lat.toFixed(4) : 'null';
  const lon = a.lon != null ? a.lon.toFixed(4) : 'null';
  console.log(`  short_name=${a.shortName ?? '(null)'}  lat=${lat}  lon=${lon}  last_heard=${fmtTime(a.lastHeardMs)}`);
}

section('DERIVED: online/offline distribution (online = heard < 60min ago)');
const nowMs = Date.now();
let online = 0, offline = 0, unknown = 0;
for (const a of inGreece) {
  if (a.lastHeardMs == null) { unknown++; continue; }
  if (nowMs - a.lastHeardMs <= ONLINE_WINDOW_MS) online++; else offline++;
}
console.log(`total: ${inGreece.length}   online: ${online}   offline: ${offline}   unknown: ${unknown}`);

section('DERIVED: hardware model breakdown (top 5 in GR)');
const hwCounts = new Map();
for (const a of inGreece) {
  const hw = a.hwModel ?? '(unknown)';
  hwCounts.set(hw, (hwCounts.get(hw) ?? 0) + 1);
}
const top5 = [...hwCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
if (top5.length === 0) console.log('  (no GR nodes)');
for (const [hw, c] of top5) console.log(`  ${hw}: ${c}`);

section('DERIVED: data freshness of GR subset');
const times = inGreece.map(a => a.lastHeardMs).filter(v => v != null).sort((a, b) => a - b);
console.log(`samples with timestamp: ${times.length} / ${inGreece.length}`);
console.log(`oldest: ${fmtTime(times[0])}`);
console.log(`newest: ${fmtTime(times[times.length - 1])}`);
console.log(`median: ${fmtTime(median(times))}`);

section('DERIVED: coord sanity check (bad_position = null or 0/0)');
const bad = annotated.filter(a => a.lat == null || a.lon == null || (a.lat === 0 && a.lon === 0));
console.log(`bad_position nodes in full dataset: ${bad.length} / ${nodeList.length}`);
const badSample = bad.slice(0, 5);
for (const a of badSample) {
  console.log(`  id=${getNodeId(a.raw)} short_name=${a.shortName ?? '(null)'} lat=${a.lat} lon=${a.lon}`);
}
if (bad.length > 5) console.log(`  ... and ${bad.length - 5} more`);

if (WRITE_JSON) {
  section('WRITING greek-nodes.json');
  const fs = await import('node:fs/promises');
  const payload = inGreece.map(a => a.raw);
  await fs.writeFile('greek-nodes.json', JSON.stringify(payload, null, 2), 'utf8');
  console.log(`wrote ${payload.length} nodes to greek-nodes.json`);
}

console.log('\n=== DONE ===');
