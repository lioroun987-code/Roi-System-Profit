import Link from 'next/link'
import { TrendingUp, CheckCircle, ArrowLeft, BarChart2, ShoppingBag, Zap, Star, Users, Shield } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">רווחיות</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/signin" className="text-gray-500 hover:text-gray-900 text-sm font-medium transition-colors">
              התחברות
            </Link>
            <Link href="/signup" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
              התחל חינם
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-20 pb-16 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 to-white pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto relative">
          {/* Reviews badge */}
          <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm font-medium text-gray-700 shadow-sm mb-8">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <span>מדורג 4.9/5 על ידי בעלי חנויות</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold leading-tight text-gray-900 mb-6">
            סוף סוף תדע בדיוק{' '}
            <span className="text-blue-600">כמה אתה מרוויח</span>{' '}
            על כל הזמנה
          </h1>

          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Triple Whale נותן לך ROAS. אנחנו נותנים לך <strong className="text-gray-900">רווח נקי אמיתי</strong> — אחרי עלות מוצר, עמלות תשלום, הנחות, מע"מ ומשלוח.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <Link href="/signup" className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-200 hover:-translate-y-0.5">
              התחל 14 יום חינם
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Link href="/signin" className="inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-8 py-4 rounded-xl text-lg font-semibold transition-colors">
              כניסה למערכת
            </Link>
          </div>
          <p className="text-gray-400 text-sm">ללא כרטיס אשראי • ביטול בכל עת</p>
        </div>
      </section>

      {/* Integrations bar */}
      <section className="px-6 py-10 border-y border-gray-100 bg-gray-50/50">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gray-400 text-sm font-medium mb-6">מתחבר לכלים שכבר משתמש בהם</p>
          <div className="flex flex-wrap items-center justify-center gap-8">
            {[
              { name: 'Shopify', color: 'text-green-600', bg: 'bg-green-50' },
              { name: 'Facebook Ads', color: 'text-blue-600', bg: 'bg-blue-50' },
              { name: 'Google Sheets', color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { name: 'Claude AI', color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map(item => (
              <div key={item.name} className={`flex items-center gap-2 px-4 py-2 rounded-lg ${item.bg}`}>
                <span className={`font-semibold text-sm ${item.color}`}>{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard mockup */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              רווח נקי לכל הזמנה — בלחיצה אחת
            </h2>
            <p className="text-gray-500 text-lg">ה-AI מנתח כל הזמנה ומחשב את הרווח האמיתי שלך אוטומטית</p>
          </div>

          {/* Dashboard mockup card */}
          <div className="bg-gray-950 rounded-2xl p-6 shadow-2xl border border-gray-800 overflow-hidden">
            {/* Top bar */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="flex-1 bg-gray-800 rounded-md h-6" />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: 'הכנסות היום', value: '₪2,840', color: 'text-white' },
                { label: 'רווח נקי', value: '₪1,120', color: 'text-emerald-400' },
                { label: 'הזמנות', value: '14', color: 'text-white' },
                { label: 'ROAS', value: '4.2x', color: 'text-blue-400' },
              ].map(stat => (
                <div key={stat.label} className="bg-gray-900 rounded-xl p-3 border border-gray-800">
                  <p className="text-gray-500 text-xs mb-1">{stat.label}</p>
                  <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Orders */}
            <div className="space-y-2">
              {[
                { num: '#1042', summary: 'דיל + חבילת 3 קפסולות (10% הנחה)', price: '₪251', profit: '+₪202', pos: true },
                { num: '#1041', summary: '2× Cool Deal + קפסולות הפתעה', price: '₪473', profit: '+₪384', pos: true },
                { num: '#1040', summary: 'בקבוק בלבד + קופון 50₪', price: '₪128', profit: '-₪12', pos: false },
              ].map(order => (
                <div key={order.num} className={`flex items-center justify-between px-4 py-3 rounded-lg border ${order.pos ? 'bg-gray-900 border-gray-800' : 'bg-red-950/30 border-red-900/30'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 text-xs font-mono">{order.num}</span>
                    <span className="text-gray-300 text-sm">{order.summary}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-400 text-sm">{order.price}</span>
                    <span className={`text-sm font-bold ${order.pos ? 'text-emerald-400' : 'text-red-400'}`}>{order.profit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pain vs Solution */}
      <section className="px-6 py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Triple Whale נותן לך מספרים יפים. אנחנו נותנים לך את האמת.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-8 border border-gray-200">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs">✕</div>
                <h3 className="font-semibold text-gray-500">Triple Whale / Shopify Analytics</h3>
              </div>
              <ul className="space-y-4">
                {[
                  'מראה הכנסות — לא רווח',
                  'לא מוריד עלות מוצר',
                  'לא מבין הנחות כמות',
                  'לא מחשב עמלות Bit / PayPal',
                  'לא מזהה מוצרי מתנה',
                  'ROAS יפה, ריק מתוכן',
                ].map(item => (
                  <li key={item} className="flex items-center gap-3 text-gray-500 text-sm">
                    <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                      <span className="text-red-500 text-xs">✕</span>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-blue-600 rounded-2xl p-8 text-white">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">✓</div>
                <h3 className="font-semibold">רווחיות</h3>
              </div>
              <ul className="space-y-4">
                {[
                  'רווח נקי אמיתי לכל הזמנה',
                  'מוריד עלות מוצר מדויקת',
                  'מבין כל סוגי ההנחות',
                  'מחשב עמלה לפי אמצעי תשלום',
                  'מזהה קפסולות מתנה והפתעה',
                  'AI שמבין את הכללים העסקיים שלך',
                ].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm text-white/90">
                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <CheckCircle className="w-3 h-3 text-white" />
                    </div>
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
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">כל מה שצריך במקום אחד</h2>
            <p className="text-gray-500">מחובר לכל הכלים שכבר משתמש בהם</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: ShoppingBag, title: 'Shopify Webhook', desc: 'כל הזמנה נכנסת אוטומטית ומנותחת תוך שניות בזמן אמת.', color: 'bg-green-100 text-green-600' },
              { icon: Zap, title: 'AI Order Analysis', desc: 'Claude AI מחשב רווח נקי מדויק לפי הכללים העסקיים האישיים שלך.', color: 'bg-purple-100 text-purple-600' },
              { icon: BarChart2, title: 'דשבורד רווחיות', desc: 'רווח יומי, שבועי וחודשי. הזמנות מפסידות מסומנות אוטומטית באדום.', color: 'bg-blue-100 text-blue-600' },
              { icon: TrendingUp, title: 'Facebook Ads', desc: 'מושך הוצאות פרסום יומיות ומחשב ROAS על בסיס רווח אמיתי.', color: 'bg-orange-100 text-orange-600' },
              { icon: Shield, title: 'Google Sheets', desc: 'ייצוא אוטומטי של כל ההזמנות לגיליון עם סיכום יומי ומשולי.', color: 'bg-emerald-100 text-emerald-600' },
              { icon: Users, title: 'ריבוי חנויות', desc: 'נהל מספר חנויות Shopify עם הגדרות נפרדות לכל אחת.', color: 'bg-pink-100 text-pink-600' },
            ].map(f => (
              <div key={f.title} className="bg-white border border-gray-100 rounded-2xl p-6 hover:border-gray-200 hover:shadow-lg transition-all">
                <div className={`w-10 h-10 rounded-xl ${f.color} flex items-center justify-center mb-4`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-6 py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-14">מה אומרים בעלי חנויות</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'יעל כ.', store: 'חנות קפסולות', text: 'סוף סוף אני יודעת כמה אני באמת מרוויחה על כל הזמנה. Triple Whale לא נתן לי את זה.', stars: 5 },
              { name: 'דוד ל.', store: 'חנות אייקום', text: 'הנחות הכמות והקופונים תמיד בלבלו אותי. עכשיו ה-AI מחשב הכל אוטומטית ובדיוק.', stars: 5 },
              { name: 'מיכל א.', store: 'מוצרי בריאות', text: 'גיליתי שחלק מההזמנות שחשבתי שמרוויחות בכלל לא. חסכתי המון כסף.', stars: 5 },
            ].map(t => (
              <div key={t.name} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex mb-3">
                  {[...Array(t.stars)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-4">"{t.text}"</p>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                  <p className="text-gray-400 text-xs">{t.store}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-20" id="pricing">
        <div className="max-w-lg mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">תוכנית אחת. פשוטה.</h2>
          <p className="text-gray-500 mb-12">14 יום ניסיון חינם — ללא כרטיס אשראי</p>

          <div className="bg-white border-2 border-blue-600 rounded-2xl p-8 shadow-xl shadow-blue-100 relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="bg-blue-600 text-white text-sm px-5 py-1.5 rounded-full font-medium">14 יום חינם</span>
            </div>

            <div className="mb-8">
              <div className="flex items-end justify-center gap-1 mb-1">
                <span className="text-5xl font-bold text-gray-900">₪149</span>
                <span className="text-gray-400 mb-2">/ חודש</span>
              </div>
              <p className="text-gray-400 text-sm">לאחר תקופת הניסיון</p>
            </div>

            <ul className="space-y-3 mb-8 text-right">
              {[
                'הזמנות ללא הגבלה',
                'AI ניתוח רווח לכל הזמנה',
                'חיבור Shopify + Webhook',
                'סנכרון Facebook Ads',
                'ייצוא Google Sheets',
                'עד 3 חנויות',
                'תמיכה מלאה בעברית',
                'ביטול בכל עת',
              ].map(item => (
                <li key={item} className="flex items-center gap-3 text-gray-700">
                  <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            <Link href="/signup" className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-semibold text-lg transition-all text-center shadow-lg shadow-blue-200 hover:-translate-y-0.5">
              התחל 14 יום חינם
            </Link>
            <p className="text-gray-400 text-xs mt-3">ללא כרטיס אשראי • ביטול בכל עת</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 bg-blue-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">מוכן לדעת את הרווח האמיתי שלך?</h2>
          <p className="text-blue-100 text-lg mb-8">הצטרף לבעלי חנויות שכבר מנהלים את הרווחיות שלהם בצורה חכמה</p>
          <Link href="/signup" className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-blue-600 px-10 py-4 rounded-xl text-lg font-bold transition-all hover:-translate-y-0.5 shadow-xl">
            התחל חינם עכשיו
            <ArrowLeft className="w-5 h-5" />
          </Link>
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
