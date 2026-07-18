import type { EmployeeRole, EmployeeStatus, Sector } from "./badge-variants";
import type { TravelProfileFields } from "./onsite-weeks";

export interface Employee extends TravelProfileFields {
  id: string;
  full_name: string;
  email: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  cost_center: Sector;
  created_at: string;
}
