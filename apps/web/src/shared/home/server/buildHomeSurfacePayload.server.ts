import { buildHomeWidgetsForLayout } from "@/shared/widgets/server/buildHomeWidgetsForLayout.server";

import type { HomeSurfacePayload } from "../contracts/home.types";
import { resolveHomeLayout } from "../config/homeRegistry";
import { loadHomeUserContext } from "./loadHomeUserContext.server";
import { validateHomeLayout } from "./validateHomeLayout.server";

export async function buildHomeSurfacePayload(): Promise<HomeSurfacePayload> {
  const context = await loadHomeUserContext();

  const layout = validateHomeLayout(
    context.role,
    resolveHomeLayout(context.role),
  );

  const widgets = await buildHomeWidgetsForLayout(
    layout,
    context,
  );

  return {
    context,
    layout,
    widgets,
  };
}
