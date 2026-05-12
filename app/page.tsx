import Link from 'next/link'
import { TrendingUp, CheckCircle, XCircle, ArrowLeft, BarChart2, ShoppingBag, Zap, Shield, Star } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Navbar */}
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-lg">רווחיות</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/signin" className="text-gray-400 hover:text-white text-sm transition-colors">
              התחברות
            </Link>
            <Link
              href="/signup"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              התחל חינם
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-20 pb-24 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-blue-400 text-sm mb-8">
            <Zap className="w-3.5 h-3.5" />
            מופעל על ידי Claude AI
          </div>

          <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
            סוף סוף תדע{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-l from-blue-400 to-cyan-400">
              כמה אתה באמת מרוויח
            </span>
            {' '}על כל הזמנה
          </h1>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            מערכת הניתוח הראשונה שמחשבת רווח <strong className="text-white">אמיתי</strong> לכל הזמנה — כולל עלות מוצר, עמלות תשלום, מע"מ, הנחות ועלויות משלוח. לא ROAS. לא הכנסות. רווח נקי.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl text-lg font-medium transition-all hover:scale-105"
            >
              התחל 14 יום חינם
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Link
              href="/signin"
              className="inline-flex items-center gap-2 border border-white/20 hover:bg-white/5 text-white px-8 py-4 rounded-xl text-lg font-medium transition-colors"
            >
              כניסה למערכת
            </Link>
          </div>

          <p className="text-gray-500 text-sm mt-4">ללא כרטיס אשראי • ביטול בכל עת</p>
        </div>
      </section>

      {/* Pain Points */}
      <section className="px-6 py-20 bg-gradient-to-b from-transparent to-white/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            Triple Whale, Shopify Reports, Google Analytics —
            <span className="text-red-400"> כולן מסתירות ממך את האמת</span>
          </h2>
          <p className="text-gray-400 text-center mb-14 text-lg">
            הן מראות לך הכנסות ו-ROAS. אבל אף אחת לא אומרת לך כמה נשאר בכיס.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8">
              <h3 className="text-red-400 font-semibold text-lg mb-6 flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                מה הכלים האחרים לא עושים
              </h3>
              <ul className="space-y-4">
                {[
                  'לא מחשבים עלות מוצר אמיתית לכל SKU',
                  'לא מורידים עמלות Bit / PayPal / אשראי',
                  'לא מבינים הנחות כמות, קופונים וצרופות',
                  'לא מזהים קפסולות מתנה שעולות לך כסף',
                  'לא מחשבים מע"מ ועלויות משלוח אמיתיות',
                  'נותנים ROAS — לא רווח נקי',
                ].map(item => (
                  <li key={item} className="flex items-start gap-3 text-gray-400">
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-8">
              <h3 className="text-emerald-400 font-semibold text-lg mb-6 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                מה רווחיות עושה
              </h3>
              <ul className="space-y-4">
                {[
                  'AI מנתח כל הזמנה ומחשב רווח נקי אמיתי',
                  'מבין הנחות כמות, מדור, קופונים וצרופות',
                  'מזהה אוטומטית מוצרי מתנה והפתעה',
                  'מחשב עמלת תשלום לפי שיטת התשלום',
                  'מוריד VAT ועלויות משלוח מהרווח',
                  'מראה בדיוק כמה נשאר בכיס מכל הזמנה',
                ].map(item => (
                  <li key={item} className="flex items-start gap-3 text-gray-400">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">כל מה שצריך כדי לנהל את הרווחיות שלך</h2>
          <p className="text-gray-400 text-center mb-14">מחובר לכל הכלים שכבר משתמש בהם</p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: ShoppingBag,
                title: 'חיבור Shopify',
                desc: 'כל הזמנה נכנסת אוטומטית ומנותחת תוך שניות. Webhook בזמן אמת.',
                color: 'text-green-400',
                bg: 'bg-green-500/10',
              },
              {
                icon: TrendingUp,
                title: 'AI Order Analysis',
                desc: 'Claude AI מפרק כל הזמנה ומחשב רווח נקי מדויק לפי הכללים העסקיים שלך.',
                color: 'text-blue-400',
                bg: 'bg-blue-500/10',
              },
              {
                icon: BarChart2,
                title: 'דשבורד רווחיות',
                desc: 'רווח יומי, שבועי וחודשי. גרפים. הזמנות מפסידות מסומנות באדום.',
                color: 'text-purple-400',
                bg: 'bg-purple-500/10',
              },
              {
                icon: Zap,
                title: 'Facebook Ads',
                desc: 'מושך הוצאות פרסום יומיות ומחשב ROAS על רווח — לא על הכנסות.',
                color: 'text-yellow-400',
                bg: 'bg-yellow-500/10',
              },
              {
                icon: Shield,
                title: 'Google Sheets',
                desc: 'ייצוא אוטומטי של כל ההזמנות לגיליון. סיכום יומי, שבועי וחודשי.',
                color: 'text-cyan-400',
                bg: 'bg-cyan-500/10',
              },
              {
                icon: Star,
                title: 'כללים מותאמים אישית',
                desc: 'כותב בשפה חופשית את הכללים העסקיים שלך — ה-AI מבין ומיישם.',
                color: 'text-orange-400',
                bg: 'bg-orange-500/10',
              },
            ].map(feature => (
              <div key={feature.title} className="border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-colors">
                <div className={`w-10 h-10 rounded-xl ${feature.bg} flex items-center justify-center mb-4`}>
                  <feature.icon className={`w-5 h-5 ${feature.color}`} />
                </div>
                <h3 className="text-white font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-20 bg-gradient-to-b from-transparent to-white/5" id="pricing">
        <div className="max-w-lg mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">תוכנית אחת. פשוטה.</h2>
          <p className="text-gray-400 mb-12">14 יום ניסיון חינם — ללא כרטיס אשראי</p>

          <div className="border border-blue-500/40 rounded-2xl p-8 bg-blue-500/5 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-blue-600 text-white text-xs px-4 py-1 rounded-full font-medium">
                14 יום ניסיון חינם
              </span>
            </div>

            <div className="mb-6">
              <div className="flex items-end justify-center gap-1">
                <span className="text-5xl font-bold text-white">₪149</span>
                <span className="text-gray-400 mb-2">/ חודש</span>
              </div>
              <p className="text-gray-500 text-sm mt-1">לאחר תקופת הניסיון</p>
            </div>

            <ul className="space-y-3 mb-8 text-right">
              {[
                'הזמנות ללא הגבלה',
                'AI ניתוח רווח לכל הזמנה',
                'חיבור Shopify + Webhook',
                'סנכרון Facebook Ads',
                'ייצוא Google Sheets',
                'עד 3 חנויות',
                'תמיכה בעברית',
                'ביטול בכל עת',
              ].map(item => (
                <li key={item} className="flex items-center gap-3 text-gray-300">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            <Link
              href="/signup"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105 text-center"
            >
              התחל 14 יום חינם
            </Link>
            <p className="text-gray-500 text-xs mt-3">ללא כרטיס אשראי • ביטול בכל עת</p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold mb-4">
            מוכן לדעת כמה אתה באמת מרוויח?
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            הצטרף לבעלי חנויות שכבר יודעים את הרווח האמיתי שלהם
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-xl text-lg font-semibold transition-all hover:scale-105"
          >
            התחל חינם עכשיו
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8 text-center text-gray-500 text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
            <TrendingUp className="w-3 h-3 text-white" />
          </div>
          <span className="text-white font-medium">רווחיות</span>
        </div>
        <p>© 2025 רווחיות. כל הזכויות שמורות.</p>
      </footer>
    </div>
  )
}
