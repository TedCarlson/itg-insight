import { NextResponse } from "next/server";

import { getFeedWidgetPayload } from "@/features/home/lib/getWidgetPayload.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const items = await getFeedWidgetPayload();

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
