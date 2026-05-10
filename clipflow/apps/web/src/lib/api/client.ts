"use client"

import { useAuthStore } from "@/lib/store"
import { getStoredAuthToken } from "@/lib/auth-storage"
import type { HotTopic } from "@/types/content-template"
import type {
  ApiAsset,
  ApiAvatar,
  ApiContentGenerationRun,
  ApiHotTopicFit,
  ApiHotTopicInsight,
  ApiIpProfile,
  ApiPublicAssetVoice,
  ApiPublicVirtualman,
  ApiPublicAvatarPreviewDefaults,
  ApiPublicAvatarPreview,
  ApiScript,
  ApiUser,
  ApiVideoTask,
  ApiVideoPackagingTemplate,
  ApiVideoProductionPlan,
  ApiVideoStructure,
  AuthResponse,
  ApiPackagingRecommendationContext,
  BackgroundMusicSelection,
  MaterialAssignment,
  HotTopicsResponse,
  IpProfileResponse,
  PaginatedResponse,
  PackagingMaterialSuggestionsResponse,
  PublicTemplateDetail,
  PublicTemplateListItem,
  GeneratePositioningRequest,
  GeneratePositioningResponse,
  ApiTopicGenerateResponse,
  ApiTopicSelectResponse,
  ApiOpeningType,
  ApiCopyStructure,
  ApiEndingType,
  ApiCompetitorAnalysis,
  ApiCompetitorReport,
  CompetitorReportsResponse,
} from "@/types/api"

class ApiError extends Error {
  status: number
  details: unknown

  constructor(message: string, status: number, details: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.details = details
  }
}

type RequestOptions = RequestInit & {
  auth?: boolean
  timeout?: number // timeout in milliseconds
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, headers, timeout, ...init } = options
  const token = auth
    ? useAuthStore.getState().token || getStoredAuthToken()
    : null

  // Add timeout support using AbortController
  const controller = new AbortController()
  const timeoutId = timeout
    ? setTimeout(() => controller.abort(), timeout)
    : null

  try {
    const response = await fetch(path, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers ?? {}),
      },
    })

    if (timeoutId) clearTimeout(timeoutId)

    const payload = await response
      .json()
      .catch(() => null)

    if (!response.ok) {
      if (response.status === 401) {
        useAuthStore.getState().clearSession()
      }

      throw new ApiError(
        typeof payload?.error === "string" ? payload.error : `Request failed: ${response.status}`,
        response.status,
        payload
      )
    }

    return payload as T
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId)

    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(
        "请求超时，请检查网络连接或稍后重试",
        408,
        { code: "TIMEOUT", originalPath: path }
      )
    }
    throw error
  }
}

export { ApiError }

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/login", {
    auth: false,
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
}

export async function registerUser(input: {
  email: string
  password: string
  name: string
}): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/register", {
    auth: false,
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function getCurrentUser(): Promise<ApiUser> {
  const payload = await request<{ user: ApiUser }>("/api/auth/me")
  return payload.user
}

export async function activateUser(code: string): Promise<ApiUser> {
  const payload = await request<{ user: ApiUser }>("/api/auth/activate", {
    method: "POST",
    body: JSON.stringify({ code }),
  })
  return payload.user
}

export async function saveAuthVideo(authVideoUrl: string): Promise<ApiUser> {
  const payload = await request<{ user: ApiUser }>("/api/auth/auth-video", {
    method: "POST",
    body: JSON.stringify({ authVideoUrl }),
  })
  return payload.user
}

export async function getIpProfile(): Promise<IpProfileResponse> {
  const payload = await request<{ data: IpProfileResponse }>("/api/ip-profile")
  return payload.data
}

export async function upsertIpProfile(
  input: Partial<ApiIpProfile>
): Promise<IpProfileResponse> {
  const payload = await request<{ data: IpProfileResponse }>("/api/ip-profile", {
    method: "PUT",
    body: JSON.stringify(input),
  })
  return payload.data
}

export async function generatePositioning(
  input: GeneratePositioningRequest
): Promise<GeneratePositioningResponse> {
  const response = await request<GeneratePositioningResponse>("/api/ip-profile/generate-positioning", {
    method: "POST",
    body: JSON.stringify(input),
    timeout: 45000, // 45 second timeout for LLM positioning generation (retry may extend)
  })
  if (!response?.data?.business || !response?.data?.persona || !response?.data?.content) {
    throw new ApiError("AI 生成结果结构不完整，请重试", 500, response)
  }
  return response
}

