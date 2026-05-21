"use client"

import { ShieldCheck, CheckCircle2, AlertTriangle, XCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const checkDimensions = [
  { title: "钩子力度", desc: "开头前 3 秒是否能有效抓住注意力", icon: "🎯" },
  { title: "信息密度", desc: "内容是否有足够的干货，避免空洞注水", icon: "📊" },
  { title: "情感共鸣", desc: "是否能引发目标用户的情绪反应", icon: "💡" },
  { title: "CTA 清晰度", desc: "行动号召是否明确、自然、不生硬", icon: "👆" },
  { title: "IP 一致性", desc: "内容是否与企业 IP 定位和人设保持一致", icon: "🏷️" },
  { title: "合规风险", desc: "是否包含夸大宣传、敏感词、违规内容", icon: "⚖️" },
]

export default function QualityCheckPage() {
  return (
    <div className="space-y-8 pb-10">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">内容质量检控</h1>
          <Badge variant="outline" className="text-xs">④ 质量检控</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          对生成的文案进行多维度质量评估，确保内容在钩子力度、信息密度、IP 一致性和合规性等维度达到发布标准。
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold tracking-wide">检控维度</h2>
        <Card>
          <CardContent className="pt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {checkDimensions.map((dim) => (
                <div key={dim.title} className="flex items-start gap-3 rounded-lg border border-border/50 p-3 transition-all duration-200 hover:bg-secondary/20 hover:border-primary/20">
                  <span className="text-lg">{dim.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{dim.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{dim.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold tracking-wide">评估等级</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-emerald-500/20">
            <CardContent className="flex items-center gap-3 pt-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-600">通过</p>
                <p className="text-xs text-muted-foreground">所有维度达标，可直接发布</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-500/20">
            <CardContent className="flex items-center gap-3 pt-4">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-600">需优化</p>
                <p className="text-xs text-muted-foreground">部分维度待改进，附修改建议</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-500/20">
            <CardContent className="flex items-center gap-3 pt-4">
              <XCircle className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-600">不通过</p>
                <p className="text-xs text-muted-foreground">存在严重问题，需重新创作</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-dashed border-2 border-muted-foreground/20 bg-muted/5">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <ShieldCheck className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">质量检控功能正在开发中</p>
          <p className="text-xs text-muted-foreground/60 mt-1">将基于 AI 评估引擎，对文案创作输出进行多维度自动评分和改进建议</p>
        </CardContent>
      </Card>
    </div>
  )
}