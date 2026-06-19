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
  PaginatedResponse,
  PackagingMaterialSuggestionsResponse,
  PublicTemplateDetail,
  PublicTemplateListItem,
  ApiTopicGenerateResponse,
  ApiTopicSelectResponse,
  ApiOpeningType,
  ApiCopyStructure,
  ApiEndingType,
  ApiCompetitorAnalysis,
  CompetitorReportsResponse,
  ApiAiHotBriefing,
  ApiVideoCopyExtraction,
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


export async function listHotTopics(input?: { source?: string }): Promise<HotTopicsResponse> {
  const url = input?.source ? `/api/hot-topics?source=${encodeURIComponent(input.source)}` : "/api/hot-topics"
  const payload = await request<{ data: HotTopicsResponse }>(url, {
    auth: false,
  })
  return payload.data
}

export async function getTodayAiHotBriefing(): Promise<ApiAiHotBriefing> {
  const payload = await request<{ data: ApiAiHotBriefing }>("/api/aihot-briefing/today")
  return payload.data
}

export async function refreshTodayAiHotBriefing(): Promise<ApiAiHotBriefing> {
  const payload = await request<{ data: ApiAiHotBriefing }>("/api/aihot-briefing/today/refresh", {
    method: "POST",
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

export interface QualityDimensionScore {
  score: number       // 0-100（从后端 1-10 转换）
  passed: boolean
  feedback: string
  details?: string
}

export interface QualityCheckReport {
  editorial: QualityDimensionScore
  aiTaste: QualityDimensionScore
  attraction: QualityDimensionScore
  logic: QualityDimensionScore
  overall: { score: number; passed: boolean; needsRewrite: boolean }
  rewriteCount: number
}

/** 将后端 1-10 分转换为 0-100 分 */
function toPercent(score1to10: number): number {
  return Math.round(score1to10 * 10)
}

export async function checkScriptQuality(input: {
  content: string
  topicTitle?: string
  persona?: string | {
    roleType?: string
    oneLiner?: string
    toneOfVoice?: string
  }
}): Promise<QualityCheckReport> {
  const payload = await request<{
    data: {
      content: string
      report: {
        editorial: { score: number; passed: boolean; feedback: string; details?: string }
        aiTaste: { score: number; passed: boolean; feedback: string; details?: string }
        attraction: { score: number; passed: boolean; feedback: string; details?: string }
        logic: { score: number; passed: boolean; feedback: string; details?: string }
        overall: { score: number; passed: boolean; needsRewrite: boolean }
        rewriteCount: number
      }
    }
  }>("/api/scripts/quality-check", {
    method: "POST",
    body: JSON.stringify(input),
    timeout: 30000, // 30 second timeout for quality check
  })
  const d = payload.data.report
  return {
    editorial: { ...d.editorial, score: toPercent(d.editorial.score) },
    aiTaste: { ...d.aiTaste, score: toPercent(d.aiTaste.score) },
    attraction: { ...d.attraction, score: toPercent(d.attraction.score) },
    logic: { ...d.logic, score: toPercent(d.logic.score) },
    overall: { ...d.overall, score: toPercent(d.overall.score) },
    rewriteCount: d.rewriteCount,
  }
}

export interface PolishResult {
  original: string
  polished: string
  polishedDimensions: string[]
}

export async function polishScript(input: {
  content: string
  weakDimensions?: string[]
  topicTitle?: string
  persona?: string
}): Promise<PolishResult> {
  const payload = await request<{ data: PolishResult }>("/api/scripts/polish", {
    method: "POST",
    body: JSON.stringify(input),
    timeout: 60000,
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
  input?: {
    projectId?: string
    knowledgeEntryIds?: string[]
    elementCodes?: string[]
    refreshCount?: number
  },
): Promise<ApiTopicGenerateResponse> {
  const body: Record<string, unknown> = {}
  if (input?.projectId) body.projectId = input.projectId
  if (input?.knowledgeEntryIds?.length) body.knowledgeEntryIds = input.knowledgeEntryIds
  if (input?.elementCodes) body.elementCodes = input.elementCodes
  if (typeof input?.refreshCount === "number") body.refreshCount = input.refreshCount
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

// ─── Watch Accounts（对标账号监控看板） ────────────────────

export interface WatchAccount {
  id: string
  targetUrl: string
  platform: string
  platformUserId: string | null
  nickname: string | null
  avatar: string | null
  followerCount: number | null
  latestVideos: Array<{
    videoId: string
    title: string
    coverUrl: string
    createTime: number
    views: number
    likes: number
    comments: number
    shares: number
    collects: number
  }> | null
  viralVideos: Array<{
    videoId: string
    title: string
    coverUrl: string
    createTime: number
    views: number
    likes: number
    comments: number
    shares: number
    collects: number
    engagementScore: number
  }> | null
  refreshStatus: string
  refreshError: string | null
  lastRefreshedAt: string | null
  createdAt: string
}

export interface WatchAccountsResponse {
  items: WatchAccount[]
}

export interface WatchRefreshResponse {
  results: Array<{ id: string; targetUrl: string; status: string; error?: string }>
  summary: { total: number; success: number; failed: number }
}

export async function listWatchAccounts(): Promise<WatchAccountsResponse> {
  return request<WatchAccountsResponse>(
    "/api/competitor/watch-accounts"
  )
}

export async function addWatchAccount(url: string): Promise<WatchAccount> {
  return request<WatchAccount>("/api/competitor/watch-accounts", {
    method: "POST",
    body: JSON.stringify({ url }),
    timeout: 10000,
  })
}

export async function deleteWatchAccount(id: string): Promise<void> {
  await request(`/api/competitor/watch-accounts/${id}`, { method: "DELETE" })
}

export async function refreshWatchAccounts(accountId?: string): Promise<WatchRefreshResponse> {
  return request<WatchRefreshResponse>("/api/competitor/watch-accounts/refresh", {
    method: "POST",
    body: JSON.stringify(accountId ? { accountId } : {}),
    timeout: 300000,
  })
}

// ─── Video Copy Extraction（视频文案提取分析） ───────────────

export async function listVideoCopyExtractions(): Promise<{ items: ApiVideoCopyExtraction[] }> {
  return request<{ items: ApiVideoCopyExtraction[] }>("/api/video-copy-extractions")
}

export async function createVideoCopyExtraction(url: string): Promise<ApiVideoCopyExtraction> {
  return request<ApiVideoCopyExtraction>("/api/video-copy-extractions", {
    method: "POST",
    body: JSON.stringify({ url }),
    timeout: 20000,
  })
}

export async function getVideoCopyExtraction(id: string): Promise<ApiVideoCopyExtraction> {
  return request<ApiVideoCopyExtraction>(`/api/video-copy-extractions/${id}`)
}

export async function syncVideoCopyExtraction(id: string): Promise<ApiVideoCopyExtraction> {
  return request<ApiVideoCopyExtraction>(`/api/video-copy-extractions/${id}/sync`, {
    method: "POST",
    body: JSON.stringify({}),
    timeout: 120000,
  })
}

export interface KnowledgeEntry {
  id: string
  userId: string
  projectId?: string | null
  category: string
  title: string
  content: string
  tags: string[]
  sourceType: string
  sortOrder: number
  status: string
  createdAt: string
  updatedAt: string
}

export async function listKnowledge(input?: {
  category?: string
  projectId?: string
  status?: string
}): Promise<KnowledgeEntry[]> {
  const params = new URLSearchParams()
  if (input?.category) params.set("category", input.category)
  if (input?.projectId) params.set("projectId", input.projectId)
  if (input?.status) params.set("status", input.status)
  return request<KnowledgeEntry[]>(`/api/knowledge?${params}`)
}

export async function createKnowledge(data: {
  projectId?: string
  category: string
  title: string
  content: string
  tags?: string[]
  sourceType?: "manual" | "voice_transcribe" | "import"
}): Promise<KnowledgeEntry> {
  return request<KnowledgeEntry>("/api/knowledge", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updateKnowledge(
  id: string,
  data: Partial<{
    title: string
    content: string
    category: string
    tags: string[]
  }>
): Promise<KnowledgeEntry> {
  return request<KnowledgeEntry>(`/api/knowledge/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function deleteKnowledge(id: string): Promise<void> {
  await request(`/api/knowledge/${id}`, { method: "DELETE" })
}

// ─── AIM 生成 ────────────────────────────────────────────

export type ContentFormat =
  | "video_script"
  | "wechat_article"
  | "moments_post"
  | "community_message"
  | "shooting_brief"
  | "raw_copy"

export type AimTaskType =
  | "polish_copy"
  | "write_script"
  | "quality_check"
  | "repurpose"

export interface AimGenerateRequest {
  rawInput: string
  targetFormats?: ContentFormat[]
  taskType?: AimTaskType
  projectId?: string
  topicTitle?: string
  topicRationale?: string
  hotTopic?: string
  polishInstruction?: string
}

export interface AimGenerateResult {
  format: ContentFormat
  content: string
  wordCount: number
}

export interface AimGenerateResponse {
  id: string
  results: AimGenerateResult[]
  knowledgeUsed: { id: string; title: string; category: string }[]
}

export interface AimGeneration {
  id: string
  projectId?: string | null
  rawInput: string
  videoScript: string | null
  wechatArticle: string | null
  momentsPost: string | null
  communityMessage: string | null
  shootingBrief: string | null
  rawCopy: string | null
  formatsRequested: string[]
  knowledgeUsed: { id: string; title: string; category: string }[]
  createdAt: string
  hotTopic?: string | null
  polishInstruction?: string | null
  qualityScores?: unknown
  topicTitle?: string | null
  workflowStatus?: string
  reviewNote?: string | null
  publishedAt?: string | null
}

export async function generateAimContent(data: AimGenerateRequest): Promise<AimGenerateResponse> {
  return request<AimGenerateResponse>("/api/aim/generate", {
    method: "POST",
    body: JSON.stringify(data),
    timeout: 60000,
  })
}

export function generateScript(data: {
  projectId: string
  topicTitle?: string
  sourceText: string
  knowledgeEntryIds?: string[]
}): Promise<AimGenerateResponse> {
  return generateAimContent({
    projectId: data.projectId,
    rawInput: data.sourceText,
    topicTitle: data.topicTitle,
    targetFormats: ["video_script", "shooting_brief"],
    taskType: "write_script",
  })
}

export function generatePositioning(data: {
  projectId: string
  sourceText: string
  knowledgeEntryIds?: string[]
}): Promise<AimGenerateResponse> {
  return generateAimContent({
    projectId: data.projectId,
    rawInput: data.sourceText,
    targetFormats: ["raw_copy"],
    taskType: "polish_copy",
    polishInstruction: "输出商业策划定位判断，包含 IP 定位、内容定位、目标客群、成交路径和下一步内容建议。",
  })
}

export function generateMomentsCopy(data: {
  projectId: string
  sourceText: string
  intent?: string
  knowledgeEntryIds?: string[]
}): Promise<AimGenerateResponse> {
  return generateAimContent({
    projectId: data.projectId,
    rawInput: data.intent ? `${data.intent}\n\n${data.sourceText}` : data.sourceText,
    targetFormats: ["moments_post", "community_message"],
    taskType: "write_script",
  })
}

export function importFromLarkBase(data: {
  projectId: string
  tableType: "topic_review" | "project_management" | "data_archive"
}): Promise<{ created: number; updated: number; entries: KnowledgeEntry[] }> {
  return request<{ created: number; updated: number; entries: KnowledgeEntry[] }>("/api/lark-base/import", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export function exportToLarkBase(data: {
  projectId: string
  resultType: "topic" | "script" | "positioning" | "moments_copy"
  resultId: string
}): Promise<{ ok: true }> {
  return request<{ ok: true }>("/api/lark-base/export", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function listAimHistory(page = 1, pageSize = 20, projectId?: string): Promise<AimGeneration[]> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  if (projectId) params.set("projectId", projectId)
  return request<AimGeneration[]>(`/api/aim/history?${params.toString()}`)
}

export interface ClientProject {
  id: string
  name: string
  companyName: string | null
  industry: string | null
  targetCustomer: string | null
  offer: string | null
  deliveryGoal: string | null
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
  _count?: { aimGenerations: number }
  aimGenerations?: Array<{
    id: string
    rawInput: string
    workflowStatus: string
    createdAt: string
  }>
}

export interface CreateClientProjectRequest {
  name: string
  companyName?: string
  industry?: string
  targetCustomer?: string
  offer?: string
  deliveryGoal?: string
  notes?: string
}

export async function listClientProjects(status = "active"): Promise<ClientProject[]> {
  return request<ClientProject[]>(`/api/projects?status=${encodeURIComponent(status)}`)
}

export async function createClientProject(data: CreateClientProjectRequest): Promise<ClientProject> {
  return request<ClientProject>("/api/projects", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updateClientProject(id: string, data: Partial<CreateClientProjectRequest> & { status?: string }): Promise<ClientProject> {
  return request<ClientProject>(`/api/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

export async function updateAimWorkflowStatus(id: string, data: {
  workflowStatus: string
  reviewNote?: string
}): Promise<AimGeneration> {
  return request<AimGeneration>(`/api/aim/history/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

export async function transcribeAudio(audioBlob: Blob): Promise<{ text: string }> {
  return request<{ text: string }>("/api/aim/transcribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body: audioBlob,
  })
}

export async function uploadKnowledgeDocument(
  file: File,
  category: string
): Promise<{ created: number; entries: KnowledgeEntry[] }> {
  const token = useAuthStore.getState().token || getStoredAuthToken()

  const formData = new FormData()
  formData.append("file", file)
  formData.append("category", category)

  const response = await fetch("/api/knowledge/upload", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
    // 不设置 Content-Type，让浏览器自动处理 multipart boundary
  })

  if (!response.ok) {
    if (response.status === 401) {
      useAuthStore.getState().clearSession()
    }
    const payload = await response.json().catch(() => null)
    throw new ApiError(
      typeof payload?.error === "string" ? payload.error : `上传失败: ${response.status}`,
      response.status,
      payload
    )
  }

  return response.json()
}

export interface AimChatMessage {
  role: "user" | "assistant"
  content: string
}

export type AimChatToolAction =
  | "import_lark_topics"
  | "import_lark_project_data"
  | "import_lark_archive_data"
  | "export_lark_generation"

export async function chatAim(
  messages: AimChatMessage[],
  options?: {
    projectId?: string
    toolAction?: AimChatToolAction
    resultId?: string
  },
): Promise<{ content: string; toolResult?: unknown }> {
  return request<{ content: string; toolResult?: unknown }>("/api/aim/chat", {
    method: "POST",
    body: JSON.stringify({ messages, ...options }),
    timeout: 30000,
  })
}
