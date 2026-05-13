'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  LayoutDashboard, ShoppingCart, TrendingUp, Plug, Settings,
  LogOut, ChevronDown, Store, BarChart3, Bell, Search, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const navItems = [
  { href: '/dashboard',    label: 'סקירה',         icon: LayoutDashboard },
  { href: '/orders',       label: 'הזמנות',         icon: ShoppingCart },
  { href: '/analytics',    label: 'אנליטיקס',       icon: BarChart3 },
  { href: '/reconcile',    label: 'בדיקת פערים',    icon: Search },
  { href: '/integrations', label: 'אינטגרציות',     icon: Plug },
  { href: '/settings',     label: 'הגדרות',          icon: Settings },
]

interface SidebarProps {
  businesses: Array<{ id: string; name: string }>
  activeBusiness: string | null
  onBusinessChange: (id: string) => void
}

export function Sidebar({ businesses, activeBusiness, onBusinessChange }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [businessOpen, setBusinessOpen] = useState(false)
  const currentBusiness = businesses.find(b => b.id === activeBusiness)

  return (
    <aside className="w-60 shrink-0 flex flex-col h-full border-l" style={{ background: '#0C0E14', borderColor: '#1E2130' }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: '#1E2130' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #4F6EF7, #7C5CFC)' }}>
          <TrendingUp className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-bold text-base tracking-tight">רווחיות</span>
        <Bell className="w-4 h-4 mr-auto cursor-pointer" style={{ color: '#4A5174' }} />
      </div>

      {/* Business selector */}
      {businesses.length > 0 && (
        <div className="px-3 py-3 border-b" style={{ borderColor: '#1E2130' }}>
          <button
            onClick={() => setBusinessOpen(!businessOpen)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors text-right"
            style={{ background: businessOpen ? '#1E2130' : 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1A1D2E')}
            onMouseLeave={e => (e.currentTarget.style.background = businessOpen ? '#1E2130' : 'transparent')}
          >
            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: '#2A3050' }}>
              <Store className="w-3.5 h-3.5" style={{ color: '#4F6EF7' }} />
            </div>
            <span className="text-sm font-medium truncate flex-1" style={{ color: '#CBD5E1' }}>
              {currentBusiness?.name ?? 'בחר עסק'}
            </span>
            <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 transition-transform', businessOpen && 'rotate-180')} style={{ color: '#4A5174' }} />
          </button>

          {businessOpen && (
            <div className="mt-1.5 rounded-lg overflow-hidden border" style={{ borderColor: '#1E2130', background: '#0F1119' }}>
              {businesses.map(b => (
                <button
                  key={b.id}
                  onClick={() => { onBusinessChange(b.id); setBusinessOpen(false) }}
                  className="w-full text-right px-4 py-2.5 text-sm transition-colors"
                  style={{ color: b.id === activeBusiness ? '#4F6EF7' : '#8B8FA8', background: b.id === activeBusiness ? '#1A2040' : 'transparent' }}
                >
                  {b.name}
                </button>
              ))}
              <Link
                href="/settings/business/new"
                onClick={() => setBusinessOpen(false)}
                className="block w-full text-right px-4 py-2.5 text-sm border-t"
                style={{ color: '#4F6EF7', borderColor: '#1E2130' }}
              >
                + הוסף עסק
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navItems.map(item => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                color: isActive ? '#FFFFFF' : '#6B7280',
                background: isActive ? '#1E2846' : 'transparent',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#13161F' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <Icon className="w-4 h-4 shrink-0" style={{ color: isActive ? '#4F6EF7' : '#4A5174' }} />
              {item.label}
              {isActive && <div className="mr-auto w-1.5 h-1.5 rounded-full" style={{ background: '#4F6EF7' }} />}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t" style={{ borderColor: '#1E2130' }}>
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg, #4F6EF7, #7C5CFC)' }}>
            {session?.user?.name?.[0] ?? session?.user?.email?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-medium truncate">{session?.user?.name ?? 'משתמש'}</p>
            <p className="text-xs truncate" style={{ color: '#4A5174' }}>{session?.user?.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/signin' })}
            className="transition-colors p-1 rounded"
            style={{ color: '#4A5174' }}
            title="יציאה"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
