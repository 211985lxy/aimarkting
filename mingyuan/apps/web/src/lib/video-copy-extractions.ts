import type { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { analyzeVideoCopy } from "@/lib/video-copy-analysis"
import {
  assertSupportedVideoUrl,
  detectVideoPlatform,
  fetchVideoTextExtractionResult,
  formatVideoTextExtractionError,
  submitVideoTextExtractionTask,
} from "@/lib/video-text-extractor"

type VideoCopyExtractionRecord = NonNullable<
  Awaited<ReturnType<typeof prisma.videoCopyExtraction.findUnique>>
>

export interface ApiVideoCopyExtraction {
  id: string
  sourceUrl: string
  platform: string
  status: string
  errorMessage: string | null
  analysisError: string | null
  videoTitle: string | null
  videoCover: string | null
  videoDuration: string | null
  transcript: string | null
  analysisResult: unknown | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export function serializeVideoCopyExtraction(
  record: VideoCopyExtractionRecord
): ApiVideoCopyExtraction {
  return {
    id: record.id,
    sourceUrl: record.sourceUrl,
    platform: record.platform,
    status: record.status,
    errorMessage: record.errorMessage,
    analysisError: record.analysisError,
    videoTitle: record.videoTitle,
    videoCover: record.videoCover,
    videoDuration: record.videoDuration,
    transcript: record.transcript,
    analysisResult: record.analysisResult,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
  }
}

export async function createVideoCopyExtraction(
  userId: string,
  inputUrl: string
): Promise<VideoCopyExtractionRecord> {
  const sourceUrl = assertSupportedVideoUrl(inputUrl)
  const platform = detectVideoPlatform(sourceUrl)

  const record = await prisma.videoCopyExtraction.create({
    data: {
      userId,
      sourceUrl,
      platform,
      status: "queued",
    },
  })

  try {
    const task = await submitVideoTextExtractionTask(sourceUrl)
    return prisma.videoCopyExtraction.update({
      where: { id: record.id },
      data: {
        status: "extracting",
        providerBatchId: task.batchId,
        errorMessage: null,
      },
    })
  } catch (error) {
    return prisma.videoCopyExtraction.update({
      where: { id: record.id },
      data: {
        status: "failed",
        errorMessage: formatVideoTextExtractionError(error),
      },
    })
  }
}

export async function getVideoCopyExtractionForUser(
  userId: string,
  id: string
): Promise<VideoCopyExtractionRecord | null> {
  return prisma.videoCopyExtraction.findFirst({
    where: { id, userId },
  })
}

export async function syncVideoCopyExtraction(
  userId: string,
  id: string
): Promise<VideoCopyExtractionRecord | null> {
  const record = await getVideoCopyExtractionForUser(userId, id)
  if (!record) return null

  if (record.status === "completed" || (record.status === "failed" && !record.providerBatchId)) {
    return record
  }

  if (!record.providerBatchId) {
    return prisma.videoCopyExtraction.update({
      where: { id: record.id },
      data: {
        status: "failed",
        errorMessage: "文案提取任务不存在，请重新提交链接。",
      },
    })
  }

  if (!record.transcript) {
    try {
      const result = await fetchVideoTextExtractionResult(record.providerBatchId)
      if (result.status === "extracting") {
        return prisma.videoCopyExtraction.update({
          where: { id: record.id },
          data: { status: "extracting" },
        })
      }

      if (result.status === "failed") {
        return prisma.videoCopyExtraction.update({
          where: { id: record.id },
          data: {
            status: "failed",
            errorMessage: result.errorMessage ?? "该视频暂时无法提取文案，请换一个链接试试。",
          },
        })
      }

      await prisma.videoCopyExtraction.update({
        where: { id: record.id },
        data: {
          status: "analyzing",
          platform: result.platform ?? record.platform,
          videoTitle: result.title,
          videoCover: result.coverUrl,
          videoDuration: result.duration,
          transcript: result.transcript,
          providerTaskId: result.providerTaskId,
          errorMessage: null,
        },
      })
    } catch (error) {
      return prisma.videoCopyExtraction.update({
        where: { id: record.id },
        data: {
          status: "failed",
          errorMessage: formatVideoTextExtractionError(error),
        },
      })
    }
  }

  const latest = await getVideoCopyExtractionForUser(userId, id)
  if (!latest?.transcript) return latest
  if (latest.analysisResult) return latest

  try {
    const analysis = await analyzeVideoCopy({
      title: latest.videoTitle,
      platform: latest.platform,
      transcript: latest.transcript,
    })

    return prisma.videoCopyExtraction.update({
      where: { id: latest.id },
      data: {
        status: "completed",
        analysisResult: analysis as unknown as Prisma.InputJsonValue,
        analysisError: null,
        errorMessage: null,
        completedAt: new Date(),
      },
    })
  } catch {
    return prisma.videoCopyExtraction.update({
      where: { id: latest.id },
      data: {
        status: "completed",
        analysisError: "文案已提取，结构化分析暂时失败，请稍后重试。",
        completedAt: new Date(),
      },
    })
  }
}
