export type TravelMode = "flight" | "stay";

export type CabinClass = "economy" | "premium_economy" | "business" | "first";

export interface FlightOffer {
  id: string;
  mode: "flight";
  origin: string;
  destination: string;
  destinationCountry: string;
  departureAt: string;
  returnAt?: string;
  cabinClass: CabinClass;
  airline: string;
  stops: number;
  refundable: boolean;
  totalAmount: number;
  currency: string;
}

export interface StayOffer {
  id: string;
  mode: "stay";
  city: string;
  country: string;
  checkIn: string;
  checkOut: string;
  hotelName: string;
  starRating: number;
  refundable: boolean;
  totalAmount: number;
  currency: string;
}

export type Offer = FlightOffer | StayOffer;

export type PolicyOperator = "lte" | "gte" | "eq" | "in" | "not_in";

export interface PolicyRule {
  id: string;
  field: string;
  operator: PolicyOperator;
  value: number | string | boolean | string[];
  appliesTo: "flight" | "stay" | "both";
  description: string;
}

export interface Policy {
  id: string;
  scope: "organization" | "department" | "individual";
  name: string;
  rules: PolicyRule[];
}

export type PolicyFlag = "international" | "cost_above_threshold";

export interface PolicyEvaluation {
  compliant: boolean;
  violations: PolicyRule[];
  flags: PolicyFlag[];
}

export type RequestStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "needs_review"
  | "confirmed";

export interface TripRequest {
  id: string;
  createdAt: string;
  offer: Offer;
  evaluation: PolicyEvaluation;
  status: RequestStatus;
  justification?: string;
}
