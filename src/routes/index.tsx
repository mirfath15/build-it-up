import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { ROOMS, BUILDINGS, buildingById, floorLabel, type Room } from "@/lib/campus/data";
import { aStar, dijkstra, ACCESSIBLE_UNAVAILABLE, type RouteResult } from "@/lib/campus/graph";
import { parseIntent, searchRooms } from "@/lib/campus/nlp";

const CampusMap = lazy(() => import("@/components/CampusMap"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Campus Navigator AI — Velammal Engineering College" },
      { name: "description", content: "Find rooms, labs and offices across VEC Chennai with step-by-step indoor and outdoor directions." },
      { property: "og:title", content: "Campus Navigator AI — VEC Chennai" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:description", content: "Search rooms and get A* routes with an accessible, stair-free mode." },
    ],
  }),
  component: Index,
});

const START_OPTIONS = [
  { id: "hub", label: "Campus reference point" },
  ...BUILDINGS.map((b) => ({ id: `${b.id}-entrance`, label: `${b.name} entrance` })),
];

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

function Index() {
  const [query, setQuery] = useState("");
  const [start, setStart] = useState("hub");
  const [accessible, setAccessible] = useState(false);
  const [target, setTarget] = useState<Room | null>(null);
  const [ask, setAsk] = useState("");
  const [reply, setReply] = useState("");
  const [listening, setListening] = useState(false);

  const results = useMemo(() => (query ? searchRooms(query) : ROOMS), [query]);

  const route = useMemo(() => {
    if (!target) return null;
    const opt = { accessible };
    return { a: aStar(start, target.id, opt), d: dijkstra(start, target.id, opt) };
  }, [target, start, accessible]);

  function runAssistant(text: string) {
    const it = parseIntent(text);
    if (!it.matches.length) { setReply("I couldn't find that place in the current campus data."); return; }
    const room = it.matches[0]!;
    const b = buildingById(room.building);
    if (it.accessible) setAccessible(true);
    if (it.intent === "navigate") {
      setTarget(room);
      const r = aStar(start, room.id, { accessible: it.accessible || accessible });
      const msg = r ? `Routing to ${room.code}, ${room.name}. ${r.instructions.join(" ")}` : ACCESSIBLE_UNAVAILABLE;
      setReply(msg); speak(msg);
    } else {
      const msg = `${room.code} — ${room.name} is on the ${floorLabel(room.floor).toLowerCase()} of ${b.name}.`;
      setReply(msg); speak(msg); setTarget(room);
    }
  }

  function listen() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setReply("Voice input isn't supported in this browser."); return; }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.onresult = (e: any) => { const t = e.results[0][0].transcript; setAsk(t); runAssistant(t); };
    rec.onend = () => setListening(false);
    setListening(true); rec.start();
  }

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:flex-row">
      <aside className="flex w-full flex-col gap-5 overflow-y-auto border-r border-border p-5 lg:w-[440px]">
        <header>
          <p className="text-xs uppercase tracking-[0.2em] text-accent">Velammal Engineering College</p>
          <h1 className="text-3xl font-bold">Campus Navigator <span className="text-primary">AI</span></h1>
        </header>

        <section className="rounded-lg bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Ask the assistant</h2>
          <form onSubmit={(e) => { e.preventDefault(); runAssistant(ask); }} className="flex gap-2">
            <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Take me to room 864 without stairs"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring" />
            <button type="button" onClick={listen} className="rounded-md bg-secondary px-3 text-sm" aria-label="Speak">
              {listening ? "…" : "🎤"}
            </button>
            <button className="rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground">Ask</button>
          </form>
          {reply && <p className="mt-3 text-sm text-muted-foreground">{reply}</p>}
        </section>

        <section className="flex flex-wrap items-center gap-3 text-sm">
          <select value={start} onChange={(e) => setStart(e.target.value)} className="rounded-md border border-input bg-background px-2 py-2">
            {START_OPTIONS.map((o) => <option key={o.id} value={o.id}>From: {o.label}</option>)}
          </select>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={accessible} onChange={(e) => setAccessible(e.target.checked)} className="accent-primary" />
            Accessible mode (no stairs)
          </label>
        </section>

        {target && route && (
          <section className="rounded-lg border border-primary/40 bg-card p-4">
            <h2 className="font-semibold">{target.code} — {target.name}</h2>
            <p className="text-xs text-muted-foreground">{buildingById(target.building).name} · {floorLabel(target.floor)}</p>
            {route.a ? (
              <>
                <p className="mt-2 text-sm"><b>{route.a.distance.toFixed(0)} m</b> · about {Math.ceil(route.a.etaSec / 60)} min walk</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{route.a.instructions.map((s, i) => <li key={i}>{s}</li>)}</ol>
                <button onClick={() => speak(route.a!.instructions.join(" "))} className="mt-3 text-xs text-accent underline">Read aloud</button>
                <Compare a={route.a} d={route.d!} />
              </>
            ) : <p className="mt-2 text-sm text-destructive">{ACCESSIBLE_UNAVAILABLE}</p>}
          </section>
        )}

        <section>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search room number, name, department, building…"
            className="mb-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring" />
          <ul className="space-y-2">
            {results.map((room) => (
              <li key={room.id} className="flex items-center justify-between gap-2 rounded-md bg-card px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{room.code} — {room.name}</div>
                  <div className="text-xs text-muted-foreground">{buildingById(room.building).name} · {floorLabel(room.floor)}{room.department ? ` · ${room.department}` : ""}</div>
                </div>
                <button onClick={() => setTarget(room)} className="shrink-0 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">Navigate here</button>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-xs text-warning">
          Data notice: building and entrance positions are approximate (requires confirmation), and indoor layouts are schematic — exact indoor coordinates are not yet surveyed.
        </p>
      </aside>

      <main className="h-[60vh] flex-1 lg:h-auto">
        <ClientOnly fallback={<div className="h-full w-full bg-muted" />}>
          <Suspense fallback={<div className="h-full w-full bg-muted" />}>
            <CampusMap path={route?.a?.path ?? []} />
          </Suspense>
        </ClientOnly>
      </main>
    </div>
  );
}

function Compare({ a, d }: { a: RouteResult; d: RouteResult }) {
  return (
    <table className="mt-4 w-full text-xs">
      <thead className="text-muted-foreground"><tr><th className="text-left">Algorithm</th><th>Distance</th><th>Visited</th><th>Steps</th><th>Time</th></tr></thead>
      <tbody>
        {[["A*", a], ["Dijkstra", d] as const].map(([n, r]) => (
          <tr key={n as string} className="text-center"><td className="text-left">{n as string}</td><td>{(r as RouteResult).distance.toFixed(0)} m</td><td>{(r as RouteResult).visited}</td><td>{(r as RouteResult).path.length}</td><td>{(r as RouteResult).runtimeMs.toFixed(2)} ms</td></tr>
        ))}
      </tbody>
    </table>
  );
}
