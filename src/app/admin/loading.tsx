/** Skeleton for the admin segment — the shell stays, only the pane swaps. */
export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-4" role="status" aria-label="Loading">
      <div className="h-7 w-48 rounded bg-[var(--admin-raised)]" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-24 rounded-lg bg-[var(--admin-raised)]" />
        ))}
      </div>
      <div className="h-80 rounded-lg bg-[var(--admin-raised)]" />
    </div>
  )
}
