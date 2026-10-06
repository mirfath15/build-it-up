import { ROOMS, BUILDINGS, type Room } from "./data";

export interface Intent { intent: "navigate" | "search" | "info"; accessible: boolean; matches: Room[]; query: string }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export function searchRooms(q: string): Room[] {
  const n = norm(q);
  if (!n) return [];
  return ROOMS.map((room) => {
    const b = BUILDINGS.find((x) => x.id === room.building)!;
    const code = norm(room.code), name = norm(room.name);
    let score = 0;
    if (new RegExp(`\\b${code}\\b`).test(n)) score += 10;
    if (n.includes(name)) score += 8;
    const hay = `${code} ${name} ${norm(room.department ?? "")} ${norm(b.name)} ${room.type}`;
    for (const w of n.split(" ")) if (w.length > 1 && hay.includes(w)) score += 1;
    return { room, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).map((x) => x.room);
}

/** Deterministic local NLP: turns a sentence into a structured intent. */
export function parseIntent(text: string): Intent {
  const n = norm(text);
  const accessible = /(without stairs|no stairs|wheelchair|accessible|lift only)/.test(n);
  const intent = /(take me|navigate|route|directions|go to|how do i get)/.test(n) ? "navigate" : /^where/.test(n) ? "search" : /(what|tell me|info)/.test(n) ? "info" : "search";
  const cleaned = n.replace(/(take me to|take me|navigate to|where is|the|room|without stairs|no stairs|please|how do i get to|go to|directions to)/g, " ");
  return { intent, accessible, matches: searchRooms(cleaned), query: cleaned.trim() };
}
