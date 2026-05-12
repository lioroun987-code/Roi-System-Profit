'use client'

import Link from 'next/link'
import { TrendingUp, CheckCircle, ArrowLeft, Star, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'

const LIVE_EVENTS = [
  { name: 'יעל כ.', action: 'רווח נקי ₪284 על הזמנה #1042', time: '12 שניות' },
  { name: 'דוד ל.', action: 'זיהה הזמנה מפסידה -₪23 על #1038', time: '34 שניות' },
  { name: 'מיכל א.', action: 'סנכרן 47 הזמנות מ-Shopify', time: '1 דקה' },
  { name: 'רון ש.', action: 'ROAS אמיתי 4.2x לעומת 6.8x לכאורה', time: '2 דקות' },
  { name: 'שרה מ.', action: 'רווח חודשי ₪18,400 נקי', time: '3 דקות' },
  { name: 'אורי ב.', action: 'ייצא 230 הזמנות ל-Google Sheets', time: '5 דקות' },
]

function LiveFeed() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setIndex(i => (i + 1) % LIVE_EVENTS.length), 3000)
    return () => clearInterval(timer)
  }, [])

  const event = LIVE_EVENTS[index]
  return (
    <div className="inline-flex items-center gap-3 bg-white border border-gray-200 rounded-full px-4 py-2 shadow-sm text-sm">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
      <span className="font-medium text-gray-900">{event.name}</span>
      <span className="text-gray-500">{event.action}</span>
      <span className="text-gray-400 text-xs">{event.time}</span>
    </div>
  )
}

