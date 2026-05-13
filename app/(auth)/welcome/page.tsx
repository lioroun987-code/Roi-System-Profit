'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

function useAnimatedNumber(from: number, to: number, duration: number, active: boolean) {
  const [val, setVal] = useState(from)
  useEffect(() => {
    if (!active) return
    const start = performance.now()
    const diff = to - from
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
    const frame = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      setVal(Math.round(from + diff * easeOut(progress)))
      if (progress < 1) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }, [active, from, to, duration])
  return val
}

type Phase = 'enter' | 'low' | 'turning' | 'climbing' | 'peak' | 'tagline' | 'cta'

export default function WelcomePage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('enter')
  const [exiting, setExiting] = useState(false)
  const climbActive = phase === 'climbing' || phase === 'peak' || phase === 'tagline' || phase === 'cta'
  const profit = useAnimatedNumber(8250, 17270, 2200, climbActive)

  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = []
    t.push(setTimeout(() => setPhase('low'),      800))
    t.push(setTimeout(() => setPhase('turning'),  2200))
    t.push(setTimeout(() => setPhase('climbing'), 3400))
    t.push(setTimeout(() => setPhase('peak'),     5800))
    t.push(setTimeout(() => setPhase('tagline'),  6600))
    t.push(setTimeout(() => setPhase('cta'),      8200))
    return () => t.forEach(clearTimeout)
  }, [])

  function go(path: string) {
    setExiting(true)
    setTimeout(() => router.push(path), 500)
  }

  const numberColor =
    phase === 'low' || phase === 'enter'        ? '#FFFFFF' :
    phase === 'turning'                          ? '#EF4444' :
    phase === 'climbing'                         ? '#F97316' :
    '#22C55E'

  const showNumber   = ['low','turning','climbing','peak','tagline','cta'].includes(phase)
  const showSubtitle = ['turning','climbing','peak','tagline','cta'].includes(phase)
  const showTagline  = ['tagline','cta'].includes(phase)
  const showCta      = phase === 'cta'

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center"
      style={{
        background: '#030712',
        transition: 'opacity 0.5s ease',
        opacity: exiting ? 0 : 1,
      }}
    >
      {/* Ambient glow behind number */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="rounded-full blur-3xl transition-all duration-1000"
          style={{
            width: 600, height: 400,
            background: phase === 'low' || phase === 'enter'  ? 'rgba(99,102,241,0.06)' :
                        phase === 'turning'                    ? 'rgba(239,68,68,0.08)' :
                        phase === 'climbing'                   ? 'rgba(249,115,22,0.1)' :
                                                                 'rgba(34,197,94,0.08)',
          }}
        />
      </div>

      {/* Skip */}
      {phase !== 'enter' && (
        <button onClick={() => go('/dashboard')}
          className="absolute top-6 left-6 text-xs px-3 py-1.5 rounded-full transition-colors"
          style={{ color: '#374151', border: '1px solid #1F2937' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#9CA3AF')}
          onMouseLeave={e => (e.currentTarget.style.color = '#374151')}
        >
          דלג
        </button>
      )}

      {/* Logo */}
      <div className="absolute top-6 flex items-center gap-2.5"
        style={{ opacity: phase === 'enter' ? 0 : 0.6, transition: 'opacity 1s ease 0.5s' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M16 7h6v6M22 7l-8.5 8.5-5-5L2 17"/>
          </svg>
        </div>
        <span className="text-white font-semibold text-sm tracking-tight">רווחיות</span>
      </div>

      {/* Main content */}
      <div className="text-center px-6 max-w-2xl w-full">

        {/* Label above number */}
        <div style={{
          opacity: showNumber ? 1 : 0,
          transform: showNumber ? 'translateY(0)' : 'translateY(12px)',
          transition: 'all 0.6s ease',
          marginBottom: '12px',
        }}>
          <span className="text-sm font-medium tracking-widest uppercase"
            style={{ color: '#4B5563', letterSpacing: '0.15em' }}>
            {phase === 'low' ? 'הרווח החודשי שאתה מכיר' :
             phase === 'turning' ? 'רגע... בואו נסתכל מקרוב' :
             phase === 'climbing' ? 'עלויות שלא חישבת מתגלות...' :
             'הרווח האמיתי שלך'}
          </span>
        </div>

        {/* The big number */}
        <div style={{
          opacity: showNumber ? 1 : 0,
          transition: 'opacity 0.8s ease',
        }}>
          <div className="relative inline-block">
            {/* Strikethrough for "turning" phase */}
            {phase === 'turning' && (
              <div className="absolute inset-x-0 top-1/2 h-1 rounded-full"
                style={{ background: '#EF4444', transform: 'translateY(-50%)', animation: 'strikethrough 0.4s ease forwards' }}
              />
            )}
            <span className="font-black tabular-nums transition-colors duration-500"
              style={{
                fontSize: 'clamp(72px, 12vw, 120px)',
                lineHeight: 1,
                color: numberColor,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.03em',
              }}>
              ₪{phase === 'low' || phase === 'turning' ? '8,250' : profit.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Subtitle */}
        <div style={{
          marginTop: '20px',
          opacity: showSubtitle ? 1 : 0,
          transform: showSubtitle ? 'translateY(0)' : 'translateY(8px)',
          transition: 'all 0.6s ease 0.1s',
          minHeight: 28,
        }}>
          {phase === 'turning' && (
            <p className="text-lg" style={{ color: '#EF4444' }}>
              ⚠️ עלויות שחישבת בצורה לא מדויקת
            </p>
          )}
          {phase === 'climbing' && (
            <p className="text-lg" style={{ color: '#F97316' }}>
              המספר הנכון מתחיל לעלות...
            </p>
          )}
          {(phase === 'peak' || phase === 'tagline' || phase === 'cta') && (
            <p className="text-lg" style={{ color: '#22C55E' }}>
              ✓ זה הרווח האמיתי שלך
            </p>
          )}
        </div>

        {/* Tagline */}
        <div style={{
          marginTop: '40px',
          opacity: showTagline ? 1 : 0,
          transform: showTagline ? 'translateY(0)' : 'translateY(16px)',
          transition: 'all 0.7s ease',
        }}>
          <p className="text-xl font-semibold" style={{ color: '#F9FAFB', lineHeight: 1.5 }}>
            זה מה שקורה כשאתה יודע בדיוק כמה עולה לך כל הזמנה
          </p>
          <p className="mt-3 text-base" style={{ color: '#6B7280' }}>
            המערכת היחידה שמחשבת את הרווח הסופי שלך ברמה המדויקת ביותר
            <br />
            באמצעות בינה מלאכותית מותאמת אישית לחנות שלך
          </p>
        </div>

        {/* CTA */}
        <div style={{
          marginTop: '48px',
          opacity: showCta ? 1 : 0,
          transform: showCta ? 'translateY(0)' : 'translateY(16px)',
          transition: 'all 0.6s ease',
        }}>
          <button
            onClick={() => go('/onboarding')}
            className="group inline-flex items-center gap-3 px-10 py-4 rounded-2xl text-lg font-bold text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
            style={{
              background: 'linear-gradient(135deg, #22C55E, #16A34A)',
              boxShadow: '0 0 40px rgba(34,197,94,0.3)',
            }}
          >
            גלה את הרווח האמיתי שלך
            <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <p className="mt-3 text-sm" style={{ color: '#374151' }}>
            5 דקות הגדרה • ללא כרטיס אשראי
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes strikethrough {
          from { transform: translateY(-50%) scaleX(0); }
          to   { transform: translateY(-50%) scaleX(1); }
        }
      `}</style>
    </div>
  )
}
