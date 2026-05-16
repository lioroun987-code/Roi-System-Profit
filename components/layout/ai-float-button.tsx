'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, X, Send, Bot, User, CheckCircle, RefreshCw, ChevronDown } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  changes?: { what_changed: string; fields: string[] } | null
  saved?: boolean
  tokensUsed?: number
  error?: boolean
}

const COST_PER_INPUT_TOKEN  = 0.8  / 1_000_000   // $0.80 per 1M input tokens (Haiku)
const COST_PER_OUTPUT_TOKEN = 4    / 1_000_000   // $4 per 1M output tokens (Haiku)
const ILS_RATE              = 3.7

const SUGGESTIONS = [
  'עלות הדיל עלתה ל-$9',
  'שנה עמלת Bit ל-2.5%',
  'עדכן עלות משלוח ל-$3.50',
  'הוסף לכללי AI: ...',
]

function estimateCost(inputTokens: number, outputTokens: number) {
  const usd = inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN
  const ils = usd * ILS_RATE
  return { usd, ils }
}

export function AiFloatButton({ businessId }: { businessId: string | null }) {
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [totalCostIls, setTotalCostIls] = useState(0)
  const bottomRef               = useRef<HTMLDivElement>(null)
  const inputRef                = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200)
  }, [open])

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || loading || !businessId) return
    setInput('')

    const userMsg: Message = { role: 'user', content: msg }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    const history = [...messages, userMsg].slice(-8).map(m => ({
      role: m.role, content: m.content,
    }))

    try {
      const res = await fetch('/api/ai/update-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          message: msg,
          history: history.slice(0, -1),
        }),
      })
      const data = await res.json()

      if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `שגיאה: ${data.error}`, error: true }])
        return
      }

      // Estimate cost (~2000 input + ~500 output per message)
      const estInput  = 2000 + msg.length / 4
      const estOutput = 500
      const { ils } = estimateCost(estInput, estOutput)
      setTotalCostIls(prev => parseFloat((prev + ils).toFixed(4)))

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply,
        changes: data.changes,
        saved:   data.saved ?? false,
        tokensUsed: estInput + estOutput,
      }])

      if (data.updatedConfig) {
        // Dispatch event so settings page can refresh
        window.dispatchEvent(new Event('configUpdated'))
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'שגיאת שרת', error: true }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-2xl font-bold text-white transition-all hover:-translate-y-1 hover:shadow-purple-500/25"
        style={{
          background: open ? '#374151' : 'linear-gradient(135deg,#6366F1,#8B5CF6)',
          boxShadow: open ? 'none' : '0 8px 32px rgba(99,102,241,0.4)',
        }}
      >
        {open ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
        <span className="text-sm">{open ? 'סגור' : 'עדכן עם AI'}</span>
        {!open && messages.length > 0 && (
          <span className="w-2 h-2 rounded-full bg-green-400 absolute -top-1 -right-1" />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-20 left-6 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
          style={{
            width: '380px',
            height: '560px',
            background: '#0D0F14',
            border: '1px solid #1E2130',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ background: 'linear-gradient(135deg,#1E1A3A,#1A1F3A)', borderBottom: '1px solid #1E2130' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">עוזר AI</p>
                <p className="text-xs" style={{ color: '#4A5174' }}>
                  {businessId ? 'מחובר לעסק' : 'לא נבחר עסק'}
                </p>
              </div>
            </div>
            <div className="text-left">
              <p className="text-xs font-medium" style={{ color: totalCostIls > 0 ? '#F59E0B' : '#374151' }}>
                {totalCostIls > 0 ? `~₪${totalCostIls.toFixed(3)} הפעלה זו` : '~₪0.05 לשאלה'}
              </p>
              <p className="text-xs" style={{ color: '#374151' }}>Claude Sonnet</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3 pt-2">
                <p className="text-xs text-center" style={{ color: '#4A5174' }}>
                  תאר שינוי שאתה רוצה לעשות במערכת
                </p>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="w-full text-right text-xs px-3 py-2 rounded-xl transition-all hover:opacity-80"
                    style={{ background: '#13161F', border: '1px solid #1E2130', color: '#CBD5E1' }}>
                    {s}
                  </button>
                ))}
                {/* Cost info */}
                <div className="rounded-xl px-3 py-2.5 text-xs" style={{ background: '#13161F', border: '1px solid #1E2130' }}>
                  <p className="font-medium mb-1.5" style={{ color: '#CBD5E1' }}>💰 עלות שימוש</p>
                  <div className="space-y-1" style={{ color: '#4A5174' }}>
                    <div className="flex justify-between">
                      <span>לשאלה ממוצעת</span>
                      <span style={{ color: '#22C55E' }}>~$0.002 ≈ ₪0.007</span>
                    </div>
                    <div className="flex justify-between">
                      <span>1,000 שאלות בחודש</span>
                      <span style={{ color: '#22C55E' }}>~$2 ≈ ₪7</span>
                    </div>
                    <div className="flex justify-between">
                      <span>מודל</span>
                      <span>Claude Haiku 4.5</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: m.error ? '#2D0F0F' : 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                )}
                <div className="max-w-[85%] space-y-1.5">
                  <div className="px-3 py-2.5 rounded-2xl text-sm leading-relaxed"
                    style={{
                      background: m.role === 'user'
                        ? 'linear-gradient(135deg,#3B82F6,#6366F1)'
                        : m.error ? '#2D0F0F' : '#13161F',
                      color: m.error ? '#FCA5A5' : '#F1F5F9',
                      borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      fontSize: '13px',
                    }}>
                    {m.content}
                  </div>
                  {m.changes && (
                    <div className="flex items-center gap-1.5 flex-wrap px-1">
                      <div className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                        style={{ background: '#0D2818', color: '#22C55E', border: '1px solid #166534' }}>
                        <CheckCircle className="w-2.5 h-2.5" />
                        {m.changes.what_changed}
                      </div>
                    </div>
                  )}
                </div>
                {m.role === 'user' && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: '#1E2846' }}>
                    <User className="w-3 h-3" style={{ color: '#4F6EF7' }} />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="px-3 py-2 rounded-2xl text-xs flex items-center gap-1.5"
                  style={{ background: '#13161F', color: '#4A5174', borderRadius: '16px 16px 16px 4px' }}>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  מעדכן הגדרות...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-2 shrink-0" style={{ borderTop: '1px solid #1E2130' }}>
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                disabled={loading || !businessId}
                placeholder={businessId ? 'תאר שינוי... (Enter לשליחה)' : 'בחר עסק תחילה'}
                rows={2}
                style={{
                  flex: 1,
                  background: '#13161F',
                  border: '1px solid #1E2130',
                  color: '#CBD5E1',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  outline: 'none',
                  resize: 'none',
                  lineHeight: '1.5',
                }}
              />
              <button onClick={() => send()} disabled={loading || !input.trim() || !businessId}
                className="w-9 h-9 flex items-center justify-center rounded-xl transition-all disabled:opacity-40 hover:-translate-y-0.5 shrink-0"
                style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
            {messages.length > 0 && (
              <button onClick={() => { setMessages([]); setTotalCostIls(0) }}
                className="mt-1.5 text-xs hover:underline" style={{ color: '#374151' }}>
                נקה שיחה
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