function DashboardMockup() {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 to-purple-500/10 rounded-3xl blur-3xl -z-10 scale-110" />
      <div className="bg-gray-950 rounded-2xl shadow-2xl border border-gray-800 overflow-hidden">
        {/* Window bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <div className="flex-1 mx-3 bg-gray-800 rounded h-5 text-center flex items-center justify-center">
            <span className="text-gray-500 text-xs">ravachut.vercel.app/dashboard</span>
          </div>
        </div>

        <div className="p-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: 'רווח נקי היום', value: '₪1,840', change: '+12%', green: true },
              { label: 'הכנסות', value: '₪6,200', change: '+8%', green: true },
              { label: 'ROAS אמיתי', value: '4.1x', change: '', green: false },
            ].map(s => (
              <div key={s.label} className="bg-gray-900 rounded-xl p-3 border border-gray-800">
                <p className="text-gray-500 text-xs mb-1">{s.label}</p>
                <p className="text-white font-bold text-base">{s.value}</p>
                {s.change && <p className="text-emerald-400 text-xs mt-0.5">{s.change}</p>}
              </div>
            ))}
          </div>

          {/* Orders */}
          <div className="space-y-1.5">
            {[
              { num: '#1042', text: 'דיל + 3 קפסולות (10% הנחה)', rev: '₪251', profit: '+₪202', pos: true },
              { num: '#1041', text: '2× Cool Deal + הפתעה', rev: '₪473', profit: '+₪384', pos: true },
              { num: '#1040', text: 'בקבוק + קופון 50₪', rev: '₪128', profit: '-₪12', pos: false },
              { num: '#1039', text: '3× דיל (15% הנחה) + משלוח', rev: '₪636', profit: '+₪518', pos: true },
            ].map(o => (
              <div key={o.num} className={`flex items-center justify-between px-3 py-2 rounded-lg ${o.pos ? 'bg-gray-900' : 'bg-red-950/40 border border-red-900/30'}`}>
                <span className="text-gray-500 text-xs font-mono w-12">{o.num}</span>
                <span className="text-gray-300 text-xs flex-1 px-2 truncate">{o.text}</span>
                <span className="text-gray-500 text-xs w-12 text-left">{o.rev}</span>
                <span className={`text-xs font-bold w-14 text-left ${o.pos ? 'text-emerald-400' : 'text-red-400'}`}>{o.profit}</span>
              </div>
            ))}
          </div>

          {/* Mini chart */}
          <div className="mt-3 flex items-end gap-1 h-12 px-1">
            {[40, 65, 45, 80, 55, 90, 70, 95, 60, 85, 75, 100].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t"
                style={{
                  height: `${h}%`,
                  backgroundColor: h > 80 ? '#34d399' : h > 60 ? '#60a5fa' : '#6b7280',
                  opacity: 0.7 + (i / 20),
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">רווחיות</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/signin" className="text-gray-500 hover:text-gray-900 text-sm font-medium transition-colors">
              התחברות
            </Link>
            <Link href="/signup" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-all shadow-lg shadow-blue-100 hover:shadow-blue-200">
              התחל חינם
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-16 pb-20 relative">
        <div className="absolute top-0 left-0 right-0 h-[600px] bg-gradient-to-br from-blue-50 via-white to-purple-50/30 -z-10" />

        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left — text */}
            <div>
              {/* Rating */}
              <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm shadow-sm mb-8">
                <div className="flex">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />)}
                </div>
                <span className="text-gray-700 font-medium">4.9 — מבעלי חנויות</span>
              </div>

              <h1 className="text-5xl font-extrabold leading-tight text-gray-900 mb-6">
                לא יודע כמה אתה באמת מרוויח?{' '}
                <span className="text-blue-600">קבל את התשובה האמיתית.</span>
              </h1>

              <p className="text-xl text-gray-500 leading-relaxed mb-8">
                המערכת היחידה שמחשבת <strong className="text-gray-900">רווח נקי אמיתי</strong> לכל הזמנה — אחרי עלות מוצר, הנחות, עמלות תשלום ומע"מ. לא ROAS. לא הכנסות. <strong className="text-gray-900">כמה נשאר בכיס.</strong>
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <Link href="/signup" className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl text-lg font-bold transition-all shadow-xl shadow-blue-200 hover:-translate-y-0.5">
                  התחל 14 יום חינם
                  <ArrowLeft className="w-5 h-5" />
                </Link>
              </div>
              <p className="text-gray-400 text-sm mb-8">ללא כרטיס אשראי • ביטול בכל עת • הגדרה תוך 5 דקות</p>

              {/* Live feed */}
              <LiveFeed />
            </div>

            {/* Right — dashboard */}
            <div className="relative">
              <DashboardMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Trusted by + integrations */}
      <section className="px-6 py-12 border-y border-gray-100">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-gray-400 text-sm font-medium mb-6">מתחבר לכלים שכבר משתמש בהם</p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {[
              { name: 'Shopify', emoji: '🛍️' },
              { name: 'Facebook Ads', emoji: '📣' },
              { name: 'Google Sheets', emoji: '📊' },
              { name: 'Claude AI', emoji: '🤖' },
            ].map(item => (
              <div key={item.name} className="flex items-center gap-2 px-5 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-lg">{item.emoji}</span>
                <span className="font-semibold text-gray-700 text-sm">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 py-16">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            { num: '100%', label: 'דיוק בחישוב הרווח', sub: 'לא הערכות — מספרים אמיתיים' },
            { num: '5 דק\'', label: 'הגדרה ראשונית', sub: 'חיבור Shopify + הגדרת עלויות' },
            { num: '3x', label: 'יותר מדויק מ-Triple Whale', sub: 'כי אנחנו מחשבים רווח, לא ROAS' },
          ].map(s => (
            <div key={s.num} className="p-6">
              <p className="text-4xl font-extrabold text-blue-600 mb-2">{s.num}</p>
              <p className="font-bold text-gray-900 mb-1">{s.label}</p>
              <p className="text-gray-500 text-sm">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pain vs Solution */}
      <section className="px-6 py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-3">
            Triple Whale נותן לך ROAS יפה.{' '}
            <span className="text-blue-600">אנחנו נותנים לך את האמת.</span>
          </h2>
          <p className="text-gray-500 text-center mb-12">60% מבעלי החנויות לא יודעים את הרווח האמיתי שלהם</p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-8 border border-gray-200">
              <h3 className="font-bold text-gray-400 mb-6 flex items-center gap-2">
                <span className="text-lg">❌</span> Triple Whale / Shopify Analytics
              </h3>
              <ul className="space-y-3">
                {[
                  'מראה ROAS — לא רווח נקי',
                  'לא מוריד עלות מוצר אמיתית',
                  'לא מבין הנחות כמות ומדור',
                  'לא מחשב עמלת Bit / PayPal / אשראי',
                  'לא מזהה קפסולות מתנה שעולות כסף',
                  'לא מחשב VAT ועלויות משלוח',
                ].map(item => (
                  <li key={item} className="flex items-center gap-3 text-gray-500 text-sm">
                    <span className="w-5 h-5 rounded-full bg-red-100 text-red-500 flex items-center justify-center shrink-0 text-xs">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-blue-600 rounded-2xl p-8 text-white shadow-xl shadow-blue-200">
              <h3 className="font-bold mb-6 flex items-center gap-2">
                <Zap className="w-5 h-5" /> רווחיות — הרווח האמיתי שלך
              </h3>
              <ul className="space-y-3">
                {[
                  'רווח נקי לכל הזמנה — בשניות',
                  'AI מבין עלות מוצר מדויקת',
                  'מחשב כל סוגי ההנחות אוטומטית',
                  'מוריד עמלה לפי אמצעי תשלום',
                  'מזהה קפסולות מתנה והפתעה',
                  'מחשב VAT ומשלוח בדיוק',
                ].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm text-blue-50">
                    <CheckCircle className="w-5 h-5 text-white shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">איך זה עובד</h2>
          <p className="text-gray-500 mb-14">שלושה שלבים פשוטים</p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'חבר את Shopify', desc: 'חיבור פשוט עם Access Token. כל הזמנה נכנסת אוטומטית דרך Webhook.' },
              { step: '02', title: 'הגדר עלויות ב-2 דקות', desc: 'הכנס עלות מוצר, אחוזי הנחה, עמלות תשלום ושער חליפין.' },
              { step: '03', title: 'ראה רווח נקי בזמן אמת', desc: 'Claude AI מנתח כל הזמנה ומחשב רווח נקי מדויק אוטומטית.' },
            ].map(s => (
              <div key={s.step} className="relative">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-bold text-lg flex items-center justify-center mx-auto mb-4">
                  {s.step}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-6 py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">מה אומרים בעלי חנויות</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'יעל כ.', store: 'חנות קפסולות', text: 'גיליתי שהייתי מפסיד על 20% מההזמנות שלי בגלל הנחות כמות. רווחיות הראתה לי את זה ביום הראשון.' },
              { name: 'דוד ל.', store: 'חנות בריאות', text: 'Triple Whale אמר לי ROAS 6x. רווחיות הראה לי שהרווח האמיתי היה 2.8x. הצלת לי את העסק.' },
              { name: 'מיכל א.', store: 'מוצרי יופי', text: 'ה-AI מבין את הכללים שלי בדיוק — הנחות, קפסולות מתנה, קופונים. אין עוד חישובים ידניים.' },
            ].map(t => (
              <div key={t.name} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex mb-3">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />)}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                    <p className="text-gray-400 text-xs">{t.store}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-20" id="pricing">
        <div className="max-w-md mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">תוכנית אחת. פשוטה.</h2>
          <p className="text-gray-500 mb-12">14 יום ניסיון חינם — ללא כרטיס אשראי</p>

          <div className="relative bg-white border-2 border-blue-600 rounded-2xl p-8 shadow-2xl shadow-blue-100">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <span className="bg-blue-600 text-white text-sm px-5 py-1.5 rounded-full font-semibold">14 יום ניסיון חינם</span>
            </div>

            <div className="mb-8 pt-2">
              <div className="flex items-end justify-center gap-1">
                <span className="text-5xl font-extrabold text-gray-900">₪149</span>
                <span className="text-gray-400 mb-2 text-lg">/ חודש</span>
              </div>
              <p className="text-gray-400 text-sm mt-1">לאחר תקופת הניסיון</p>
            </div>

            <ul className="space-y-3 mb-8 text-right">
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
                <li key={item} className="flex items-center gap-3 text-gray-700 text-sm">
                  <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            <Link href="/signup" className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg transition-all text-center shadow-lg shadow-blue-200 hover:-translate-y-0.5">
              התחל 14 יום חינם
            </Link>
            <p className="text-gray-400 text-xs mt-3">ללא כרטיס אשראי • ביטול בכל עת</p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20 bg-blue-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-extrabold text-white mb-4">
            מוכן לדעת את הרווח האמיתי שלך?
          </h2>
          <p className="text-blue-100 text-xl mb-8">
            הצטרף לבעלי חנויות שכבר יודעים בדיוק כמה הם מרוויחים
          </p>
          <Link href="/signup" className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-blue-600 px-10 py-4 rounded-xl text-lg font-bold transition-all hover:-translate-y-0.5 shadow-xl">
            התחל חינם עכשיו
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <p className="text-blue-200 text-sm mt-4">ללא כרטיס אשראי • הגדרה תוך 5 דקות</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-gray-900">רווחיות</span>
          </div>
          <p className="text-gray-400 text-sm">© 2025 רווחיות. כל הזכויות שמורות.</p>
        </div>
      </footer>
    </div>
  )
}
