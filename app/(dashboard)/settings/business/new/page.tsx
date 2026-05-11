'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function NewBusinessPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('נדרש שם לעסק')
      return
    }
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'שגיאה ביצירת עסק')
        return
      }

      localStorage.setItem('activeBusiness', data.id)
      window.dispatchEvent(new CustomEvent('businessChange', { detail: data.id }))
      router.push('/settings')
    } catch {
      setError('שגיאת שרת')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
          <TrendingUp className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white">צור עסק חדש</h1>
        <p className="text-gray-400 mt-2">כל עסק הוא חנות Shopify נפרדת עם הגדרות והזמנות משלו</p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">שם העסק *</Label>
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="חנות הקפסולות שלי"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc">תיאור (אופציונלי)</Label>
            <Input
              id="desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="חנות Shopify ראשית"
            />
          </div>

          <Button type="submit" className="w-full" loading={loading} size="lg">
            צור עסק והמשך להגדרות
          </Button>
        </form>
      </div>
    </div>
  )
}
