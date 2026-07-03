export type AimWorkbenchCommandId =
  | "integrate_editor"
  | "fill_reference"
  | "open_editor"
  | "close_editor"
  | "save_editor"
  | "reset_conversation"
  | "regenerate"
  | "rewrite_benchmark"
  | "run_quality_check"
  | "remember_preference"

export interface AimWorkbenchCommand {
  id: AimWorkbenchCommandId
  input: string
}

const COMMAND_PATTERNS: Array<{ id: AimWorkbenchCommandId; pattern: RegExp }> = [
  { id: "reset_conversation", pattern: /(清空|重置|重新开始).{0,6}(对话|聊天|当前内容)/ },
  { id: "save_editor", pattern: /(保存|同步).{0,8}(编辑稿|编辑区|我的稿子|交付物)/ },
  { id: "open_editor", pattern: /(打开|展开|显示).{0,8}(编辑区|文案编辑|我的稿子)/ },
  { id: "close_editor", pattern: /(隐藏|收起|关闭).{0,8}(编辑区|文案编辑|我的稿子)/ },
  { id: "fill_reference", pattern: /对标原文.*(右侧|文案编辑|对标文案|编辑区)|(右侧|文案编辑|对标文案|编辑区).*对标原文/ },
  { id: "integrate_editor", pattern: /(整合|合并|放|搞|弄|更新|同步).{0,8}编辑区|编辑区.{0,8}(整合|合并|更新|同步)/ },
  { id: "rewrite_benchmark", pattern: /(按原文字数|对标原文|不要照抄|重新洗).{0,12}(重写|改写|再生成)/ },
  { id: "regenerate", pattern: /(重新生成|再生成|重来一版|换一版)/ },
  { id: "run_quality_check", pattern: /(检查|自检|质检).{0,12}(照抄|字数|跑题|AI味|质量)/ },
  { id: "remember_preference", pattern: /(记住|沉淀|保存).{0,8}(偏好|规则|习惯|口吻)/ },
]

export function detectAimWorkbenchCommand(text: string): AimWorkbenchCommand | null {
  const input = text.trim()
  if (!input) return null
  const command = COMMAND_PATTERNS.find((item) => item.pattern.test(input))
  return command ? { id: command.id, input } : null
}
