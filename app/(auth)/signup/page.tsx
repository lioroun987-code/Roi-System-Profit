'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SignUpPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError('הסיסמה חייבת להכיל לפחות 8 תווים')
      return
    }
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'שגיאה בהרשמה')
        setLoading(false)
        return
      }

      await signIn('credentials', { email, password, redirect: false })
      router.push('/settings/business/new')
    } catch {
      setError('שגיאת שרת')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-white text-2xl font-bold">מנהל רווחיות</h1>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <h2 className="text-white text-xl font-semibold mb-6 text-center">הרשמה</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="name">שם מלא</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="ישראל ישראלי" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">אימייל</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required dir="ltr" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">סיסמה</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="לפחות 8 תווים" required dir="ltr" />
            </div>

            <Button type="submit" className="w-full" loading={loading}>
              צור חשבון
            </Button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            יש לך חשבון?{' '}
            <Link href="/signin" className="text-blue-400 hover:text-blue-300">
              התחבר
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
