'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, ArrowLeft, CheckCircle } from 'lucide-react'

type Stage = 'intro' | 'fake' | 'reality' | 'reveal' | 'features' | 'cta'

function useCountUp(target: number, duration: number, active: boolean) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) return
    let start = 0
    const steps = 60
    const increment = target / steps
    const interval = duration / steps
    const timer = setInterval(() => {
      start += increment
      if (start >= target) { setVal(target); clearInterval(timer) }
      else setVal(Math.floor(start))
    }, interval)
    return () => clearInterval(timer)
  }, [active, target, duration])
  return val
}

const FEATURES = [
  { icon: '🎯', title: 'רווח נקי לכל הזמנה', desc: 'ברמת האגורה — אחרי כל עלות' },
  { icon: '🤖', title: 'AI מבין את הכללים שלך', desc: 'הנחות, קופונים, קפסולות מתנה' },
  { icon: '💳', title: 'עמלות לפי אמצעי תשלום', desc: 'Bit, אשראי, Apple Pay ועוד' },
  { icon: '📊', title: 'פרסום מול רווח אמיתי', desc: 'ROAS על בסיס רווח, לא הכנסות' },
]

export default function WelcomePage() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('intro')
  const [featureIdx, setFeatureIdx] = useState(0)
  const [exit, setExit] = useState(false)

  const fakeActive  = stage === 'fake' || stage === 'reality' || stage === 'reveal' || stage === 'features' || stage === 'cta'
  const realActive  = stage === 'reveal' || stage === 'features' || stage === 'cta'
  const fakeProfit  = useCountUp(850, 1200, fakeActive)
  const realProfit  = useCountUp(312, 1000, realActive)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    timers.push(setTimeout(() => setStage('fake'),     1200))
    timers.push(setTimeout(() => setStage('reality'),  3800))
    timers.push(setTimeout(() => setStage('reveal'),   5800))
    timers.push(setTimeout(() => setStage('features'), 8000))
    timers.push(setTimeout(() => setStage('cta'),      11000))
    return () => timers.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    if (stage !== 'features') return
    const t = setInterval(() => setFeatureIdx(i => (i + 1) % FEATURES.length), 1800)
    return () => clearInterval(t)
  }, [stage])

  function handleStart() {
    setExit(true)
    setTimeout(() => router.push('/onboarding'), 600)
  }

  function handleSkip() {
    router.push('/dashboard')
  }

  const visible = (s: Stage) =>
    stage === s || (s === 'fake' && ['fake','reality','reveal','features','cta'].includes(stage)) ||
    (s === 'reality' && ['reality','reveal','features','cta'].includes(stage)) ||
    (s === 'reveal' && ['reveal','features','cta'].includes(stage))

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, #0f1a3a 0%, #030712 60%)',
        transition: 'opacity 0.6s ease',
        opacity: exit ? 0 : 1,
      }}
    >
      {/* Stars background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(40)].map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 2 + 1,
              height: Math.random() * 2 + 1,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.5 + 0.1,
              animation: `pulse ${Math.random() * 3 + 2}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      {/* Logo */}
      <div className="absolute top-8 flex items-center gap-3"
        style={{ opacity: stage === 'intro' ? 0 : 1, transition: 'opacity 0.8s ease', transitionDelay: '0.3s' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <span className="text-white font-bold text-lg">רווחיות</span>
      </div>

      {/* Skip button */}
      {stage !== 'intro' && (
        <button onClick={handleSkip}
          className="absolute top-8 left-8 text-sm transition-colors"
          style={{ color: '#4A5174' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#CBD5E1')}
          onMouseLeave={e => (e.currentTarget.style.color = '#4A5174')}
        >
          דלג →
        </button>
      )}

      {/* Stage: INTRO */}
      {stage === 'intro' && (
        <div className="text-center"
          style={{ animation: 'fadeInUp 0.8s ease forwards' }}>
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)', boxShadow: '0 0 60px rgba(99,102,241,0.4)' }}>
            <TrendingUp className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-3">ברוך הבא לרווחיות</h1>
          <p className="text-lg" style={{ color: '#6B7280' }}>רק 20 שניות שישנו את הדרך שאתה מנהל את העסק שלך</p>
        </div>
      )}

      {/* Main animation area */}
      {stage !== 'intro' && stage !== 'features' && stage !== 'cta' && (
        <div className="text-center max-w-2xl px-6 w-full">

          {/* Question */}
          <div style={{
            opacity: visible('fake') ? 1 : 0,
            transform: visible('fake') ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.8s ease',
          }}>
            <p className="text-xl font-medium mb-2" style={{ color: '#9CA3AF' }}>
              על הזמנה אחת — כמה אתה חושב שהרווחת?
            </p>
            <div className="relative inline-block">
              <span className="text-8xl font-black"
                style={{
                  color: stage === 'reality' || stage === 'reveal' ? '#6B7280' : '#FFFFFF',
                  textDecoration: stage === 'reality' || stage === 'reveal' ? 'line-through' : 'none',
                  transition: 'color 0.5s ease',
                }}>
                ₪{fakeProfit.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Reality label */}
          {(stage === 'reality' || stage === 'reveal') && (
            <div className="mt-6" style={{ animation: 'fadeInUp 0.6s ease forwards' }}>
              <p className="text-base font-medium" style={{ color: '#EF4444' }}>
                אחרי עמלות סליקה, הנחות, עלויות משלוח וקפסולות מתנה...
              </p>
              <div className="flex items-center justify-center gap-2 mt-1" style={{ color: '#6B7280', fontSize: 13 }}>
                <span>💳 עמלת Bit 3%</span>
                <span>•</span>
                <span>🎁 קפסולת הפתעה</span>
                <span>•</span>
                <span>🚚 עלות משלוח</span>
                <span>•</span>
                <span>💰 עלות מוצר</span>
              </div>
            </div>
          )}

          {/* Real profit */}
          {stage === 'reveal' && (
            <div className="mt-6" style={{ animation: 'fadeInUp 0.8s ease forwards' }}>
              <p className="text-lg font-medium mb-2" style={{ color: '#9CA3AF' }}>הרווח האמיתי שלך:</p>
              <span className="text-8xl font-black" style={{ color: '#22C55E' }}>
                ₪{realProfit.toLocaleString()}
              </span>
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full"
                style={{ background: '#1A0A0A', border: '1px solid #EF444440' }}>
                <span style={{ color: '#EF4444' }}>⚠️</span>
                <span className="text-sm" style={{ color: '#FCA5A5' }}>
                  פער של ₪{(850 - 312).toLocaleString()} — {Math.round((538/850)*100)}% מהמה שחשבת
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Features carousel */}
      {stage === 'features' && (
        <div className="text-center max-w-xl px-6 w-full"
          style={{ animation: 'fadeInUp 0.6s ease forwards' }}>
          <p className="text-sm font-medium mb-8 uppercase tracking-widest" style={{ color: '#4F6EF7' }}>
            עם רווחיות תקבל
          </p>
          <div className="relative h-40 flex items-center justify-center">
            {FEATURES.map((f, i) => (
              <div key={i} className="absolute text-center transition-all duration-500"
                style={{
                  opacity: i === featureIdx ? 1 : 0,
                  transform: i === featureIdx ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(20px)',
                }}>
                <div className="text-5xl mb-3">{f.icon}</div>
                <h3 className="text-2xl font-bold text-white mb-2">{f.title}</h3>
                <p style={{ color: '#6B7280' }}>{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-2 mt-8">
            {FEATURES.map((_, i) => (
              <div key={i} className="rounded-full transition-all duration-300"
                style={{
                  width: i === featureIdx ? 24 : 6,
                  height: 6,
                  background: i === featureIdx ? '#4F6EF7' : '#1E2130',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      {stage === 'cta' && (
        <div className="text-center max-w-lg px-6 w-full"
          style={{ animation: 'fadeInUp 0.8s ease forwards' }}>
          <div className="text-6xl mb-6">🎯</div>
          <h2 className="text-4xl font-extrabold text-white mb-4 leading-tight">
            מוכן לדעת את הרווח<br/>
            <span style={{ color: '#4F6EF7' }}>האמיתי שלך?</span>
          </h2>
          <p className="text-lg mb-8" style={{ color: '#6B7280' }}>
            5 דקות הגדרה — ותדע בדיוק כמה נשאר בכיס מכל הזמנה
          </p>
          <button
            onClick={handleStart}
            className="group flex items-center gap-3 mx-auto px-10 py-5 rounded-2xl text-xl font-bold text-white transition-all hover:-translate-y-1"
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              boxShadow: '0 20px 60px rgba(99,102,241,0.4)',
            }}
          >
            בואו נתחיל
            <ArrowLeft className="w-6 h-6 transition-transform group-hover:-translate-x-1" />
          </button>
          <p className="text-sm mt-4" style={{ color: '#374151' }}>לוקח 5 דקות • ניתן לדלג על שלבים</p>
        </div>
      )}

      {/* Progress dots */}
      {stage !== 'intro' && stage !== 'cta' && (
        <div className="absolute bottom-10 flex gap-2">
          {(['fake','reality','reveal','features'] as Stage[]).map(s => (
            <div key={s} className="w-2 h-2 rounded-full transition-all duration-500"
              style={{ background: stage === s ? '#4F6EF7' : '#1E2130' }}
            />
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
