"use client"

import { Loader2, MessageCircle, Send, Square, Wand2 } from "lucide-react"

import { Button } from "@/components/ui/button"

interface AimPromptComposerProps {
  value: string
  placeholder: string
  busy: boolean
  isRecording: boolean
  isTranscribing: boolean
  isGenerating: boolean
  canGenerate: boolean
  primaryActionLabel: string
  onChange: (value: string) => void
  onSend: () => void
  onGenerate: () => void
  onStop?: () => void
  onStartRecording: () => void
  onStopRecording: () => void
}

export function AimPromptComposer({
  value,
  placeholder,
  busy,
  isRecording,
  isTranscribing,
  isGenerating,
  canGenerate,
  primaryActionLabel,
  onChange,
  onSend,
  onGenerate,
  onStop,
  onStartRecording,
  onStopRecording,
}: AimPromptComposerProps) {
  const canSend = !busy && !isRecording && value.trim().length > 0
  const canStop = busy && !isRecording && Boolean(onStop)

  return (
    <div className="mx-auto max-w-6xl w-full">
      <div className="overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-sm focus-within:ring-2 focus-within:ring-primary/20">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return
            event.preventDefault()
            if (canSend) onSend()
          }}
          rows={1}
          placeholder={placeholder}
          disabled={busy}
          className="max-h-40 min-h-[44px] w-full resize-none bg-transparent px-4 py-2.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
        />
        <div className="flex flex-col gap-2 border-t bg-muted/10 px-3 py-1.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-h-4 text-[11px] leading-4 text-muted-foreground">
            {isTranscribing ? (
              <span className="text-primary">语音转写中...</span>
            ) : isRecording ? (
              <span className="text-red-500">正在录音，点击停止后可发送</span>
            ) : (
              "Enter 发送 · Shift+Enter 换行"
            )}
          </p>
          <div className="flex items-center justify-end gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
              onClick={isRecording ? onStopRecording : onStartRecording}
              disabled={busy && !isRecording}
              title="语音输入"
            >
              {isRecording ? <span className="text-xs text-red-500">停止</span> : <MessageCircle className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={onSend}
              disabled={!canSend}
              title="发送"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
            {canStop && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs text-red-600"
                onClick={onStop}
                title="停止"
              >
                <Square className="h-3.5 w-3.5" />
                停止
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={onGenerate}
              disabled={busy || !canGenerate}
              className="h-8 gap-1.5 text-xs font-semibold shadow-xs"
            >
              {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              {primaryActionLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
