'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  LayoutDashboard,
  ShoppingCart,
  Settings,
  Plug,
  LogOut,
  ChevronDown,
  Store,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const navItems = [
  { href: '/dashboard', label: 'לוח בקרה', icon: LayoutDashboard },
  { href: '/orders', label: 'הזמנות', icon: ShoppingCart },
  { href: '/analytics', label: 'אנליטיקס', icon: TrendingUp },
  { href: '/integrations', label: 'אינטגרציות', icon: Plug },
  { href: '/settings', label: 'הגדרות', icon: Settings },
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
    <aside className="w-64 shrink-0 flex flex-col h-full bg-gray-950 border-l border-white/10">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-sm">רווחיות</h1>
            <p className="text-gray-500 text-xs">מנהל הכנסות</p>
          </div>
        </div>
      </div>

      <div className="p-4 border-b border-white/10">
        <button
          onClick={() => setBusinessOpen(!businessOpen)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-right"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Store className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="text-white text-sm truncate">
              {currentBusiness?.name ?? 'בחר עסק'}
            </span>
          </div>
          <ChevronDown className={cn('w-4 h-4 text-gray-400 shrink-0 transition-transform', businessOpen && 'rotate-180')} />
        </button>

        {businessOpen && (
          <div className="mt-2 space-y-1">
            {businesses.map(b => (
              <button
                key={b.id}
                onClick={() => { onBusinessChange(b.id); setBusinessOpen(false) }}
                className={cn(
                  'w-full text-right px-3 py-2 rounded-lg text-sm transition-colors',
                  b.id === activeBusiness
                    ? 'bg-blue-600/20 text-blue-300'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                )}
              >
                {b.name}
              </button>
            ))}
            <Link
              href="/settings/business/new"
              onClick={() => setBusinessOpen(false)}
              className="block w-full text-right px-3 py-2 rounded-lg text-sm text-blue-400 hover:bg-blue-600/10 transition-colors"
            >
              + הוסף עסק
            </Link>
          </div>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(item => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                isActive
                  ? 'bg-blue-600/20 text-blue-300 font-medium'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          {session?.user?.image ? (
            <img src={session.user.image} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
              {session?.user?.name?.[0] ?? session?.user?.email?.[0] ?? '?'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm truncate">{session?.user?.name ?? 'משתמש'}</p>
            <p className="text-gray-500 text-xs truncate">{session?.user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/signin' })}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>יציאה</span>
        </button>
      </div>
    </aside>
  )
}
