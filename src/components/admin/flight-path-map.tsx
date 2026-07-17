"use client";

import { useEffect, useId, useMemo, useState } from "react";
import DottedMap from "dotted-map";
import { motion, useReducedMotion } from "framer-motion";
import { Plane } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDateTime } from "@/lib/offer-format";
import {
  bezierPointAt,
  curvedPath,
  curveControlPoint,
  FLIGHT_MAP_PROJECTION,
  FLIGHT_MAP_REGION,
  flightProgress,
  flightTimingSeconds,
  projectPoint,
} from "@/lib/flight-map-geometry";
import { isInternationalRoute } from "@/lib/airports";

export interface InCourseFlight {
  id: string;
  employeeName: string;
  origin: { code: string; label: string; lat: number; lng: number };
  destination: { code: string; label: string; lat: number; lng: number };
  departureAt: string;
  arrivalAt: string;
  status: "in_course" | "completed";
}

const FLIGHT_COLOR: Record<InCourseFlight["status"], string> = {
  in_course: "#0ea5e9",
  completed: "#94a3b8",
};

// Path copied from node_modules/lucide-react/dist/esm/icons/plane.mjs — viewBox 24x24.
// Copied as a raw string (not imported as a React component) so it can be driven
// by SMIL <animateMotion> directly inside the map's <svg>.
const PLANE_ICON_PATH =
  "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z";

// Lucide's Plane glyph is authored pointing toward the upper-right at rest, not
// along +x. animateMotion's rotate="auto" already orients the element along the
// curve's tangent assuming a resting orientation of "pointing along +x" (that's
// why the domestic chevron below is drawn pointing along +x with no rotation
// offset). This constant corrects the mismatch; tune it in Step 5's manual check
// if the nose doesn't visibly point along the direction of travel.
const PLANE_ICON_ROTATION_OFFSET_DEG = -45;

// Scales the 24x24 lucide glyph down into the map's 800x400 unit space, landing
// at roughly the same visual weight as an international curve can support
// (~14 units wide). Tune in Step 5's manual check together with the rotation offset.
const PLANE_ICON_SCALE = 0.6;

function generateDottedMapSvg(): string {
  // Projection/region must match `projectPoint`'s linear equirectangular
  // math (see flight-map-geometry.ts) or dotted-map's default Mercator
  // projection (cropped to lat [-56, 71]) makes flight routes land in the
  // ocean — see FLIGHT_MAP_PROJECTION's doc comment for the full story.
  const map = new DottedMap({
    height: 100,
    grid: "diagonal",
    projection: FLIGHT_MAP_PROJECTION,
    region: FLIGHT_MAP_REGION,
  });
  return map.getSVG({
    radius: 0.22,
    color: "#00000040",
    shape: "circle",
    backgroundColor: "white",
  });
}

