import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, authErrorResponse } from "@/lib/user-auth"
import { transcribeAudioWav } from "@/lib/aliyun-asr"

export async function POST(request: NextRequest) {
  try {
    // 1. 鉴权
    await authenticateRequest(request)

    // 2. 提取音频 Buffer
    let audioBuffer: Buffer | null = null
    const contentType = request.headers.get("content-type") || ""

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      const file = formData.get("file") as File | null
      if (file) {
        const arrayBuffer = await file.arrayBuffer()
        audioBuffer = Buffer.from(arrayBuffer)
      }
    } else {
      // 默认按 application/octet-stream 或者是 binary 直接流处理
      const arrayBuffer = await request.arrayBuffer()
      audioBuffer = Buffer.from(arrayBuffer)
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return NextResponse.json({ error: "未接收到有效的音频文件数据" }, { status: 400 })
    }

    // 3. 转写
    const hasAliyun =
      (process.env.ALIYUN_VIAPI_ACCESS_KEY_ID || process.env.OSS_ACCESS_KEY_ID) &&
      (process.env.ALIYUN_VIAPI_ACCESS_KEY_SECRET || process.env.OSS_ACCESS_KEY_SECRET) &&
      process.env.ALIYUN_NLS_APP_KEY

    if (!hasAliyun) {
      console.warn("[aim/transcribe] 阿里云语音交互配置缺失，请检查环境变量 ALIYUN_NLS_APP_KEY 等。")
      return NextResponse.json(
        { error: "语音转写服务未配置，请联系管理员配置阿里云 ASR 环境变量" },
        { status: 503 }
      )
    }

    try {
      const text = await transcribeAudioWav(audioBuffer)
      return NextResponse.json({ text })
    } catch (asrError) {
      console.error("[aim/transcribe] Aliyun ASR Error:", asrError)
      return NextResponse.json(
        { error: asrError instanceof Error ? asrError.message : "语音识别失败" },
        { status: 502 } // 网关错误（阿里云调用失败）
      )
    }
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse

    console.error("[aim/transcribe] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "服务端转写失败" },
      { status: 500 }
    )
  }
}
