import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/admin-auth";
import { runDeliveryBackfill } from "@/worker/backfill-video-task-delivery";

export const runtime = "nodejs";
export const maxDuration = 120;

// ─── GET /api/cron/backfill-delivery ───────────────────

export async function GET(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runDeliveryBackfill();

  return NextResponse.json({
    data: { summary },
  });
}
