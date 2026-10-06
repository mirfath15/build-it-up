// Seeded campus data from the supplied handwritten floor plans.
// Indoor positions are SCHEMATIC ONLY (not surveyed). Building/entrance
// coordinates are approximate and flagged requires_confirmation.

export type Status = "verified" | "unverified" | "requires_confirmation";
export type RoomType = "classroom" | "lab" | "restroom" | "office" | "staffroom" | "door";

export interface Room {
  id: string;
  code: string;
  name: string;
  type: RoomType;
  department?: string;
  building: string;
  floor: number;
  status: Status;
}

export interface Building {
  id: string;
  name: string;
  lat: number;
  lng: number;
  floors: number;
  hasLift: boolean; // only true where the supplied plan explicitly shows one
  liftFloors?: number[];
  status: Status;
}

export const OSM_REFERENCE = { lat: 13.148828, lng: 80.192063 };

export const BUILDINGS: Building[] = [
  { id: "akb", name: "Abdul Kalam Block", lat: 13.14915, lng: 80.19175, floors: 3, hasLift: false, status: "requires_confirmation" },
  { id: "kir", name: "Kirloskar Block", lat: 13.14855, lng: 80.19245, floors: 3, hasLift: false, status: "requires_confirmation" },
  { id: "anna", name: "Anna Auditorium", lat: 13.14845, lng: 80.19165, floors: 2, hasLift: true, liftFloors: [0, 1], status: "requires_confirmation" },
];

const r = (building: string, floor: number, code: string, name: string, type: RoomType, department?: string): Room => ({
  id: `${building}-${floor}-${code}`.replace(/\s+/g, "_"),
  code, name, type, department, building, floor, status: "unverified",
});

export const ROOMS: Room[] = [
  // Abdul Kalam Block
  r("akb", 0, "868", "Girls Restroom", "restroom"),
  r("akb", 0, "860", "Second Year IT A Section Classroom", "classroom", "IT"),
  r("akb", 0, "861", "Second Year IT B Section Classroom", "classroom", "IT"),
  r("akb", 0, "871", "Third Year IT A Classroom", "classroom", "IT"),
  r("akb", 1, "869", "Lab-1", "lab", "IT"),
  r("akb", 1, "862", "Third Year IT B Classroom", "classroom", "IT"),
  r("akb", 1, "863", "Final Year IT A Section Classroom", "classroom", "IT"),
  r("akb", 1, "864", "Lab-2", "lab", "IT"),
  r("akb", 2, "870", "Boys Restroom", "restroom"),
  r("akb", 2, "865", "Staffroom-1, IT Department", "staffroom", "IT"),
  r("akb", 2, "866", "Staffroom-2, IT Department", "staffroom", "IT"),
  r("akb", 2, "867", "MBA Department Classroom", "classroom", "MBA"),
  // Kirloskar Block
  r("kir", 0, "LB1", "Mechanical Lab 1", "lab", "Mechanical"),
  r("kir", 0, "LB2", "Mechanical Lab 2", "lab", "Mechanical"),
  r("kir", 1, "251", "CSE-CS First Year A Classroom", "classroom", "CSE-CS"),
  r("kir", 1, "252", "CSE-CS First Year B Classroom", "classroom", "CSE-CS"),
  r("kir", 1, "253", "CSE-CS Second Year A Classroom", "classroom", "CSE-CS"),
  r("kir", 1, "COE", "COE Office", "office"),
  r("kir", 2, "DSR", "CSE-CS Staff Room", "staffroom", "CSE-CS"),
  r("kir", 2, "254", "CSE-CS Third Year A Classroom", "classroom", "CSE-CS"),
  r("kir", 2, "255", "CSE-CS Third Year A Classroom", "classroom", "CSE-CS"),
  r("kir", 2, "256", "CSE-CS Third Year B Classroom", "classroom", "CSE-CS"),
  r("kir", 2, "GR", "Girls Restroom", "restroom"),
  // Anna Auditorium
  r("anna", 0, "GR", "Girls Restroom", "restroom"),
  r("anna", 0, "1", "Thermal Lab", "lab", "Mechanical"),
  r("anna", 0, "2", "Mechanical Lab", "lab", "Mechanical"),
  r("anna", 0, "3", "EEE Lab", "lab", "EEE"),
  r("anna", 0, "AIDS Lab 1", "AIDS Lab 1", "lab", "AIDS"),
  r("anna", 1, "BR", "Boys Restroom", "restroom"),
  r("anna", 1, "D1", "Door 1", "door"),
  r("anna", 1, "D2", "Door 2", "door"),
  r("anna", 1, "D3", "Door 3", "door"),
  r("anna", 1, "AIDS Lab 2", "AIDS Lab 2", "lab", "AIDS"),
];

export const buildingById = (id: string) => BUILDINGS.find((b) => b.id === id)!;
export const floorLabel = (f: number) => (f === 0 ? "Ground floor" : f === 1 ? "First floor" : f === 2 ? "Second floor" : `Floor ${f}`);