export async function aiFillIpProfile(input: {
  userInput: string
}): Promise<{ filledFields: Record<string, string> }> {
  const payload = await request<{ data: { filledFields: Record<string, string> } }>(
    "/api/ip-profile/ai-fill",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  )
  return payload.data
}

export async function listHotTopics(): Promise<HotTopicsResponse> {
  const payload = await request<{ data: HotTopicsResponse }>("/api/hot-topics", {
    auth: false,
  })
  return payload.data
}

export async function getHotTopicInsight(input: {
  topicId: string
}): Promise<{ topic: HotTopic; insight: ApiHotTopicInsight }> {
  const payload = await request<{
    data: { topic: HotTopic; insight: ApiHotTopicInsight }
  }>(`/api/hot-topics/${encodeURIComponent(input.topicId)}/insight`)
  return payload.data
}

export async function getHotTopicFit(input: {
  topicId: string
  templateId: string
  structureId: string
  inputs: Record<string, string>
}): Promise<{
  topic: HotTopic
  insight: ApiHotTopicInsight
  fit: ApiHotTopicFit
}> {
  const payload = await request<{
    data: {
      topic: HotTopic
      insight: ApiHotTopicInsight
      fit: ApiHotTopicFit
    }
  }>(`/api/hot-topics/${encodeURIComponent(input.topicId)}/fit`, {
    method: "POST",
    body: JSON.stringify({
      templateId: input.templateId,
      structureId: input.structureId,
      inputs: input.inputs,
    }),
  })
  return payload.data
}

export async function listTemplates(): Promise<PaginatedResponse<PublicTemplateListItem>> {
  const payload = await request<{ data: PaginatedResponse<PublicTemplateListItem> }>("/api/templates")
  return payload.data
}

export async function listStructures(): Promise<ApiVideoStructure[]> {
  const payload = await request<{ data: ApiVideoStructure[] }>("/api/structures")
  return payload.data
}

export async function getTemplate(id: string): Promise<PublicTemplateDetail> {
  const payload = await request<{ data: PublicTemplateDetail }>(`/api/templates/${id}`)
  return payload.data
}

export async function getPublicAssets(): Promise<{
  voices: ApiPublicAssetVoice[]
  virtualmen: ApiPublicVirtualman[]
}> {
  const payload = await request<{
    data: {
      voices: ApiPublicAssetVoice[]
      virtualmen: ApiPublicVirtualman[]
    }
  }>("/api/public-assets", {
    auth: false,
  })
  return payload.data
}

export async function aiFillBrief(input: {
  templateId: string
  userInput?: string
}): Promise<{ filledInputs: Record<string, string> }> {
  const payload = await request<{ data: { filledInputs: Record<string, string> } }>(
    "/api/brief/ai-fill",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  )
  return payload.data
}

export async function generateScripts(input: {
  templateId: string
  inputs: Record<string, string>
  structureId: string
  hotTopicId?: string | null
  hotTopic?: string | null
  topicSelectionId?: string | null
  openingTypeCode?: string | null
  copyStructureCode?: string | null
  endingTypeCode?: string | null
}): Promise<{ run: ApiContentGenerationRun; scripts: ApiScript[]; isDegraded?: boolean }> {
  const payload = await request<{ data: { run: ApiContentGenerationRun; scripts: ApiScript[]; isDegraded?: boolean } }>(
    "/api/scripts/generate",
    {
      method: "POST",
      body: JSON.stringify(input),
      timeout: 120000, // 120 second timeout for LLM operations (matches server maxDuration)
    }
  )
  return payload.data
}

