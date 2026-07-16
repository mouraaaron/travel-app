"use client";

import { FlightPathMap, type InCourseFlight } from "@/components/admin/flight-path-map";

/** Three flights at different stages (~40% en route, just departed, about to
 * land) computed relative to load time, so the preview always shows live
 * in-progress motion no matter when `npm run dev` is started. Temporary —
 * removed once the admin-integration plan wires real Supabase data into
 * `/admin/page.tsx` instead. */
function buildMockFlights(): InCourseFlight[] {
  const now = Date.now();
  const hours = (n: number) => n * 60 * 60 * 1000;

  return [
    {
      id: "mock-1",
      employeeName: "Ana Ferreira",
      origin: { code: "GRU", label: "São Paulo (GRU)", lat: -23.4356, lng: -46.4731 },
      destination: { code: "LHR", label: "Londres (LHR)", lat: 51.47, lng: -0.4543 },
      departureAt: new Date(now - hours(4)).toISOString(),
      arrivalAt: new Date(now + hours(6)).toISOString(),
    },
    {
      id: "mock-2",
      employeeName: "Bruno Castro",
      origin: { code: "CWB", label: "Curitiba (CWB)", lat: -25.5285, lng: -49.1758 },
      destination: { code: "MIA", label: "Miami (MIA)", lat: 25.7959, lng: -80.287 },
      departureAt: new Date(now - 30_000).toISOString(),
      arrivalAt: new Date(now + hours(8) - 30_000).toISOString(),
    },
    {
      id: "mock-3",
      employeeName: "Carla Nunes",
      origin: { code: "JFK", label: "Nova York (JFK)", lat: 40.6413, lng: -73.7781 },
      destination: { code: "CDG", label: "Paris (CDG)", lat: 49.0097, lng: 2.5479 },
      departureAt: new Date(now - hours(7)).toISOString(),
      arrivalAt: new Date(now + 5 * 60 * 1000).toISOString(),
    },
  ];
}

export default function DevFlightMapPage() {
  const flights = buildMockFlights();

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold text-foreground">Dev preview — FlightPathMap</h1>
      <FlightPathMap flights={flights} />
      <h2 className="text-lg font-semibold text-foreground">Empty state</h2>
      <FlightPathMap flights={[]} />
    </div>
  );
}