export function FlightPathMap({ flights }: { flights: InCourseFlight[] }) {
  const shouldReduceMotion = useReducedMotion();
  const gradientId = useId();
  const svgMap = useMemo(generateDottedMapSvg, []);
  // `now` reads the wall clock, so it must NOT be computed during the
  // server render (or during the client's first pre-hydration render) —
  // either would make the server HTML and the client's initial render
  // disagree, causing a hydration mismatch. Instead, it starts `null`
  // (identical on server and first client render) and is populated once,
  // client-side only, right after mount. It is still shared by every
  // flight's progress/timing math below — not per-flight `new Date()`
  // calls — and is never re-computed on a timer (the plane's continued
  // motion after this point is handled by the browser via SMIL, not by
  // React re-rendering).
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Viagens em curso</CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={100}>
          <div className="relative aspect-[2/1] w-full overflow-hidden rounded-md bg-white">
            <img
              src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMap)}`}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full select-none"
              draggable={false}
            />
            <svg viewBox="0 0 800 400" className="absolute inset-0 h-full w-full">
              <defs>
                {(["in_course", "completed"] as const).map((status) => (
                  <linearGradient
                    key={status}
                    id={`${gradientId}-${status}`}
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="0%" stopColor="white" stopOpacity="0" />
                    <stop offset="5%" stopColor={FLIGHT_COLOR[status]} stopOpacity="1" />
                    <stop offset="95%" stopColor={FLIGHT_COLOR[status]} stopOpacity="1" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                  </linearGradient>
                ))}
              </defs>
              {now && flights.map((flight, index) => {
                const start = projectPoint(flight.origin.lat, flight.origin.lng);
                const end = projectPoint(flight.destination.lat, flight.destination.lng);
                const control = curveControlPoint(start, end);
                const path = curvedPath(start, end);
                const progress = flightProgress(flight.departureAt, flight.arrivalAt, now);
                const { durationSeconds, beginOffsetSeconds } = flightTimingSeconds(
                  flight.departureAt,
                  flight.arrivalAt,
                  now
                );
                const staticPlanePoint = bezierPointAt(progress, start, control, end);
                const color = FLIGHT_COLOR[flight.status];
                // Plane icon is reserved for in-course international flights only —
                // completed flights (any route) keep the plain chevron.
                const showPlaneIcon =
                  isInternationalRoute(flight.origin.code, flight.destination.code) &&
                  flight.status === "in_course";

                return (
                  <g key={flight.id}>
                    <motion.path
                      d={path}
                      fill="none"
                      stroke={`url(#${gradientId}-${flight.status})`}
                      strokeWidth={1}
                      initial={shouldReduceMotion ? false : { pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 1, delay: 0.3 * index, ease: "easeOut" }}
                    />
                    {[start, end].map((point, endpointIndex) => (
                      <g key={endpointIndex}>
                        <circle cx={point.x} cy={point.y} r={2} fill={color} />
                        <circle cx={point.x} cy={point.y} r={2} fill={color} opacity={0.5}>
                          {!shouldReduceMotion && (
                            <>
                              <animate
                                attributeName="r"
                                from="2"
                                to="8"
                                dur="1.5s"
                                begin="0s"
                                repeatCount="indefinite"
                              />
                              <animate
                                attributeName="opacity"
                                from="0.5"
                                to="0"
                                dur="1.5s"
                                begin="0s"
                                repeatCount="indefinite"
                              />
                            </>
                          )}
                        </circle>
                      </g>
                    ))}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <g
                          transform={
                            shouldReduceMotion
                              ? `translate(${staticPlanePoint.x} ${staticPlanePoint.y})`
                              : undefined
                          }
                          className="cursor-default"
                        >
                          {/* Small chevron drawn pointing along +x; SMIL's rotate="auto"
                              (or the static transform above, under reduced motion) orients
                              it along the curve's direction of travel. */}
                          {showPlaneIcon ? (
                            <path
                              d={PLANE_ICON_PATH}
                              fill={color}
                              transform={`scale(${PLANE_ICON_SCALE}) rotate(${PLANE_ICON_ROTATION_OFFSET_DEG}) translate(-12, -12)`}
                            >
                              {!shouldReduceMotion && (
                                <animateMotion
                                  path={path}
                                  dur={`${durationSeconds}s`}
                                  begin={`${beginOffsetSeconds}s`}
                                  fill="freeze"
                                  rotate="auto"
                                />
                              )}
                            </path>
                          ) : (
                            <polygon points="-4,-2.5 4,0 -4,2.5 -2,0" fill={color}>
                              {!shouldReduceMotion && (
                                <animateMotion
                                  path={path}
                                  dur={`${durationSeconds}s`}
                                  begin={`${beginOffsetSeconds}s`}
                                  fill="freeze"
                                  rotate="auto"
                                />
                              )}
                            </polygon>
                          )}
                        </g>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{flight.employeeName}</p>
                        <p>
                          {flight.origin.label} → {flight.destination.label}
                        </p>
                        <p>Partida: {formatDateTime(flight.departureAt)}</p>
                        <p>Chegada: {formatDateTime(flight.arrivalAt)}</p>
                        {flight.status === "completed" && (
                          <p className="text-muted-foreground">Concluído</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </g>
                );
              })}
            </svg>
            {flights.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <EmptyState
                  title="Nenhuma viagem em curso no momento"
                  icon={Plane}
                  size="small"
                  className="border-none bg-white/85"
                />
              </div>
            )}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
