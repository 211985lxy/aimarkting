import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import {
  settleEnhancementSuccess,
  settleEnhancementFailure,
} from "@/lib/video-task-enhancement";
import { getEnhancementJobResult } from "@/lib/aliyun-enhancement";

export const runtime = "nodejs";
export const maxDuration = 60;

type WebhookPayload = {
  jobId: string;
  status: "PROCESS_SUCCESS" | "PROCESS_FAIL" | string;
  result?: {
    videoUrl?: string;
  };
  errorCode?: string;
  errorMessage?: string;
};

export async function POST(request: NextRequest) {
  let payload: WebhookPayload;
  try {
    payload = (await request.json()) as WebhookPayload;
  } catch {
    console.warn("[webhook:aliyun-enhancement] Payload parse failed");
    return NextResponse.json({ ok: true });
  }

  const { jobId, status } = payload;

  if (!jobId) {
    console.warn("[webhook:aliyun-enhancement] Webhook received without jobId");
    return NextResponse.json({ ok: true });
  }

  // Redis dedup: SET NX with 24h expiry.
  // CRITICAL: Namespace key as "webhook:enhancement:" to avoid collision with
  // Shanjian webhook keys which use "webhook:" prefix.
  try {
    const set = await redis.set(
      `webhook:enhancement:${jobId}`,
      "1",
      "EX",
      86400,
      "NX",
    );
    if (!set) {
      console.info(
        `[webhook:aliyun-enhancement] Duplicate webhook for jobId=${jobId}, skipping`,
      );
      return NextResponse.json({ ok: true });
    }
  } catch (error) {
    console.warn(
      `[webhook:aliyun-enhancement] Redis dedup failed for jobId=${jobId}, continuing`,
    );
  }

  try {
    // Find video task by enhancement job ID
    const videoTask = await prisma.videoTask.findFirst({
      where: { enhancementJobId: jobId },
    });

    if (!videoTask) {
      console.warn(
        `[webhook:aliyun-enhancement] No video task found for jobId=${jobId}`,
      );
      return NextResponse.json({ ok: true });
    }

    if (status === "PROCESS_SUCCESS") {
      // Poll Aliyun API to get full result — webhook payload may not include videoUrl
      const result = await getEnhancementJobResult(jobId);
      if (!result.videoUrl) {
        console.warn(
          `[webhook:aliyun-enhancement] Success webhook for ${videoTask.id} but no videoUrl in API result`,
        );
        await settleEnhancementFailure({
          taskId: videoTask.id,
          errorCode: "MISSING_VIDEO_URL",
          errorMessage:
            "Enhancement completed but no video URL returned from API",
        });
        return NextResponse.json({ ok: true });
      }

      await settleEnhancementSuccess({
        taskId: videoTask.id,
        temporaryVideoUrl: result.videoUrl,
      });
    } else if (status === "PROCESS_FAIL") {
      await settleEnhancementFailure({
        taskId: videoTask.id,
        errorCode: payload.errorCode ?? "ENHANCEMENT_FAILED",
        errorMessage:
          payload.errorMessage ?? "Enhancement processing failed",
      });
    }
    // else: unknown status — ignore silently, polling will catch it
  } catch (error) {
    console.error(
      `[webhook:aliyun-enhancement] Processing failed for jobId=${jobId}:`,
      error,
    );
  }

  // Always return 200 to prevent Aliyun from retrying
  return NextResponse.json({ ok: true });
}
