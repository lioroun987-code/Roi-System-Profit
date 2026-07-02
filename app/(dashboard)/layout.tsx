'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { AiFloatButton } from '@/components/layout/ai-float-button'

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
            const active = (stored && data.find((b: any) => b.id === stored)) ? stored : data[0].id
            setActiveBusiness(active)

            // Redirect to onboarding if active business hasn't completed it
            const activeBiz = data.find((b: any) => b.id === active)
            // Onboarding is complete if the business has product costs configured
            const costsConfigured = activeBiz?.productCosts
              && typeof activeBiz.productCosts === 'object'
              && (
                Object.keys((activeBiz.productCosts as any).customProductCosts ?? {}).length > 0
                || localStorage.getItem(`onboarding_done_${active}`) === '1'
              )
            if (activeBiz && !costsConfigured) {
              const savedStep = parseInt(localStorage.getItem(`onboarding_step_${active}`) ?? '0') || 0
              router.push(`/onboarding?step=${savedStep}`)
            }
          } else if (Array.isArray(data) && data.length === 0) {
            router.push('/onboarding')
          }
        })
    }
  }, [session, router])

  function handleBusinessChange(id: string) {
    setActiveBusiness(id)
    localStorage.setItem('activeBusiness', id)
    window.dispatchEvent(new CustomEvent('businessChange', { detail: id }))
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-app)]">
        <div className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full" style={{ borderColor: 'var(--color-brand-start)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg-app)]">
      <Sidebar businesses={businesses} activeBusiness={activeBusiness} onBusinessChange={handleBusinessChange} />
      <main className="flex-1 overflow-y-auto bg-[var(--color-bg-app)]">
        {children}
      </main>
      <AiFloatButton businessId={activeBusiness} />
    </div>
  )
}