export async function updateScript(
  id: string,
  input: { content?: string; status?: string }
): Promise<ApiScript> {
  const payload = await request<{ data: ApiScript }>(`/api/scripts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
  return payload.data
}

export async function listAvatars(): Promise<ApiAvatar[]> {
  const payload = await request<{ data: PaginatedResponse<ApiAvatar> }>("/api/avatars?page=1&pageSize=100")
  return payload.data.results
}

export async function createAvatar(input: Record<string, unknown>): Promise<ApiAvatar> {
  const payload = await request<{ data: ApiAvatar }>("/api/avatars", {
    method: "POST",
    body: JSON.stringify(input),
    timeout: 15000, // 15 second timeout for avatar creation submission
  })
  return payload.data
}

export async function retryAvatar(id: string): Promise<ApiAvatar> {
  const payload = await request<{ data: ApiAvatar }>(`/api/avatars/${id}/retry`, {
    method: "POST",
    timeout: 15000,
  })
  return payload.data
}

export async function deleteAvatar(id: string): Promise<void> {
  await request(`/api/avatars/${id}`, {
    method: "DELETE",
  })
}

export async function listAssets(
  assetType?: "image" | "video" | "music"
): Promise<ApiAsset[]> {
  const search = new URLSearchParams({
    page: "1",
    pageSize: "100",
  })
  if (assetType) {
    search.set("assetType", assetType)
  }

  const payload = await request<{ data: PaginatedResponse<ApiAsset> }>(`/api/assets?${search.toString()}`)
  return payload.data.results
}

export async function createAssetUploadUrl(fileName: string, contentType: string) {
  const payload = await request<{ data: { uploadUrl: string; assetUrl: string; expiresAt: string } }>(
    "/api/assets/upload-url",
    {
      method: "POST",
      body: JSON.stringify({ fileName, contentType }),
    }
  )

  return payload.data
}

export async function uploadFileToStorage(file: File) {
  const signed = await createAssetUploadUrl(file.name, file.type || "application/octet-stream")
  const upload = await fetch(signed.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  })

  if (!upload.ok) {
    throw new ApiError("Failed to upload file", upload.status, null)
  }

  return signed.assetUrl
}

export async function registerAsset(input: {
  name: string
  assetType: string
  url: string
  size?: number | null
}): Promise<ApiAsset> {
  const payload = await request<{ data: ApiAsset }>("/api/assets", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return payload.data
}

export async function deleteAsset(id: string): Promise<void> {
  await request(`/api/assets/${id}`, {
    method: "DELETE",
  })
}

export async function listVideoTasks(): Promise<ApiVideoTask[]> {
  const payload = await request<{ data: PaginatedResponse<ApiVideoTask> }>("/api/tasks?page=1&pageSize=100")
  return payload.data.results
}

export async function getVideoTask(id: string): Promise<ApiVideoTask> {
  const payload = await request<{ data: ApiVideoTask }>(`/api/tasks/${id}`)
  return payload.data
}

export async function createVideoTask(input: Record<string, unknown>): Promise<ApiVideoTask> {
  const payload = await request<{ data: ApiVideoTask }>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return payload.data
}

export async function getVideoTaskRetryPayload(id: string): Promise<{ retryPayload: Record<string, unknown>; originalTaskId: string }> {
  const payload = await request<{ data: { retryPayload: Record<string, unknown>; originalTaskId: string } }>(`/api/tasks/${id}/retry`, {
    method: "POST",
  })
  return payload.data
}

export async function createPublicAvatarPreview(input: {
  virtualmanId: string
  speakerId: string
  text: string
}): Promise<ApiPublicAvatarPreview> {
  const payload = await request<{ data: ApiPublicAvatarPreview }>(
    "/api/public-avatar-previews",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  )
  return payload.data
}

export async function getPublicAvatarPreview(taskId: string): Promise<ApiPublicAvatarPreview> {
  const payload = await request<{ data: ApiPublicAvatarPreview }>(
    `/api/public-avatar-previews/${taskId}`
  )
  return payload.data
}

export async function getPublicAvatarPreviewDefaults(
  virtualmanId: string
): Promise<ApiPublicAvatarPreviewDefaults> {
  const payload = await request<{ data: ApiPublicAvatarPreviewDefaults }>(
    `/api/public-avatar-previews?virtualmanId=${encodeURIComponent(virtualmanId)}`
  )
  return payload.data
}

export async function listPackagingTemplates(input?: {
  scene?: string
  structureId?: string | null
  scriptId?: string | null
}): Promise<ApiVideoPackagingTemplate[]> {
  const search = new URLSearchParams()
  if (input?.scene) {
    search.set("scene", input.scene)
  }
  if (input?.structureId) {
    search.set("structureId", input.structureId)
  }
  if (input?.scriptId) {
    search.set("scriptId", input.scriptId)
  }
  const url = search.size > 0 ? `/api/packaging-templates?${search.toString()}` : "/api/packaging-templates"
  const payload = await request<{ data: ApiVideoPackagingTemplate[] }>(url)
  return payload.data
}

export async function syncPackagingTemplates(): Promise<{ synced: number }> {
  const payload = await request<{ data: { synced: number } }>("/api/packaging-templates/sync", {
    method: "POST",
  })
  return payload.data
}

export async function createProductionPlan(input: {
  scriptId: string
  contentTemplateId?: string
  packagingTemplateId?: string
  structureId?: string
  styleId?: string
  materials?: MaterialAssignment[]
  backgroundMusic?: BackgroundMusicSelection
  packRules?: Record<string, unknown>
  processRules?: Record<string, unknown>
  recommendationContext?: ApiPackagingRecommendationContext | null
  videoType?: string
}): Promise<ApiVideoProductionPlan> {
  const payload = await request<{ data: ApiVideoProductionPlan }>("/api/production-plans", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return payload.data
}

export async function listProductionPlans(): Promise<ApiVideoProductionPlan[]> {
  const payload = await request<{ data: { results: ApiVideoProductionPlan[] } }>("/api/production-plans")
  return payload.data.results
}

export async function generatePackagingMaterialSuggestions(input: {
  scriptId: string
  structureId?: string
  scriptContentDraft?: string
  packagingTemplateId: string
  existingItems?: MaterialAssignment[]
  maxCount?: number
}): Promise<PackagingMaterialSuggestionsResponse> {
  const payload = await request<{ data: PackagingMaterialSuggestionsResponse }>(
    "/api/packaging-material-suggestions",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  )
  return payload.data
}

export async function getPexelsMedia(pexelsId: number, provider: "pexels" | "pixabay" = "pexels") {
  const qs = provider === "pixabay" ? `?provider=pixabay` : "";
  const payload = await request<{
    data: {
      ossStatus: string
      ossUrl: string | null
      srcJson?: unknown
      imageUrl?: string | null
      videoPicturesJson?: unknown
    }
  }>(`/api/pexels/media/${pexelsId}${qs}`)
  return payload.data
}

// ─── Topic Engine (v5.0) ─────────────────────────────────

export async function generateTopics(
  elementCodes?: string[],
  refreshCount?: number,
): Promise<ApiTopicGenerateResponse> {
  const body: Record<string, unknown> = {}
  if (elementCodes) body.elementCodes = elementCodes
  if (typeof refreshCount === "number") body.refreshCount = refreshCount
  const payload = await request<{ data: ApiTopicGenerateResponse }>(
    "/api/topics/generate",
    {
      method: "POST",
      body: JSON.stringify(body),
      timeout: 30000,
    }
  )
  return payload.data
}

export async function selectTopic(
  topicSelectionId: string,
  selectedIndex: number
): Promise<ApiTopicSelectResponse> {
  const payload = await request<{ data: ApiTopicSelectResponse }>(
    `/api/topics/${topicSelectionId}/select`,
    {
      method: "POST",
      body: JSON.stringify({ selectedIndex }),
    }
  )
  return payload.data
}

export async function listOpeningTypes(): Promise<ApiOpeningType[]> {
  const payload = await request<{ data: ApiOpeningType[] }>("/api/topics/opening-types")
  return payload.data
}

export async function listCopyStructures(): Promise<ApiCopyStructure[]> {
  const payload = await request<{ data: ApiCopyStructure[] }>("/api/topics/copy-structures")
  return payload.data
}

export async function listEndingTypes(): Promise<ApiEndingType[]> {
  const payload = await request<{ data: ApiEndingType[] }>("/api/topics/ending-types")
  return payload.data
}

// ─── Competitor Analysis (v5.0) ──────────────────────────

export async function startCompetitorAnalysis(url: string): Promise<{
  id: string
  status: string
  platform: string
}> {
  return request<{ id: string; status: string; platform: string }>(
    "/api/competitor/analyze",
    {
      method: "POST",
      body: JSON.stringify({ url }),
      timeout: 10000,
    }
  )
}

export async function getCompetitorAnalysis(id: string): Promise<ApiCompetitorAnalysis> {
  return request<ApiCompetitorAnalysis>(`/api/competitor/${id}`)
}

export async function listCompetitorReports(
  page = 1,
  limit = 10
): Promise<CompetitorReportsResponse> {
  return request<CompetitorReportsResponse>(
    `/api/competitor/reports?page=${page}&limit=${limit}`
  )
}

export async function deleteCompetitorAnalysis(id: string): Promise<void> {
  await request(`/api/competitor/${id}`, { method: "DELETE" })
}
