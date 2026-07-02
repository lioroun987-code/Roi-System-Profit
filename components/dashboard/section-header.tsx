export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-bold text-white">{title}</h2>
      {action && (
        <button
          onClick={onAction}
          className="text-xs font-medium transition-colors hover:opacity-80 text-[var(--color-brand-start)]"
        >
          {action}
        </button>
      )}
    </div>
  )
}
