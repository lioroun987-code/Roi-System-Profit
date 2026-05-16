'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, CheckCircle, RefreshCw, Sparkles } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  changes?: { what_changed: string; fields: string[] } | null
  error?: boolean
}

const SUGGESTIONS = [
  'עלות הדיל עלתה ל-$9 מהיום',
  'שינוי עמלת Bit ל-2.5%',
  'הוסף לכללי ה-AI: קפסולה הפתעה עולה $0.90',
  'שנה מחיר מכירה של הדיל ל-₪109',
  'עלות משלוח לבית השתנתה ל-$3.50',
  'הנחת יחידה שנייה ירדה ל-$1.50',
]

export function AiConfigChat({ businessId, onConfigChange }: {
  businessId: string
  onConfigChange?: () => void
}) {
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const bottomRef                 = useRef<HTMLDivElement>(null)
  const inputRef                  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')

    const userMsg: Message = { role: 'user', content: msg }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    // Build history for context (last 6 messages)
    const history = [...messages, userMsg].slice(-6).map(m => ({
      role: m.role,
      content: m.content,
    }))

    try {
      const res = await fetch('/api/ai/update-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, message: msg, history: history.slice(0, -1) }),
      })
      const data = await res.json()

      if (data.error) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `שגיאה: ${data.error}`,
          error: true,
        }])
        return
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply,
        changes: data.changes,
      }])

      if (data.updatedConfig) {
        onConfigChange?.()
      }
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'שגיאת שרת — נסה שוב',
        error: true,
      }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ minHeight: '500px' }}>

      {/* Header */}
      <div className="flex items-center gap-3 pb-4 mb-4" style={{ borderBottom: '1px solid #1E2130' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-white font-semibold text-sm">עוזר AI להגדרות</h3>
          <p className="text-xs" style={{ color: '#4A5174' }}>כתוב כל שינוי בעברית — AI יעדכן את המערכת אוטומטית</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4" style={{ maxHeight: '420px' }}>
        {messages.length === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-center py-4" style={{ color: '#4A5174' }}>
              תאר כל שינוי שאתה רוצה לעשות במערכת
            </p>
            <div className="grid grid-cols-1 gap-2">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)}
                  className="text-right text-sm px-4 py-2.5 rounded-xl transition-all hover:-translate-y-0.5"
                  style={{ background: '#13161F', border: '1px solid #1E2130', color: '#CBD5E1' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1"
                style={{ background: m.error ? '#2D0F0F' : 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
            )}

            <div className="max-w-[80%] space-y-2">
              <div className="px-4 py-3 rounded-2xl text-sm leading-relaxed"
                style={{
                  background: m.role === 'user'
                    ? 'linear-gradient(135deg,#3B82F6,#6366F1)'
                    : m.error ? '#2D0F0F' : '#13161F',
                  color: m.error ? '#FCA5A5' : '#F1F5F9',
                  borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                }}>
                {m.content}
              </div>

              {/* Changes badge */}
              {m.changes && (
                <div className="flex flex-wrap gap-1.5 px-1">
                  <div className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
                    style={{ background: '#0D2818', color: '#22C55E', border: '1px solid #166534' }}>
                    <CheckCircle className="w-3 h-3" />
                    {m.changes.what_changed}
                  </div>
                  {m.changes.fields?.slice(0, 3).map(f => (
                    <span key={f} className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: '#1E2130', color: '#6B7280' }}>
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {m.role === 'user' && (
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1"
                style={{ background: '#1E2846' }}>
                <User className="w-3.5 h-3.5" style={{ color: '#4F6EF7' }} />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="px-4 py-3 rounded-2xl text-sm flex items-center gap-2"
              style={{ background: '#13161F', color: '#4A5174', borderRadius: '18px 18px 18px 4px' }}>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              מעדכן הגדרות...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="pt-4" style={{ borderTop: '1px solid #1E2130' }}>
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
            placeholder="תאר שינוי... (Enter לשליחה, Shift+Enter לשורה חדשה)"
            rows={2}
            style={{
              flex: 1,
              background: '#0D0F14',
              border: '1px solid #1E2130',
              color: '#CBD5E1',
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '14px',
              outline: 'none',
              resize: 'none',
              lineHeight: '1.5',
            }}
          />
          <button onClick={() => send()} disabled={loading || !input.trim()}
            className="flex items-center justify-center w-10 h-10 rounded-xl transition-all disabled:opacity-40 hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: 'white', flexShrink: 0 }}>
            <Send className="w-4 h-4" />
          </button>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])}
            className="mt-2 text-xs hover:underline"
            style={{ color: '#374151' }}>
            נקה שיחה
          </button>
        )}
      </div>
    </div>
  )
}
