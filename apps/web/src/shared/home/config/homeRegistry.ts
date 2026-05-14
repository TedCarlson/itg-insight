import type { AppRole } from "@/shared/navigation/types";
import type { HomeLayoutConfig } from "../contracts/home.types";
import { managerHomeDefault } from "./managerHomeDefault";
import { supervisorHomeDefault } from "./supervisorHomeDefault";

const HOME_LAYOUTS: Partial<Record<AppRole, HomeLayoutConfig>> = {
  COMPANY_MANAGER: managerHomeDefault,
  ITG_SUPERVISOR: supervisorHomeDefault,
};

export function resolveHomeLayout(role: AppRole): HomeLayoutConfig {
  return HOME_LAYOUTS[role] ?? managerHomeDefault;
}
