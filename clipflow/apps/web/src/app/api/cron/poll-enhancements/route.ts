import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/admin-auth";
import { runEnhancementRecoveryPass } from "@/lib/task-recovery";

export const runtime = "nodejs";
export const maxDuration = 60;

// --- GET /api/cron/poll-enhancements ---

export async function GET(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runEnhancementRecoveryPass({ trigger: "cron" });

  return NextResponse.json({
    data: {
      polled: result,
    },
  });
}
