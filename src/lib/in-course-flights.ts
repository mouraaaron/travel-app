import { findAirportByCode } from "./airports";
import type { AdminQueueRequest } from "./requests-mapper";
import type { InCourseFlight } from "@/components/admin/flight-path-map";

export function inCourseFlights(requests: AdminQueueRequest[]): InCourseFlight[] {
  const now = new Date();
  const flights: InCourseFlight[] = [];

  for (const request of requests) {
    if (request.status !== "approved") continue;

    request.selected_offer_snapshot.slices.forEach((slice, index) => {
      const departure = new Date(slice.departure_datetime);
      const arrival = new Date(slice.arrival_datetime);
      if (Number.isNaN(departure.getTime()) || Number.isNaN(arrival.getTime())) return;
      if (now < departure || now > arrival) return;

      const origin = findAirportByCode(slice.origin);
      const destination = findAirportByCode(slice.destination);
      if (!origin || !destination) return;

      flights.push({
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
        status: "in_course",
      });
    });
  }

  return flights;
}
