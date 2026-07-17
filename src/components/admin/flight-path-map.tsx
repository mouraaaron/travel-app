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
  flightProgress,
  flightTimingSeconds,
  projectPoint,
} from "@/lib/flight-map-geometry";

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

function generateDottedMapSvg(): string {
  const map = new DottedMap({ height: 100, grid: "diagonal" });
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
