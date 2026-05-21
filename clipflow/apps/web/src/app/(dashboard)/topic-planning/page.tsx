"use client"

import { Target, Layers, Zap, TrendingUp } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const twelveElements = [
  { name: "痛点共鸣", desc: "精准击中目标用户的真实困扰" },
  { name: "反常识冲击", desc: "用违背直觉的观点打破认知惯性" },
  { name: "数字背书", desc: "用具体数据增强说服力和可信度" },
  { name: "场景还原", desc: "还原真实使用场景引发代入感" },
  { name: "对比冲突", desc: "制造前后对比或观点碰撞" },
  { name: "权威借力", desc: "引用行业权威或专家观点" },
  { name: "情感钩子", desc: "用情绪驱动观众停留和传播" },
  { name: "时效热点", desc: "结合当前热点提升流量曝光" },
  { name: "案例故事", desc: "用真实案例讲述代替空洞说教" },
  { name: "悬念设置", desc: "制造信息差激发好奇心" },
  { name: "实用价值", desc: "提供可直接使用的干货方法" },
  { name: "社交货币", desc: "让用户愿意转发分享的内容标签" },
]

const fourCards = [
  {
    title: "热度卡",
    icon: TrendingUp,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
    desc: "基于热点追踪和对标账号数据，评估话题的当前热度与趋势走向",
  },
  {
    title: "匹配卡",
    icon: Target,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
    desc: "评估话题与企业 IP 定位、知识库内容的匹配度，确保内容不跑偏",
  },
  {
    title: "差异卡",
    icon: Zap,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    desc: "分析对标账号是否已覆盖该角度，找到差异化的切入点和表达方式",
  },
  {
    title: "可行卡",
    icon: Layers,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    desc: "评估选题在当前资源下的可执行性，包括素材获取难度和制作周期",
  },
]

export default function TopicPlanningPage() {
  return (
    <div className="space-y-8 pb-10">
      {/* 页面标题 */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">爆款选题生成</h1>
          <Badge variant="outline" className="text-xs">② 选题策划</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          基于企业知识库、行业热点和对标账号数据，通过 12 元素模型和四卡片评估体系，系统化生成高潜力选题。
        </p>
      </div>

      {/* 四卡片评估体系 */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold tracking-wide">四卡片评估体系</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {fourCards.map((card) => (
            <Card key={card.title} className={`border ${card.borderColor} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.bgColor}`}>
                    <card.icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{card.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 12 元素模型 */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold tracking-wide">12 元素模型</h2>
        <Card>
          <CardContent className="pt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {twelveElements.map((element, index) => (
                <div
                  key={element.name}
                  className="flex items-start gap-3 rounded-lg border border-border/50 p-3 transition-all duration-200 hover:bg-secondary/20 hover:border-primary/20"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{element.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{element.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 功能待开发提示 */}
      <Card className="border-dashed border-2 border-muted-foreground/20 bg-muted/5">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Target className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">选题生成功能正在开发中</p>
          <p className="text-xs text-muted-foreground/60 mt-1">将基于信息来源数据，自动匹配 12 元素并输出四卡片评估结果</p>
        </CardContent>
      </Card>
    </div>
  )
}