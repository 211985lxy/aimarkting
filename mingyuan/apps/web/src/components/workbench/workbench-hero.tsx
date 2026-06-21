import type { ReactNode } from "react"

interface WorkbenchHeroProps {
  title: string
  subtitle?: string
  badge?: ReactNode
  actions?: ReactNode
}

export function WorkbenchHero({ title, subtitle, badge, actions }: WorkbenchHeroProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-primary/15 bg-card shadow-sm">
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
            {badge}
          </div>
          {subtitle ? (
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  )
}
