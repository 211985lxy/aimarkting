# Project Rules

## Product Architecture

- Video creation is a three-layer system and these layers MUST stay distinct across UI, prompt design, API contracts, task lineage, and analytics.
- Director layer: decides how the video is structured and paced. This corresponds to video structure templates and narrative blueprints.
- Scriptwriter layer: decides how the message is expressed and sold. This corresponds to content templates, brief inputs, IP profile context, and script generation.
- Packaging layer: decides how the final video is visually assembled and mixed. This corresponds to Shanjian packaging templates, materials, BGM, subtitles, and layout capabilities such as picture-in-picture-style compositions.
- Shanjian packaging templates MUST NOT be modeled as content structure templates or script templates.
- Any change to `/create`, script generation, or video task creation MUST state which layer it affects and MUST preserve downstream lineage for that layer.

## UI Rules

- All UI-related work must invoke the `ui-ux-pro-max` skill first to keep the design language and visuals consistent.
- UI components must use `shadcn/ui` only. No alternative UI component libraries or custom component systems are allowed.

## kube

KUBECONFIG=~/.kube/config-ask-aibao365
阿里云 AccessKey 存在以下位置：profile 名为 aliyun-aibao365（存储在 ~/.aliyun/config.json）
