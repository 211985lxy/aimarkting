export const BENCHMARK_RECREATION_SOP_RULES = [
  "只学习对标内容背后的核心选题、开头机制、观点冲突和情绪触发点，不照搬原句。",
  "生成前先在内部建立观点池：原文核心观点、评论/争议信号、同类补充角度、反对意见、账号人设经验、行业方法论；观点池不展示，直接输出成稿。",
  "锁定原爆款的核心选题，但必须用我的立场、人设、案例、业务场景和表达方式重构。",
  "成稿必须完成结构重构、观点重构、表达重构，不能只是换词或搬运段落。",
]

export function buildBenchmarkRecreationSopBlock() {
  return [
    "爆款选题再创作 SOP：",
    ...BENCHMARK_RECREATION_SOP_RULES.map((rule, index) => `${index + 1}. ${rule}`),
  ].join("\n")
}

export function buildBenchmarkLengthRule(transcript: string | null | undefined) {
  const count = (transcript || "").replace(/\s+/g, "").length
  if (count === 0) return null
  const min = Math.max(1, Math.round(count * 0.95))
  const max = Math.round(count * 1.05)
  return `字数硬规则：对标原文约 ${count} 字，本次生成的对标改写正文必须对应这个体量，目标约 ${count} 字，控制在 ${min}-${max} 字；不要摘要，不要压缩成短稿，也不要明显扩写。`
}
