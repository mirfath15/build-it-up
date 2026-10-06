import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { BUILDINGS, OSM_REFERENCE } from "@/lib/campus/data";
import type { GNode } from "@/lib/campus/graph";

const tok = (n: string) => (typeof document === "undefined" ? "#888" : getComputedStyle(document.documentElement).getPropertyValue(n).trim() || "#888");

export default function CampusMap({ path }: { path: GNode[] }) {
  const outdoor = path.filter((n) => n.lat != null).map((n) => [n.lat!, n.lng!] as [number, number]);
  return (
    <MapContainer center={[OSM_REFERENCE.lat, OSM_REFERENCE.lng]} zoom={18} className="h-full w-full" scrollWheelZoom>
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <CircleMarker center={[OSM_REFERENCE.lat, OSM_REFERENCE.lng]} radius={6} pathOptions={{ color: tok("--map-hub"), fillOpacity: 1 }}>
        <Tooltip>OSM reference point</Tooltip>
      </CircleMarker>
      {BUILDINGS.map((b) => (
        <CircleMarker key={b.id} center={[b.lat, b.lng]} radius={10} pathOptions={{ color: tok("--map-building"), fillOpacity: 0.5 }}>
          <Tooltip permanent direction="top">{b.name} (position unconfirmed)</Tooltip>
        </CircleMarker>
      ))}
      {outdoor.length > 1 && <Polyline positions={outdoor} pathOptions={{ color: tok("--map-route"), weight: 6 }} />}
    </MapContainer>
  );
}
