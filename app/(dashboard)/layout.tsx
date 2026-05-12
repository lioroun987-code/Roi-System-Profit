'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [businesses, setBusinesses] = useState<Array<{ id: string; name: string }>>([])
  const [activeBusiness, setActiveBusiness] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/signin')
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetch('/api/businesses')
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setBusinesses(data)
            const stored = localStorage.getItem('activeBusiness')
            const valid = stored && data.find((b: any) => b.id === stored)
            setActiveBusiness(valid ? stored : data[0].id)
          }
        })
    }
  }, [session])

  function handleBusinessChange(id: string) {
    setActiveBusiness(id)
    localStorage.setItem('activeBusiness', id)
    window.dispatchEvent(new CustomEvent('businessChange', { detail: id }))
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D0F14' }}>
        <div className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full" style={{ borderColor: '#4F6EF7', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0D0F14' }}>
      <Sidebar businesses={businesses} activeBusiness={activeBusiness} onBusinessChange={handleBusinessChange} />
      <main className="flex-1 overflow-y-auto" style={{ background: '#0D0F14' }}>
        {children}
      </main>
    </div>
  )
}
