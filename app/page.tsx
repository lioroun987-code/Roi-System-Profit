'use client'

import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import { TrendingUp, CheckCircle, ArrowLeft, Star, Zap, BarChart2, ShoppingBag, Shield, Users, ArrowRight } from 'lucide-react'

/* ── Live feed ── */
const EVENTS = [
  { name: 'יעל כ.', action: 'רווח נקי ₪284 על הזמנה #1042 — דיל + 3 קפסולות', time: '8 שנ\'', color: 'bg-emerald-500' },
  { name: 'דוד ל.', action: 'זיהה הזמנה מפסידה -₪23 — בקבוק + קופון 50₪', time: '31 שנ\'', color: 'bg-red-500' },
  { name: 'מיכל א.', action: 'ROAS אמיתי 3.8x לעומת 6.2x שהציג Shopify', time: '1 דק\'', color: 'bg-blue-500' },
  { name: 'רון ש.', action: 'סנכרן 147 הזמנות — רווח חודשי ₪22,400', time: '2 דק\'', color: 'bg-purple-500' },
  { name: 'שרה מ.', action: 'AI זיהה 3 קפסולות הפתעה — עלות עסקית ₪9.25', time: '4 דק\'', color: 'bg-orange-500' },
]

function LiveFeed() {
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false)
      setTimeout(() => { setIdx(i => (i + 1) % EVENTS.length); setVisible(true) }, 300)
    }, 3500)
    return () => clearInterval(t)
  }, [])

  const e = EVENTS[idx]
  return (
    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-full pl-4 pr-2 py-2 shadow-md text-sm max-w-full overflow-hidden">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
      <div className={`transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'} flex items-center gap-2 min-w-0`}>
        <span className={`w-5 h-5 rounded-full ${e.color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>{e.name[0]}</span>
        <span className="font-semibold text-gray-900 shrink-0">{e.name}</span>
        <span className="text-gray-500 truncate">{e.action}</span>
        <span className="text-gray-400 text-xs shrink-0">{e.time}</span>
      </div>
    </div>
  )
}

/* ── Marquee ── */
const INTEGRATIONS = ['Shopify', 'Facebook Ads', 'Google Sheets', 'Claude AI', 'Meta', 'Instagram Ads', 'Webhook', 'Prisma', 'Shopify', 'Facebook Ads', 'Google Sheets', 'Claude AI', 'Meta', 'Instagram Ads', 'Webhook', 'Prisma']

function Marquee() {
  return (
    <div className="overflow-hidden w-full py-4 border-y border-gray-100">
      <div className="flex animate-marquee whitespace-nowrap gap-12">
        {INTEGRATIONS.map((name, i) => (
          <span key={i} className="text-gray-400 font-semibold text-sm flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />
            {name}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── Animated counter ── */
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      obs.disconnect()
      let start = 0
      const step = Math.ceil(to / 60)
      const timer = setInterval(() => {
        start += step
        if (start >= to) { setVal(to); clearInterval(timer) }
        else setVal(start)
      }, 20)
    }, { threshold: 0.5 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [to])

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>
}

/* ── Dashboard mockup ── */
function DashboardMockup() {
  return (
    <div className="relative animate-float">
      <div className="absolute -inset-4 bg-gradient-to-tr from-blue-500/20 via-purple-500/10 to-transparent rounded-3xl blur-2xl" />
      <div className="relative bg-gray-950 rounded-2xl shadow-2xl border border-gray-800 overflow-hidden">
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 px-4 py-3 bg-gray-900 border-b border-gray-800">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <div className="flex-1 mx-3 bg-gray-800 rounded h-4 flex items-center px-2">
            <span className="text-gray-500 text-xs">רווחיות — לוח בקרה</span>
          </div>
        </div>

        <div className="p-4">
          {/* KPI row */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { label: 'רווח נקי', val: '₪1,840', sub: '↑ 12%', col: 'text-emerald-400' },
              { label: 'הכנסות', val: '₪6,200', sub: '↑ 8%', col: 'text-white' },
              { label: 'הזמנות', val: '23', sub: 'היום', col: 'text-white' },
              { label: 'ROAS', val: '4.1x', sub: 'אמיתי', col: 'text-blue-400' },
            ].map(k => (
              <div key={k.label} className="bg-gray-900 rounded-xl p-2.5 border border-gray-800">
                <p className="text-gray-500 text-xs mb-1">{k.label}</p>
                <p className={`font-bold text-sm ${k.col}`}>{k.val}</p>
                <p className="text-gray-600 text-xs">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Mini chart */}
          <div className="bg-gray-900 rounded-xl p-3 mb-3 border border-gray-800">
            <div className="flex items-end gap-1 h-14">
              {[35,50,40,70,55,85,60,90,65,95,75,100].map((h, i) => (
                <div key={i} className="flex-1 rounded-sm transition-all"
                  style={{ height: `${h}%`, background: `hsl(${217 - i * 2}, 80%, ${45 + h * 0.2}%)`, opacity: 0.8 }} />
              ))}
            </div>
          </div>

          {/* Orders */}
          <div className="space-y-1.5">
            {[
              { n:'#1042', t:'דיל + 3 קפסולות (10% הנחה)', p:'+₪202', pos:true },
              { n:'#1041', t:'2× Cool Deal + הפתעה', p:'+₪384', pos:true },
              { n:'#1040', t:'בקבוק + קופון 50₪', p:'-₪12', pos:false },
            ].map(o => (
              <div key={o.n} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${o.pos ? 'bg-gray-900 border border-gray-800' : 'bg-red-950/50 border border-red-900/40'}`}>
                <span className="text-gray-600 font-mono w-10 shrink-0">{o.n}</span>
                <span className="text-gray-300 flex-1 truncate">{o.t}</span>
                <span className={`font-bold shrink-0 ${o.pos ? 'text-emerald-400' : 'text-red-400'}`}>{o.p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating cards */}
      <div className="absolute -right-6 top-16 bg-white rounded-xl shadow-xl border border-gray-100 p-3 text-xs animate-float" style={{ animationDelay: '0.5s' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div>
            <p className="font-bold text-gray-900">+₪384</p>
            <p className="text-gray-400">רווח נקי</p>
          </div>
        </div>
      </div>

      <div className="absolute -left-6 bottom-20 bg-white rounded-xl shadow-xl border border-gray-100 p-3 text-xs animate-float" style={{ animationDelay: '1s' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
            <span className="text-red-600 text-xs font-bold">!</span>
          </div>
          <div>
            <p className="font-bold text-gray-900">הזמנה מפסידה</p>
            <p className="text-red-500">-₪12 נקי</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Main ── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center animate-pulse-glow">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-lg tracking-tight">רווחיות</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-500">
            <a href="#features" className="hover:text-gray-900 transition-colors">פיצ׳רים</a>
            <a href="#how" className="hover:text-gray-900 transition-colors">איך זה עובד</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">מחירים</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/signin" className="text-gray-500 hover:text-gray-900 text-sm font-medium transition-colors">התחברות</Link>
            <Link href="/signup" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-0.5">
              התחל חינם
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-6 pt-16 pb-24 overflow-hidden">
        {/* BG */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(219,234,254,0.6),rgba(255,255,255,0))]" />
        <div className="absolute top-32 left-1/4 w-72 h-72 bg-purple-100/40 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl" />

        <div className="max-w-6xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left */}
            <div className="animate-fadeInUp">
              <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-4 py-2 text-sm font-medium text-blue-700 mb-8">
                <Zap className="w-3.5 h-3.5" />
                מופעל על ידי Claude AI — ניתוח מדויק 100%
              </div>

              <h1 className="text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight mb-6">
                לא יודע כמה{' '}
                <span className="gradient-text">אתה באמת מרוויח?</span>{' '}
                <br />קבל את האמת.
              </h1>

              <p className="text-xl text-gray-500 leading-relaxed mb-8 max-w-lg">
                המערכת היחידה שמחשבת <strong className="text-gray-900">רווח נקי אמיתי</strong> לכל הזמנה —
                אחרי עלות מוצר, הנחות, עמלות תשלום ומע"מ. לא ROAS. לא הכנסות. כמה נשאר בכיס.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <Link href="/signup" className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl text-lg font-bold transition-all shadow-xl shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-0.5">
                  התחל 14 יום חינם
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <Link href="/signin" className="inline-flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 px-8 py-4 rounded-xl text-lg font-semibold transition-colors">
                  כניסה למערכת
                </Link>
              </div>

              <div className="flex items-center gap-4 mb-8">
                <div className="flex -space-x-2">
                  {['#3b82f6','#8b5cf6','#10b981','#f59e0b'].map((c,i) => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold" style={{ background: c }}>
                      {['י','ד','מ','ר'][i]}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_,i) => <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />)}
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5">מדורג 4.9/5 על ידי בעלי חנויות</p>
                </div>
              </div>

              <LiveFeed />
            </div>

            {/* Right */}
            <div className="animate-slideInRight delay-200 hidden lg:block">
              <DashboardMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Marquee */}
      <Marquee />

      {/* Stats */}
      <section className="px-6 py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            { num: 100, suffix: '%', label: 'דיוק בחישוב הרווח', sub: 'לא הערכות — מספרים אמיתיים' },
            { num: 5, suffix: ' דק\'', label: 'הגדרה ראשונית', sub: 'חיבור Shopify + הגדרת עלויות' },
            { num: 3, suffix: 'x', label: 'יותר מדויק מ-Triple Whale', sub: 'אנחנו מחשבים רווח, לא ROAS' },
          ].map(s => (
            <div key={s.label} className="hover-lift p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-4xl font-extrabold gradient-text mb-2">
                <Counter to={s.num} suffix={s.suffix} />
              </p>
              <p className="font-bold text-gray-900 mb-1 text-sm">{s.label}</p>
              <p className="text-gray-500 text-xs">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pain vs Solution */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-extrabold text-gray-900 mb-4">
              Triple Whale נותן לך ROAS יפה.{' '}
              <span className="gradient-text">אנחנו נותנים לך את האמת.</span>
            </h2>
            <p className="text-gray-500 text-lg">60% מבעלי החנויות לא יודעים את הרווח האמיתי שלהם</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-8 border border-gray-200 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-500 font-bold">✕</div>
                <h3 className="font-bold text-gray-500 text-lg">Triple Whale / Shopify Reports</h3>
              </div>
              <ul className="space-y-3">
                {[
                  'מראה ROAS — לא רווח נקי',
                  'לא מוריד עלות מוצר אמיתית',
                  'לא מבין הנחות כמות ומדור',
                  'לא מחשב עמלת Bit / PayPal',
                  'לא מזהה קפסולות מתנה',
                  'לא מחשב VAT ועלויות משלוח',
                ].map(item => (
                  <li key={item} className="flex items-center gap-3 text-gray-500 text-sm">
                    <span className="w-5 h-5 rounded-full bg-red-50 border border-red-200 text-red-400 flex items-center justify-center shrink-0 text-xs">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl p-8 text-white hover-lift" style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-xl">רווחיות — הרווח האמיתי שלך</h3>
              </div>
              <ul className="space-y-3">
                {[
                  'רווח נקי לכל הזמנה — בשניות',
                  'AI מבין עלות מוצר מדויקת',
                  'מחשב כל סוגי ההנחות אוטומטית',
                  'מוריד עמלה לפי אמצעי תשלום',
                  'מזהה קפסולות מתנה והפתעה',
                  'מחשב VAT ומשלוח בדיוק',
                ].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm text-white/90">
                    <CheckCircle className="w-5 h-5 text-white/80 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-extrabold text-gray-900 mb-4">כל מה שצריך במקום אחד</h2>
            <p className="text-gray-500 text-lg">מחובר לכל הכלים שכבר משתמש בהם</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: ShoppingBag, title: 'Shopify Webhook', desc: 'כל הזמנה נכנסת אוטומטית ומנותחת תוך שניות. חיבור בלחיצה אחת.', color: 'bg-green-100 text-green-600', border: 'hover:border-green-200' },
              { icon: Zap, title: 'AI Order Analysis', desc: 'Claude AI מפרק כל הזמנה ומחשב רווח נקי מדויק לפי הכללים שלך.', color: 'bg-blue-100 text-blue-600', border: 'hover:border-blue-200' },
              { icon: BarChart2, title: 'דשבורד רווחיות', desc: 'רווח יומי, שבועי וחודשי. הזמנות מפסידות מסומנות באדום.', color: 'bg-purple-100 text-purple-600', border: 'hover:border-purple-200' },
              { icon: TrendingUp, title: 'Facebook Ads', desc: 'ROAS על בסיס רווח אמיתי — לא על הכנסות. כמה באמת החזרת על הפרסום.', color: 'bg-orange-100 text-orange-600', border: 'hover:border-orange-200' },
              { icon: Shield, title: 'Google Sheets', desc: 'ייצוא אוטומטי לגיליון. סיכום יומי, שבועי וחודשי תמיד מעודכן.', color: 'bg-emerald-100 text-emerald-600', border: 'hover:border-emerald-200' },
              { icon: Users, title: 'ריבוי חנויות', desc: 'נהל מספר חנויות Shopify עם הגדרות עלויות נפרדות לכל אחת.', color: 'bg-pink-100 text-pink-600', border: 'hover:border-pink-200' },
            ].map(f => (
              <div key={f.title} className={`bg-white rounded-2xl p-6 border border-gray-100 ${f.border} hover-lift transition-all`}>
                <div className={`w-11 h-11 rounded-xl ${f.color} flex items-center justify-center mb-4`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-extrabold text-gray-900 mb-4">הגדרה תוך 5 דקות</h2>
            <p className="text-gray-500 text-lg">שלושה שלבים פשוטים ואתה רץ</p>
          </div>
          <div className="relative">
            <div className="absolute top-8 right-[calc(33%+1rem)] left-[calc(33%+1rem)] h-0.5 bg-gradient-to-l from-blue-200 to-purple-200 hidden md:block" />
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { step: '01', icon: ShoppingBag, title: 'חבר Shopify', desc: 'הכנס Access Token. Webhook מוגדר אוטומטית — כל הזמנה נכנסת בזמן אמת.' },
                { step: '02', icon: Zap, title: 'הגדר עלויות', desc: 'הכנס עלות מוצר, הנחות, עמלות תשלום ושער חליפין. לוקח 2 דקות.' },
                { step: '03', icon: TrendingUp, title: 'ראה רווח אמיתי', desc: 'Claude AI מנתח כל הזמנה ומחשב רווח נקי מדויק — אוטומטית.' },
              ].map((s, i) => (
                <div key={s.step} className="text-center relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-extrabold text-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
                    {s.step}
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg mb-2">{s.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-6 py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-extrabold text-gray-900 mb-4">מה אומרים בעלי חנויות</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'יעל כ.', store: 'חנות קפסולות', text: 'גיליתי שהייתי מפסיד על 20% מההזמנות שלי בגלל הנחות כמות. רווחיות הראתה לי את זה ביום הראשון.', color: '#3b82f6' },
              { name: 'דוד ל.', store: 'חנות בריאות', text: 'Triple Whale אמר לי ROAS 6x. רווחיות הראה לי שהרווח האמיתי היה 2.8x. המערכת הזאת הצילה לי את העסק.', color: '#8b5cf6' },
              { name: 'מיכל א.', store: 'מוצרי יופי', text: 'ה-AI מבין את הכללים שלי בדיוק — הנחות, קפסולות מתנה, קופונים. אין יותר חישובים ידניים.', color: '#10b981' },
            ].map(t => (
              <div key={t.name} className="bg-white rounded-2xl p-6 border border-gray-100 hover-lift">
                <div className="flex mb-4">
                  {[...Array(5)].map((_,i) => <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />)}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-6">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md" style={{ background: t.color }}>
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{t.name}</p>
                    <p className="text-gray-400 text-xs">{t.store}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-20">
        <div className="max-w-md mx-auto text-center">
          <h2 className="text-4xl font-extrabold text-gray-900 mb-3">תוכנית אחת. פשוטה.</h2>
          <p className="text-gray-500 text-lg mb-12">14 יום ניסיון חינם — ללא כרטיס אשראי</p>

          <div className="relative bg-white rounded-3xl p-8 shadow-2xl border-2 border-blue-600 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-purple-600" />
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm px-6 py-1.5 rounded-full font-bold shadow-lg">14 יום ניסיון חינם</span>
            </div>

            <div className="pt-4 mb-8">
              <div className="flex items-end justify-center gap-1">
                <span className="text-6xl font-extrabold text-gray-900">₪149</span>
                <span className="text-gray-400 mb-3 text-xl">/ חודש</span>
              </div>
              <p className="text-gray-400 text-sm">לאחר תקופת הניסיון</p>
            </div>

            <ul className="space-y-3.5 mb-8 text-right">
              {[
                'הזמנות ללא הגבלה',
                'AI ניתוח רווח לכל הזמנה',
                'חיבור Shopify + Webhook בזמן אמת',
                'סנכרון Facebook Ads',
                'ייצוא Google Sheets אוטומטי',
                'עד 3 חנויות',
                'תמיכה מלאה בעברית',
                'ביטול בכל עת',
              ].map(item => (
                <li key={item} className="flex items-center gap-3 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-3 h-3 text-blue-600" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>

            <Link href="/signup" className="block w-full py-4 rounded-2xl font-bold text-lg text-white text-center transition-all hover:-translate-y-0.5 shadow-xl shadow-blue-200 hover:shadow-blue-300"
              style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}>
              התחל 14 יום חינם
            </Link>
            <p className="text-gray-400 text-xs mt-3">ללא כרטיס אשראי • ביטול בכל עת</p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-24 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1e3a8a, #312e81)' }}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(99,102,241,0.3),transparent)]" />
        <div className="max-w-3xl mx-auto text-center relative">
          <h2 className="text-5xl font-extrabold text-white mb-4 leading-tight">
            מוכן לדעת את הרווח האמיתי שלך?
          </h2>
          <p className="text-blue-200 text-xl mb-10">
            הצטרף לבעלי חנויות שכבר יודעים בדיוק כמה הם מרוויחים
          </p>
          <Link href="/signup" className="inline-flex items-center gap-3 bg-white hover:bg-gray-50 text-blue-700 px-10 py-5 rounded-2xl text-xl font-extrabold transition-all hover:-translate-y-1 shadow-2xl">
            התחל חינם עכשיו
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <p className="text-blue-300 text-sm mt-4">ללא כרטיס אשראי • הגדרה תוך 5 דקות • ביטול בכל עת</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-8 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-extrabold text-gray-900">רווחיות</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/signin" className="hover:text-gray-600 transition-colors">התחברות</Link>
            <Link href="/signup" className="hover:text-gray-600 transition-colors">הרשמה</Link>
            <a href="#pricing" className="hover:text-gray-600 transition-colors">מחירים</a>
          </div>
          <p className="text-gray-400 text-sm">© 2025 רווחיות. כל הזכויות שמורות.</p>
        </div>
      </footer>
    </div>
  )
}
