"use client"

import { PenLine, FileText, MessageSquare, BookOpen } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const outputFormats = [
  {
    title: "口播视频脚本",
    icon: MessageSquare,
    color: "text-primary",
    bgColor: "bg-primary/10",
    desc: "适合直接录制的高转化口播文案，含钩子、主体、CTA 完整结构",
  },
  {
    title: "公众号图文",
    icon: FileText,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    desc: "适合公众号发布的深度图文内容，含标题、小标题、正文结构",
  },
  {
    title: "朋友圈文案",
    icon: BookOpen,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    desc: "适合朋友圈发布的短文案，精炼有力，配合表情符号和排版节奏",
  },
]

export default function CopywritingPage() {
  return (
    <div className="space-y-8 pb-10">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">文案生成</h1>
          <Badge variant="outline" className="text-xs">③ 文案创作</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          基于选题策划结果，结合企业知识库和 IP 档案，生成多格式高转化营销文案。
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold tracking-wide">输出格式</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {outputFormats.map((format) => (
            <Card key={format.title} className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${format.bgColor}`}>
                    <format.icon className={`h-4 w-4 ${format.color}`} />
                  </div>
                  {format.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{format.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">创作输入</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-center">
            <PenLine className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-medium text-muted-foreground">文案生成功能正在开发中</p>
            <p className="text-xs text-muted-foreground/60 mt-1">将支持从选题策划结果直接进入，也可独立输入主题进行创作</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed border-2 border-muted-foreground/20 bg-muted/5">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <PenLine className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">文案生成引擎正在搭建</p>
          <p className="text-xs text-muted-foreground/60 mt-1">依赖信息来源和选题策划的输出结果</p>
        </CardContent>
      </Card>
    </div>
  )
}