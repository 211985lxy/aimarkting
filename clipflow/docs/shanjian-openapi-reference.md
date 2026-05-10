# Shanjian (闪剪) AI Open Platform - Complete API Reference

**Base URL:** `https://openapi.shanjian.tv`
**Documentation:** `https://openapi-doc.shanjian.tv/`

## Authentication

All requests require:
- `Authorization: Bearer {{appKey}}`
- `Content-Type: application/json`

## Standard Response Format

All endpoints return:
```json
{
  "code": "string",       // "Succeed" = success, others = failure (see error codes)
  "data": {},              // Response payload (varies by endpoint)
  "message": "string",    // Error description (when code != "Succeed")
  "requestId": "string"   // Unique request ID for troubleshooting
}
```

---

## Table of Contents

### Assets / Cloning
1. [GET /v1/assets/voice/common - Public Voice List](#1-public-voice-list)
2. [GET /v1/assets/virtualman/common - Public Digital Human List](#2-public-digital-human-list)
3. [POST /v1/virtualman/train - Professional Digital Human Cloning](#3-professional-digital-human-cloning)
4. [POST /v1/virtualman/fast/train - Fast Digital Human Cloning](#4-fast-digital-human-cloning)
5. [POST /v1/virtualman/image/train - Image-to-Digital-Human Cloning](#5-image-to-digital-human-cloning)
6. [POST /v1/voice/train - Voice Cloning](#6-voice-cloning)
7. [DELETE /v1/assets/{id} - Digital Human/Voice Deletion](#7-digital-humanvoice-deletion)

### Effects
8. [POST /v1/effect/tts - Text to Speech](#8-text-to-speech)
9. [POST /v1/effect/asr - Audio to Text (ASR)](#9-audio-to-text-asr)

### Video Synthesis
10. [POST /v1/virtualman/video - Digital Human Broadcast Video (No Packaging)](#10-digital-human-broadcast-video-no-packaging)
11. [POST /v1/clip/video/virtualman_broadcast - Digital Human Broadcast Mixed Editing](#11-digital-human-broadcast-mixed-editing)
12. [POST /v1/clip/video/realman_broadcast - Real Person Broadcast Mixed Editing](#12-real-person-broadcast-mixed-editing)
13. [POST /v1/clip/video/custom_realman_broadcast - Custom Real Person Broadcast Mixed Editing](#13-custom-real-person-broadcast-mixed-editing)
14. [POST /v1/clip/video/broadcast_mixcut - Material Mixed Editing](#14-material-mixed-editing)
15. [POST /v1/clip/video/news_mixcut - News-Style Video](#15-news-style-video)
16. [POST /v1/clip/video/custom_virtualman_broadcast - Custom Digital Human Broadcast Mixed Editing](#16-custom-digital-human-broadcast-mixed-editing)
17. [POST /v1/clip/video/custom_broadcast_mixcut - Custom Material Mixed Editing](#17-custom-material-mixed-editing)

### Templates
18. [GET /v1/clip/template - Smart Editing Template List](#18-smart-editing-template-list)
19. [GET /v1/clip/template/detail/{id} - Template Details](#19-template-details)

### Image Generation
20. [GET /v1/clip/image/template - AI Cover Template List](#20-ai-cover-template-list)
21. [POST /v1/clip/image/ai_cover - AI Cover Image Generation](#21-ai-cover-image-generation)

### Task Management
22. [GET /v1/task/info - Query Task Details](#22-query-task-details)

### Callback
23. [Callback Data Structure](#23-callback-data-structure)

---

## 1. Public Voice List

**GET** `/v1/assets/voice/common`

Retrieve the list of public/system voices available for TTS.

### Request

Headers only (no query params or body).

### Response

```json
{
  "code": "Succeed",
  "data": {
    "results": [
      {
        "id": "string",        // Voice ID
        "name": "string",      // Voice name
        "gender": "string",    // Gender
        "coverUrl": "string",  // Cover image URL
        "demoUrl": "string",   // Audio sample URL
        "langs": ["string"]    // Supported languages
      }
    ]
  },
  "requestId": "string"
}
```

**Doc URL:** https://openapi-doc.shanjian.tv/397345823e0

---

## 2. Public Digital Human List

**GET** `/v1/assets/virtualman/common`

Retrieve the list of public/system digital humans.

### Request

Headers only (no query params or body).

### Response

```json
{
  "code": "Succeed",
  "data": {
    "results": [
      {
        "id": "string",        // Digital human ID
        "name": "string",      // Name
        "gender": "string",    // Gender
        "coverUrl": "string"   // Cover image URL
      }
    ]
  },
  "requestId": "string"
}
```

**Doc URL:** https://openapi-doc.shanjian.tv/397369717e0

---

## 3. Professional Digital Human Cloning

**POST** `/v1/virtualman/train`

Clone a professional digital human from a training video. Training takes 1-6 hours. Requires 30-120 second high-quality training video.

### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| videoUrl | string | Yes | Training video URL |
| authVideoUrl | string | Yes | Authorization video URL (must be same person as training video) |
| authText | string | Yes | Authorized brand name (e.g. "闪剪AI") |
| callbackUrl | string | No | Webhook URL for training result notification |

**Training Video Requirements:**
- Duration: 30-120 seconds
- Max size: 1GB
- Max resolution: 2K (single edge <=2000px)
- Frame rate: 10-60fps
- Codec: H.264 / HEVC (H.265)
- Format: MP4, MOV

**Authorization Video Requirements:**
- Max size: 100MB
- Duration: < 2 minutes
- Codec: H.264 / HEVC (H.265)
- Format: MP4, MOV

### Response

```json
{
  "code": "Succeed",
  "data": { "taskId": "string" },
  "requestId": "string"
}
```

Costs 500 computing units per clone.

**Doc URL:** https://openapi-doc.shanjian.tv/342231002e0

---

## 4. Fast Digital Human Cloning

**POST** `/v1/virtualman/fast/train`

Clone a digital human quickly (no processing wait; first video takes 3-5 minutes longer). Requires 5-60 second training video.

### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| videoUrl | string | Yes | Training video URL |
| authVideoUrl | string | Yes | Authorization video URL (must be same person) |
| authText | string | Yes | Authorized brand name |
| callbackUrl | string | No | Webhook URL for training result notification |

**Training Video Requirements:**
- Duration: 5-60 seconds
- Max size: 500MB
- Max resolution: 2K (single edge <=2000px)
- Frame rate: 10-60fps (recommended: 25fps)
- Codec: H.264 / HEVC (H.265)
- Format: MP4, MOV

**Authorization Video Requirements:**
- Same as Professional cloning (100MB, <2min, H.264/HEVC, MP4/MOV)

### Response

```json
{
  "code": "Succeed",
  "data": { "taskId": "string" },
  "requestId": "string"
}
```

**Doc URL:** https://openapi-doc.shanjian.tv/342232918e0

---

## 5. Image-to-Digital-Human Cloning

**POST** `/v1/virtualman/image/train`

Create a digital human from a single image. Completes in ~10 minutes.

### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| imageUrl | string | Yes | Image URL for digital human generation |
| authVideoUrl | string | Yes | Authorization video URL (must be same person) |
| authText | string | Yes | Authorized brand name |
| callbackUrl | string | No | Webhook URL for training result notification |

**Training Image Requirements:**
- Resolution: 300-2000px per side
- Base64 size: <=5MB
- Format: JPG, PNG, WebP (static only)
- Aspect ratio: 0.4-2.5

**Authorization Video Requirements:**
- Same as above (100MB, <2min, H.264/HEVC, MP4/MOV)

### Response

```json
{
  "code": "Succeed",
  "data": { "taskId": "string" },
  "requestId": "string"
}
```

**Doc URL:** https://openapi-doc.shanjian.tv/347502607e0

---

## 6. Voice Cloning

**POST** `/v1/voice/train`

Clone a voice from an audio sample.

### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| audioUrl | string | Yes | Audio URL to clone. Formats: mp3, wav (recommended), m4a |
| model | string | Yes | Voice model. Enum: `v1`, `v2`, `v3`, `s1`, `s3` |
| language | string | Yes | Audio language (must match demoText language) |
| demoText | string | No | Sample text for preview audio. Default: "你好，我是你的AI专属克隆声音，希望未来的日子一起好好相处哦。" |
| callbackUrl | string | No | Webhook URL for result notification |

**Audio Requirements:**
- Duration: V1/V2/V3 = 5-120 seconds; S1/S3 = 10-120 seconds
- Max size: 10MB
- Format: mp3, wav, m4a

**Model Capabilities:**
- V1/V2: Chinese, English, Japanese, Spanish, Indonesian, Portuguese (6 languages)
- V3: Chinese, English only
- S1/S3: 40+ mainstream languages (broadest coverage)

### Response

```json
{
  "code": "Succeed",
  "data": { "taskId": "string" },
  "requestId": "string"
}
```

**Doc URL:** https://openapi-doc.shanjian.tv/342241374e0

---

## 7. Digital Human/Voice Deletion

**DELETE** `/v1/assets/{id}`

Permanently delete a cloned digital human or voice. **This action is irreversible.**

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | The digital human ID or voice ID to delete |

### Response

```json
{
  "code": "Succeed",
  "data": { "id": "string" }
}
```

**Doc URL:** https://openapi-doc.shanjian.tv/344550029e0

---

## 8. Text to Speech

**POST** `/v1/effect/tts`

Convert text to audio using voice synthesis.

### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| text | string | Yes | Content to synthesize |
| speakerId | string | Yes | Voice ID (from public voice list or voice cloning) |
| language | string | No | Language code. Default: "zh-CN" |
| speedRatio | number | No | Speech speed. Range: 0.5-2. Default: 1 |
| volume | number | No | Volume level. Range: 0.5-2. Default: 1 |
| codec | string | No | Audio format: "mp3" or "wav". Default: "mp3" |
| marks | array | No | Special text processing markers for pauses or pronunciation replacements |
| returnSubtitle | boolean | No | Whether to return subtitle/timing information |
| callbackUrl | string | No | Webhook URL for results |

### Response

```json
{
  "code": "Succeed",
  "data": { "taskId": "string" },
  "requestId": "string"
}
```

**Doc URL:** https://openapi-doc.shanjian.tv/359919256e0

---

## 9. Audio to Text (ASR)

**POST** `/v1/effect/asr`

Convert audio to text using automatic speech recognition. Supports 26 languages including Chinese dialects.

### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| audioUrl | string | Yes | Audio file URL. Max duration: 5 minutes |
| language | string | Yes | Audio language code (see language code reference) |
| callbackUrl | string | No | Webhook URL for result notification |

**Audio Requirements:**
- Duration: <=5 minutes
- Formats: mp3, wav, m4a
- Max size: 100MB

### Response

```json
{
  "code": "Succeed",
  "data": { "taskId": "string" },
  "requestId": "string"
}
```

**Doc URL:** https://openapi-doc.shanjian.tv/342294933e0

---

## 10. Digital Human Broadcast Video (No Packaging)

**POST** `/v1/virtualman/video`

Generate a raw digital human broadcast video without any template packaging (titles, subtitles, etc.). Suitable for use as raw footage in professional editing workflows.

### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| virtualmanId | string | Yes | Digital human ID |
| audioUrl | string | Conditional | Audio file URL. **Use either audioUrl OR text+speakerId** |
| text | string | Conditional | Text content (3-3,600 characters). Requires speakerId |
| speakerId | string | Conditional | Voice ID. Required when using text |
| speakerExtra | object | No | Voice parameter overrides |
| speakerExtra.speedRatio | number | No | Speech speed (0.5-2.0). Default: 1 |
| speakerExtra.language | string | No | Language code |
| speakerExtra.marks | array | No | Text processing markers (type: "break" for pauses) |
| speakerExtra.marks[].index | integer | No | Character position (0 to text length) |
| speakerExtra.marks[].time | integer | No | Duration in ms (100-10,000) |
| metadata | object | No | Watermark metadata. Single entry; string values only |
| callbackUrl | string | No | Webhook URL for results |

**Audio Requirements:**
- Duration: 0.5 seconds to 10 minutes
- Formats: mp3, wav, m4a
- Max size: 100MB
- Must support speech-to-text conversion

**Two generation methods:**
1. Text + speakerId: supply text content (3-3,600 chars) and a speakerId
2. Audio file: supply audioUrl directly

### Response

```json
{
  "code": "Succeed",
  "data": { "taskId": "string" },
  "requestId": "string"
}
```

**Doc URL:** https://openapi-doc.shanjian.tv/342245572e0

---

## 11. Digital Human Broadcast Mixed Editing

**POST** `/v1/clip/video/virtualman_broadcast`

Generate a packaged digital human broadcast video with template effects, materials, titles, subtitles, etc.

### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| styleId | string | Yes | Video template ID |
| virtualmanId | string | Yes | Digital human ID |
| audioUrl | string | Conditional | Audio file URL. **Use either audioUrl OR content+speakerId** |
| content | string | Conditional | Text content (3-1,800 characters). Requires speakerId |
| language | string | No | Language code |
| speakerId | string | Conditional | Voice ID. Required when using content |
| speakerExtra | object | No | Voice parameter overrides |
| speakerExtra.speedRatio | number | No | Speech speed (0.5-2.0). Default: 1 |
| speakerExtra.language | string | No | Language |
| speakerExtra.marks | array | No | Text processing markers |
| title | string | No | Video title |
| materials | array | No | Images/videos to insert |
| materials[].type | string | Yes | "image" or "video" |
| materials[].fileUrl | string | Yes | Resource URL |
| materialSoundSwitch | boolean | No | Enable original audio in video materials. Default: false |
| introduceCard | object | No | Identity bar info |
| introduceCard.name | string | No | Name displayed |
| introduceCard.description | string | No | Description |
| packRules | object | No | Packaging controls (see Common Structures below) |
| processRules | object | No | Processing rules (see Common Structures below) |
| structLayers | array | No | Layer customization (see Common Structures below) |
| subtitle | array | No | Subtitle data with timing |
| subtitle[].startMs | integer | No | Start timestamp (ms) |
| subtitle[].endMs | integer | No | End timestamp (ms). Max: 310,000 |
| subtitle[].text | string | No | Single character text |
| callbackUrl | string | No | Webhook URL |

### Response

```json
{
  "code": "Succeed",
  "data": { "taskId": "string" },
  "requestId": "string"
}
```

**Doc URL:** https://openapi-doc.shanjian.tv/342271033e0

---

## 12. Real Person Broadcast Mixed Editing

**POST** `/v1/clip/video/realman_broadcast`

Generate a packaged real person broadcast video. Automatically removes filler words and pauses.

### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| styleId | string | Yes | Video template ID |
| videoUrl | string | Yes | Video URL (MP4/MOV, H.264/HEVC, 10-60fps, <5min, <500MB, <2000px) |
| language | string | No | Video language code (for ASR) |
| title | string | No | Video title |
| subtitle | array | No | Manual subtitle corrections (overrides ASR) |
| materials | array | No | Images/videos to insert |
| materialSoundSwitch | boolean | No | Enable original audio in video materials. Default: false |
| introduceCard | object | No | Identity bar info (name, description) |
| packRules | object | No | Packaging controls |
| processRules | object | No | Processing rules |
| structLayers | array | No | Layer customization |
| callbackUrl | string | No | Webhook URL |

### Response

```json
{
  "code": "Succeed",
  "data": { "taskId": "string" },
  "requestId": "string"
}
```

**Doc URL:** https://openapi-doc.shanjian.tv/342282685e0

---

## 13. Custom Real Person Broadcast Mixed Editing

**POST** `/v1/clip/video/custom_realman_broadcast`

Generate a custom real person broadcast mixed editing video with full control over styling, materials, and packaging.

### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| styleId | string | Yes | Video template ID |
| videoUrl | string | Yes | Video URL |
| language | string | No | Audio language code |
| title | string | No | Video title |
| subtitle | array | No | Timed text segments (startMs, endMs, text) |
| materials | array | No | Images/videos (fileUrl, type, entryPoint, duration) |
| introduceCard | object | No | Identity bar (name, description) |
| packRules | object | No | Packaging controls |
| processRules | object | No | Processing rules (watermark, resource method, metadata, cover) |
| structLayers | array | No | Layer modifications |
| callbackUrl | string | No | Webhook URL |

### Response

```json
{
  "code": "Succeed",
  "data": { "taskId": "string" },
  "requestId": "string"
}
```

**Doc URL:** https://openapi-doc.shanjian.tv/360232310e0

---

## 14. Material Mixed Editing

**POST** `/v1/clip/video/broadcast_mixcut`

Generate a video from materials (images/videos) combined with text/audio narration, using a template.

### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| styleId | string | Yes | Video template ID |
| materials | array | Yes | Media assets (images/videos). Max 5min total |
| title | string | No | Video title |
| audioUrl | string | Conditional | Audio file URL. **Use either audioUrl OR content+speakerId** |
| content | string | Conditional | Text content (3-1,800 characters) |
| language | string | No | Language code |
| speakerId | string | Conditional | Voice ID. Required when using content |
| speakerExtra | object | No | Voice parameters (speedRatio, language, marks) |
| introduceCard | object | No | Identity bar (name, description) |
| packRules | object | No | Packaging controls |
| processRules | object | No | Processing rules |
| structLayers | array | No | Layer customization |
| subtitle | array | No | Subtitle data with timing |
| callbackUrl | string | No | Webhook URL |

### Response

```json
{
  "code": "Succeed",
  "data": { "taskId": "string" },
  "requestId": "string"
}
```

**Doc URL:** https://openapi-doc.shanjian.tv/347508346e0

---

## 15. News-Style Video

**POST** `/v1/clip/video/news_mixcut`

Generate a news-style video from materials and a title.

### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| styleId | string | Yes | Video template ID |
| title | string | Yes | Video heading text (3-1,800 characters) |
| materials | array | Yes | Media assets. Max 5min total |
| materials[].type | string | Yes | "image" or "video" |
| materials[].fileUrl | string | Yes | Resource URL |
| materials[].soundSwitch | boolean | No | Enable original audio for video. Default: false |
| introduceCard | object | No | Identity bar (name, description) |
| packRules | object | No | Packaging controls |
| processRules | object | No | Processing rules |
| structLayers | array | No | Layer customization |
| callbackUrl | string | No | Webhook URL |

**Note:** Text exceeding template line count causes fallback to default template.

### Response

```json
{
  "code": "Succeed",
  "data": { "taskId": "string" },
  "requestId": "string"
}
```

**Doc URL:** https://openapi-doc.shanjian.tv/347517114e0

---

## 16. Custom Digital Human Broadcast Mixed Editing

**POST** `/v1/clip/video/custom_virtualman_broadcast`

Generate a custom digital human broadcast video with scene-by-scene control (shot divisions).

### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| styleId | string | Yes | Video template ID |
| virtualmanId | string | Yes | Digital human ID |
| speakerId | string | Yes | Voice ID |
| scenes | array | Yes | Scene array (each scene = one shot) |
| scenes[].captions | object | Yes | Text content for scene |
| scenes[].captions.content | string | Yes | Text (3-1,800 characters) |
| scenes[].captions.marks | array | No | Text processing markers (pauses, replacements) |
| scenes[].materials | array | No | Images/videos for this scene |
| title | string | No | Video title |
| speakerExtra | object | No | Voice parameters (speedRatio: 0.5-2.0, language) |
| introduceCard | object | No | Identity bar (name, description) |
| packRules | object | No | Packaging controls |
| processRules | object | No | Processing rules |
| structLayers | array | No | Layer customization |
| callbackUrl | string | No | Webhook URL |

### Response

```json
{
  "code": "Succeed",
  "data": { "taskId": "string" },
  "requestId": "string"
}
```

**Doc URL:** https://openapi-doc.shanjian.tv/354590181e0

---

## 17. Custom Material Mixed Editing

**POST** `/v1/clip/video/custom_broadcast_mixcut`

Generate a custom material mixed editing video with scene-by-scene control.

### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| styleId | string | Yes | Video template ID |
| scenes | array | Yes | Scene array (each scene = one shot) |
| scenes[].captions | object | Yes | Text content for scene |
| scenes[].captions.content | string | Yes | Subtitle text (3-1,800 characters) |
| scenes[].captions.marks | array | No | Text markers (type: "break" for pause, "replace" for pronunciation) |
| scenes[].materials | array | Yes | Media assets for this scene |
| scenes[].materials[].fileUrl | string | Yes | Resource URL |
| scenes[].materials[].soundSwitch | boolean | No | Enable original audio. Default: false |
| title | string | No | Video title |
| speakerId | string | No | Voice ID |
| speakerExtra | object | No | Voice parameters (speedRatio: 0.5-2.0, language) |
| introduceCard | object | No | Identity bar (name, description) |
| packRules | object | No | Packaging controls |
| processRules | object | No | Processing rules |
| structLayers | array | No | Layer customization |
| callbackUrl | string | No | Webhook URL |

### Mark Types for captions.marks:
- `break`: Insert pause at character position. Fields: index (integer), time (ms, 100-10,000)
- `replace`: Replace pronunciation. Fields: indexRange (array), text (replacement text)

### Response

```json
{
  "code": "Succeed",
  "data": { "taskId": "string" },
  "requestId": "string"
}
```

**Doc URL:** https://openapi-doc.shanjian.tv/354615984e0

---

## 18. Smart Editing Template List

**GET** `/v1/clip/template`

Retrieve available video editing templates, filterable by scene type.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| scene | string | Yes | Template scene. Enum: `virtualman`, `realMan`, `oralMixCutting`, `newsMixCutting` |
| pageSize | integer | No | Items per page. Default: 10 |
| sid | string | No | Pagination cursor (from previous response) |
| searchKey | string | No | Search field. Enum: `name`, `id` |
| searchValue | string | No | Search value |
| sortBy | string | No | Sort by upload time. Enum: `desc` (default), `asc` |

**Scene Types:**
- `virtualman` - Digital human broadcast templates
- `realMan` - Real person broadcast templates
- `oralMixCutting` - Material mixed editing templates
- `newsMixCutting` - News mixed editing templates

### Response

```json
{
  "code": "Succeed",
  "data": {
    "results": [
      {
        "id": "string",        // Template ID
        "name": "string",      // Template name
        "coverUrl": "string",  // Cover image URL
        "scene": "string",     // Scene type
        "demoUrl": "string"    // Sample video URL
      }
    ],
    "sid": "string"            // Pagination cursor for next page
  },
  "requestId": "string"
}
```

**Doc URL:** https://openapi-doc.shanjian.tv/342258231e0

---

## 19. Template Details

**GET** `/v1/clip/template/detail/{id}`

Get detailed information about a specific template, including canvas dimensions and layer structure.

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Template ID |

### Response

```json
{
  "code": "Succeed",
  "data": {
    "id": "string",
    "name": "string",
    "coverUrl": "string",
    "scene": "string",
    "videoStructInfo": {
      "editInfo": {
        "canvas": {
          "width": 720,
          "height": 1280
        },
        "headerLayer": {
          "width": 640,
          "height": 220,
          "transform": {
            "anchor": [0, 0, 0],
            "scalar": [100, 100, 100],
            "position": [360, 160, 0]
          }
        },
        "subtitleLayer": { ... },
        "ipLayer": { ... }
      }
    }
  },
  "requestId": "string"
}
```

**Layer types:** headerLayer (title), subtitleLayer (subtitle), ipLayer (identity bar). Empty object = layer not available in template.

**Doc URL:** https://openapi-doc.shanjian.tv/382122111e0

---

## 20. AI Cover Template List

**GET** `/v1/clip/image/template`

Retrieve available AI cover image templates.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| pageSize | integer | No | Items per page. Default: 10 |
| sid | string | No | Pagination cursor |
| searchKey | string | No | Search field. Enum: `name`, `id` |
| searchValue | string | No | Search value |
| sortBy | string | No | Sort order. Enum: `desc` (default), `asc` |

### Response

```json
{
  "code": "Succeed",
  "data": {
    "results": [
      {
        "id": "string",        // Template ID
        "name": "string",      // Template name
        "coverUrl": "string"   // Cover image URL
      }
    ],
    "sid": "string"
  },
  "requestId": "string"
}
```

**Doc URL:** https://openapi-doc.shanjian.tv/389221892e0

---

## 21. AI Cover Image Generation

**POST** `/v1/clip/image/ai_cover`

Generate an AI cover image using a base image and template.

### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| imageUrl | string | Yes | Base image URL (JPG/JPEG/PNG, <=10MB, <=2000px per side) |
| templateId | string | Yes | AI cover template ID |
| processRules | object | Yes | Processing configuration |
| processRules.coverMainTitle | string | Yes | Cover main title (1-50 characters) |
| processRules.coverSubtitle | string | No | Cover subtitle (1-50 characters) |
| processRules.coverKeywords | array | No | Keywords (each 1-50 characters) |
| processRules.metadata | object | No | Watermark metadata. Single dataset; string values only |
| callbackUrl | string | No | Webhook URL |

### Response

```json
{
  "code": "Succeed",
  "data": { "taskId": "string" },
  "requestId": "string"
}
```

**Doc URL:** https://openapi-doc.shanjian.tv/389226151e0

---

## 22. Query Task Details

**GET** `/v1/task/info`

Query the status and results of any asynchronous task.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| taskId | string | Yes | Task ID returned from any creation endpoint |

### Response

```json
{
  "code": "Succeed",
  "data": {
    "taskId": "string",
    "status": "string",    // "processing", "succeed", or "failed"
    "result": {
      "videoUrl": "string",       // Video generation tasks
      "audioUrl": "string",       // Audio synthesis tasks
      "imageUrl": "string",       // Image generation tasks
      "text": "string",           // ASR/text generation tasks
      "coverUrl": "string",       // Video cover URL
      "aiCoverSucceed": true,     // AI cover generation success
      "duration": 0,              // Duration in seconds
      "demoAudioUrl": "string",   // Voice cloning demo
      "virtualmanId": "string",   // Digital human training result
      "speakerId": "string",      // Voice cloning result
      "subtitle": [               // TTS/ASR subtitle data
        {
          "text": "string",
          "startMs": "string",
          "endMs": "string"
        }
      ]
    },
    "errorCode": "string",       // On failure
    "errorMessage": "string"     // On failure
  },
  "requestId": "string"
}
```

**Note:** Result fields vary by task type. Only relevant fields are populated.

**Doc URL:** https://openapi-doc.shanjian.tv/342296170e0

---

## 23. Callback Data Structure

When a task completes (success or failure), a POST request is sent to the provided `callbackUrl` / webhook address. Return HTTP 200 to confirm receipt. Failed notifications are retried up to 3 times.

### Callback POST Body

```json
{
  "taskId": "string",
  "status": "string",          // "processing", "succeed", "failed"
  "result": {
    "videoUrl": "string",      // Video generation tasks
    "audioUrl": "string",      // Audio synthesis tasks
    "imageUrl": "string",      // Image generation tasks
    "text": "string",          // ASR/text tasks
    "coverUrl": "string",      // Video cover
    "aiCoverSucceed": true,    // AI cover success flag
    "duration": 0,             // Duration in seconds
    "demoAudioUrl": "string",  // Voice cloning demo audio
    "virtualmanId": "string",  // Digital human training result
    "speakerId": "string",     // Voice cloning result
    "subtitle": [
      {
        "text": "string",
        "startMs": "string",
        "endMs": "string"
      }
    ]
  },
  "costRights": {
    "credits": 0               // Computing units consumed
  },
  "errorCode": "string",       // On failure
  "errorMessage": "string"     // On failure
}
```

**Doc URL:** https://openapi-doc.shanjian.tv/7694236m0

---

## Common Structures

### packRules Object (Packaging Controls)

Controls which template effects are applied to the video.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| headerSwitch | boolean | - | Enable/disable title effect packaging |
| materialSwitch | boolean | - | Enable/disable material effect packaging |
| subtitleSwitch | boolean | - | Enable/disable subtitle effect packaging |
| keywordSwitch | boolean | - | Enable/disable keyword effect packaging |
| backgroundMusic | object | - | Background music configuration |
| backgroundMusic.audioSwitch | boolean | - | Enable/disable background music |
| backgroundMusic.audioUrl | string | - | Custom audio URL (mp3/wav/m4a, <=120MB, <=5min) |
| backgroundMusic.volume | number | - | Volume level (0-1) |

**Note:** packRules controls effect packaging, not layer visibility. To hide a title, omit the title value entirely.

### processRules Object (Processing Rules)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| watermarkShow | boolean | false/true | Show "AI Generated" watermark |
| resourcePreprocessMethod | string | - | Video preprocessing: `roughCut` or `sliceMerge` |
| materialMatchWay | string | preciseMatch | Material matching: `fuzzyMatch` or `preciseMatch` |
| materialComposition | string | - | Material arrangement: `random` or `order` |
| metadata | object | - | AI content watermark metadata. Single key-value pair, string values only |
| firstFrameCover | object | - | Cover configuration (see below) |

### firstFrameCover Object

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| coverSwitch | boolean | false | Enable cover generation |
| templateId | string | - | Template ID (system auto-selects if omitted) |
| imageUrl | string | - | Base image for AI cover generation |
| resultImageUrl | string | - | Pre-made cover image (higher priority than imageUrl) |

### structLayers Array (Layer Customization)

Each element:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| markCode | string | Yes | Layer type: `headerLayer`, `subtitleLayer`, or `ipLayer` |
| show | boolean | No | Visibility. Inherits template default if unset |
| showMode | string | No | Display mode (headerLayer only): `always` or `customize` |
| showTime | number | No | Display duration in seconds (for customize mode). 3 decimal places, must be > 0 |
| layer | object | No | Position/transform data |
| layer.transform | object | No | Contains position array [x, y, z] for anchor positioning |

### Coordinate System

- Canvas origin (0,0) is at the top-left corner
- Width = x-axis, Height = y-axis
- Position values represent layer offset based on canvas coordinates
- Anchor and scalar values from template are read-only

---

## File Format Requirements Summary

### Video Files
- Format: MP4, MOV
- Codec: H.264, HEVC (H.265)
- Frame rate: 10-60fps (recommended: 25fps)
- Resolution: single edge <=2000px

### Image Files
- Format: JPG, PNG, WebP
- Resolution: single edge <=2000px

### Audio Files
- Format: MP3, WAV, M4A

### Specific Limits by Context

| Context | Max Duration | Max Size |
|---------|-------------|----------|
| Training video (professional) | 30-120s | 1GB |
| Training video (fast) | 5-60s | 500MB |
| Authorization video | <2min | 100MB |
| Broadcast audio input | 0.5s-10min | 100MB |
| Mixed editing audio input | 0.5s-5min | 100MB |
| Material videos | <60s | 500MB |
| Background music | <=5min | 120MB |
| Voice cloning audio | 5-120s (V1-V3), 10-120s (S1/S3) | 10MB |
| ASR audio | <=5min | 100MB |
| Cover images | - | 10MB |
| Total materials duration | 5min | - |

### Output Specifications
- Resolution: 1080p
- Aspect ratio: 9:16
- Bitrate: 6M
- Video/audio results available for 24 hours only

---

## Error Codes

| Error Code | Description |
|------------|-------------|
| Invalid.Authorization | Authentication failure - verify auth headers |
| Invalid.TrainAuth | Authorization text validation failure |
| Request.Limit | API request QPS exceeded |
| Concurrency.Limit | Concurrent processing capacity exceeded |
| Account.NotExist | Account does not exist |
| Resource.NotExist | Resource not found |
| Resource.Disable | Resource is disabled |
| Task.NotExist | Task not found |
| Invalid.File.Format | File format validation error |
| Invalid.File.Resolution | File resolution validation error |
| Invalid.File.Duration | File duration validation error |
| Invalid.File.Size | File size validation error |
| Invalid.File.FPS | File frame rate validation error |
| Invalid.File.Codec | File codec validation error |
| Invalid.File.Audio | Audio detection issue |
| Invalid.Face.Detection | Face detection failure |
| Invalid.Face.Completeness | Face completeness requirements not met |
| Invalid.Speech | Speech pronunciation standards not met |
| Invalid.Face.Comparison | Face comparison validation failure |
| Failed.Timeout | Processing timeout - retry or contact support |
| Service.Error | General service exception |

---

## Computing Unit Costs

- Video synthesis: 0.1-1 unit per second (varies by format)
- Professional digital human cloning: 500 units per clone
- Fast digital human cloning: unlimited (included in package)
- Voice cloning (V1-V3): unlimited (included in package)
- Failed tasks: computing units automatically refunded
- Results under 1 unit round up to 1 unit (2 decimal places)
