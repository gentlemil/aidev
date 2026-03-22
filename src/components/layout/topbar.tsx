'use client'

import { useTransition } from 'react'
import { Menu, LogOut, Loader2 } from 'lucide-react'
import { logoutAction } from '@/features/auth/actions'
import { getInitials } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

interface TopbarProps {
  onMenuClick: () => void
  user: {
    firstName: string
    lastName: string
    email?: string | null
  }
}

export function Topbar({ onMenuClick, user }: TopbarProps) {
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    startTransition(async () => {
      await logoutAction()
    })
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4 lg:px-6">
      {/* Left: mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
        aria-label="Open sidebar">
        <Menu className="h-5 w-5" />
      </button>

      {/* Spacer on desktop */}
      <div className="hidden lg:block" />

      {/* Right: theme toggle + user + logout */}
      <div className="flex items-center gap-1">
        <ThemeToggle />

        <div className="mx-2 h-5 w-px bg-border" />

        {/* Avatar */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-800 dark:bg-amber-800/40 dark:text-amber-400">
          {getInitials(user.firstName, user.lastName)}
        </div>

        {/* Name (desktop only) */}
        <div className="ml-1 hidden flex-col sm:flex">
          <span className="text-sm font-medium leading-none">
            {user.firstName} {user.lastName}
          </span>
          {user.email && <span className="mt-0.5 text-xs text-muted-foreground">{user.email}</span>}
        </div>

        {/* Logout */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          disabled={isPending}
          aria-label="Sign out">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
        </Button>
      </div>
    </header>
  )
}
