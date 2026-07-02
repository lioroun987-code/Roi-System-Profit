import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'tint-brand text-[var(--color-brand-start)]',
        success: 'tint-success text-[var(--color-success)]',
        destructive: 'tint-danger text-[var(--color-danger)]',
        warning: 'tint-warning text-[var(--color-warning)]',
        secondary: 'bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
