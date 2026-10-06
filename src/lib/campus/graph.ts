import { BUILDINGS, ROOMS, OSM_REFERENCE, buildingById, floorLabel, type Status } from "./data";

export type NodeKind = "junction" | "entrance" | "corridor" | "stairs" | "lift" | "room";
export type EdgeKind = "outdoor" | "indoor" | "transition" | "stairs" | "lift";

export interface GNode {
  id: string;
  label: string;
  kind: NodeKind;
  building?: string;
  floor?: number;
  // local metric frame (metres east/north of OSM reference, z = height)
  x: number; y: number; z: number;
  lat?: number; lng?: number;
  status: Status;
}
export interface GEdge { a: string; b: string; w: number; kind: EdgeKind }

const M_PER_DEG_LAT = 111_320;
const mPerDegLng = M_PER_DEG_LAT * Math.cos((OSM_REFERENCE.lat * Math.PI) / 180);
const toXY = (lat: number, lng: number) => ({
  x: (lng - OSM_REFERENCE.lng) * mPerDegLng,
  y: (lat - OSM_REFERENCE.lat) * M_PER_DEG_LAT,
});
const FLOOR_H = 4;

const nodes = new Map<string, GNode>();
const edges: GEdge[] = [];
const dist = (a: GNode, b: GNode) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const add = (n: GNode) => nodes.set(n.id, n);
const link = (a: string, b: string, kind: EdgeKind, factor = 1) =>
  edges.push({ a, b, kind, w: dist(nodes.get(a)!, nodes.get(b)!) * factor });

// Outdoor hub at the OSM reference point
add({ id: "hub", label: "Campus reference point", kind: "junction", x: 0, y: 0, z: 0, ...OSM_REFERENCE, status: "verified" });

for (const b of BUILDINGS) {
  const p = toXY(b.lat, b.lng);
  const ent = `${b.id}-entrance`;
  add({ id: ent, label: `${b.name} entrance`, kind: "entrance", building: b.id, floor: 0, ...p, z: 0, lat: b.lat, lng: b.lng, status: "requires_confirmation" });
  link("hub", ent, "outdoor");
  for (let f = 0; f < b.floors; f++) {
    const z = f * FLOOR_H;
    const c = `${b.id}-${f}-corridor`;
    const s = `${b.id}-${f}-stairs`;
    add({ id: c, label: `${b.name} ${floorLabel(f)} corridor`, kind: "corridor", building: b.id, floor: f, x: p.x + 4, y: p.y, z, status: "unverified" });
    add({ id: s, label: `${b.name} stairs (${floorLabel(f)})`, kind: "stairs", building: b.id, floor: f, x: p.x + 1, y: p.y + 3, z, status: "unverified" });
    link(c, s, "indoor");
    if (f === 0) link(ent, c, "transition");
    if (f > 0) link(`${b.id}-${f - 1}-stairs`, s, "stairs", 2);
    if (b.hasLift && b.liftFloors?.includes(f)) {
      const l = `${b.id}-${f}-lift`;
      add({ id: l, label: `${b.name} lift (${floorLabel(f)})`, kind: "lift", building: b.id, floor: f, x: p.x + 7, y: p.y + 3, z, status: "verified" });
      link(c, l, "indoor");
      if (f > 0 && b.liftFloors.includes(f - 1)) link(`${b.id}-${f - 1}-lift`, l, "lift", 1.5);
    }
  }
}

// Rooms: schematic slots along each floor corridor
const slot = new Map<string, number>();
for (const room of ROOMS) {
  const b = buildingById(room.building);
  const p = toXY(b.lat, b.lng);
  const key = `${room.building}-${room.floor}`;
  const i = slot.get(key) ?? 0;
  slot.set(key, i + 1);
  add({ id: room.id, label: `${room.code} — ${room.name}`, kind: "room", building: room.building, floor: room.floor,
    x: p.x + 6 + i * 5, y: p.y + (i % 2 ? 4 : -4), z: room.floor * FLOOR_H, status: "unverified" });
  link(`${key}-corridor`, room.id, "indoor");
}

export const GRAPH = { nodes, edges };

export interface RouteOptions { accessible: boolean; closed?: Set<string> }
export interface RouteResult {
  path: GNode[]; distance: number; etaSec: number; visited: number; runtimeMs: number;
  instructions: string[];
}
const WALK = 1.3; // m/s

function neighbours(id: string, opt: RouteOptions) {
  const out: { to: string; w: number }[] = [];
  for (const e of edges) {
    if (e.a !== id && e.b !== id) continue;
    if (opt.accessible && e.kind === "stairs") continue;
    const to = e.a === id ? e.b : e.a;
    if (opt.closed?.has(to) || opt.closed?.has(id)) continue;
    if (opt.accessible && nodes.get(to)!.kind === "stairs") continue;
    out.push({ to, w: e.w });
  }
  return out;
}

function search(from: string, to: string, opt: RouteOptions, useHeuristic: boolean): RouteResult | null {
  const t0 = performance.now();
  const goal = nodes.get(to)!;
  const g = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, string>();
  const open = new Set([from]);
  const closedSet = new Set<string>();
  const h = (id: string) => (useHeuristic ? dist(nodes.get(id)!, goal) : 0);
  while (open.size) {
    let cur = ""; let best = Infinity;
    for (const id of open) { const f = g.get(id)! + h(id); if (f < best) { best = f; cur = id; } }
    if (cur === to) break;
    open.delete(cur); closedSet.add(cur);
    for (const { to: n, w } of neighbours(cur, opt)) {
      if (closedSet.has(n)) continue;
      const ng = g.get(cur)! + w;
      if (ng < (g.get(n) ?? Infinity)) { g.set(n, ng); prev.set(n, cur); open.add(n); }
    }
  }
  if (!g.has(to)) return null;
  const ids = [to];
  while (ids[0] !== from) ids.unshift(prev.get(ids[0])!);
  const path = ids.map((id) => nodes.get(id)!);
  const distance = g.get(to)!;
  return { path, distance, etaSec: distance / WALK, visited: closedSet.size, runtimeMs: performance.now() - t0, instructions: describe(path) };
}

export const aStar = (f: string, t: string, o: RouteOptions) => search(f, t, o, true);
export const dijkstra = (f: string, t: string, o: RouteOptions) => search(f, t, o, false);

function describe(path: GNode[]): string[] {
  const out: string[] = [];
  for (let i = 1; i < path.length; i++) {
    const p = path[i - 1], n = path[i];
    if (n.kind === "entrance") out.push(`Walk outdoors to ${n.label}.`);
    else if (p.kind === "entrance" && n.kind === "corridor") out.push(`Enter ${buildingById(n.building!).name}.`);
    else if (p.kind === "stairs" && n.kind === "stairs") out.push(`Take the stairs ${n.floor! > p.floor! ? "up" : "down"} to the ${floorLabel(n.floor!).toLowerCase()}.`);
    else if (p.kind === "lift" && n.kind === "lift") out.push(`Take the lift to the ${floorLabel(n.floor!).toLowerCase()}.`);
    else if (n.kind === "room") out.push(`Arrive at ${n.label}.`);
    else if (p.kind === "corridor" && n.kind === "entrance") out.push(`Exit ${buildingById(p.building!).name}.`);
  }
  return out;
}

export const ACCESSIBLE_UNAVAILABLE = "Accessible route is not available from the current verified campus data.";
