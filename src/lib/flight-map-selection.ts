import { findAirportByCode, isInternational } from "./airports";
import { inCourseFlights } from "./in-course-flights";
import type { AdminQueueRequest } from "./requests-mapper";
import type { InCourseFlight } from "@/components/admin/flight-path-map";

const MAX_FLIGHTS = 5;
const COMPLETED_STATUSES = new Set<AdminQueueRequest["status"]>(["approved", "confirmed"]);

function routeKey(originCode: string, destinationCode: string): string {
  return [originCode, destinationCode].sort().join("-");
}

interface CompletedCandidate {
  flight: InCourseFlight;
  routeKey: string;
  arrivalMs: number;
  international: boolean;
}

function completedCandidates(requests: AdminQueueRequest[], now: Date): CompletedCandidate[] {
  const candidates: CompletedCandidate[] = [];

  for (const request of requests) {
    if (!COMPLETED_STATUSES.has(request.status)) continue;

    request.selected_offer_snapshot.slices.forEach((slice, index) => {
      const departure = new Date(slice.departure_datetime);
      const arrival = new Date(slice.arrival_datetime);
      if (Number.isNaN(departure.getTime()) || Number.isNaN(arrival.getTime())) return;
      if (arrival.getTime() >= now.getTime()) return; // ainda não aterrissou

      const origin = findAirportByCode(slice.origin);
      const destination = findAirportByCode(slice.destination);
      if (!origin || !destination) return;

      candidates.push({
        flight: {
          id: `${request.id}:${index}`,
          employeeName: request.employeeName,
          origin: { code: origin.code, label: origin.label, lat: origin.lat, lng: origin.lng },
          destination: {
            code: destination.code,
            label: destination.label,
            lat: destination.lat,
            lng: destination.lng,
          },
          departureAt: slice.departure_datetime,
          arrivalAt: slice.arrival_datetime,
          status: "completed",
        },
        routeKey: routeKey(origin.code, destination.code),
        arrivalMs: arrival.getTime(),
        international: isInternational(destination.code),
      });
    });
  }

  return candidates;
}

function dedupeByRoute(
  candidates: CompletedCandidate[],
  excludeRouteKeys: Set<string>
): CompletedCandidate[] {
  const latestByRoute = new Map<string, CompletedCandidate>();

  for (const candidate of candidates) {
    if (excludeRouteKeys.has(candidate.routeKey)) continue;
    const existing = latestByRoute.get(candidate.routeKey);
    if (!existing || candidate.arrivalMs > existing.arrivalMs) {
      latestByRoute.set(candidate.routeKey, candidate);
    }
  }

  return [...latestByRoute.values()].sort((a, b) => b.arrivalMs - a.arrivalMs);
}

export function selectFlightsForMap(
  requests: AdminQueueRequest[],
  now: Date = new Date()
): InCourseFlight[] {
  const inCourse = inCourseFlights(requests).slice(0, MAX_FLIGHTS);
  const remainingSlots = MAX_FLIGHTS - inCourse.length;
  if (remainingSlots <= 0) return inCourse;

  const inCourseRouteKeys = new Set(
    inCourse.map((flight) => routeKey(flight.origin.code, flight.destination.code))
  );
  const completedPool = dedupeByRoute(completedCandidates(requests, now), inCourseRouteKeys);
  const chosenCompleted = completedPool.slice(0, remainingSlots);

  return [...inCourse, ...chosenCompleted.map((candidate) => candidate.flight)];
}
