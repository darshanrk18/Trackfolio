"use client";

import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  Archive,
  BookOpen,
  LogOut,
  Monitor,
  Moon,
  Search,
  Settings,
  Sun,
  TriangleAlert,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar({
  user,
  urgentCount = 0,
}: {
  user: { name?: string | null; email: string; image?: string | null };
  urgentCount?: number;
}) {
  return (
    <header className="bg-bg/85 border-line sticky top-0 z-40 flex h-13 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-md lg:px-6">
      <div className="min-w-0 flex-1">
        <CommandTrigger />
      </div>

      {urgentCount > 0 && (
        <Link
          href="/dashboard"
          className="bg-bad-soft text-bad hover:border-bad-border hidden items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1 font-mono text-[11px] sm:inline-flex"
        >
          <TriangleAlert className="size-3.5" aria-hidden />
          {urgentCount} urgent
        </Link>
      )}

      <ThemeMenu />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="focus-visible:ring-3 focus-visible:ring-[var(--primary-soft)] rounded-full outline-none"
            aria-label="Account menu"
          >
            <Avatar className="size-7">
              {user.image && <AvatarImage src={user.image} alt="" />}
              <AvatarFallback name={user.name ?? user.email} />
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <span className="block truncate font-medium">{user.name ?? "Signed in"}</span>
            <span className="text-ink-3 block truncate text-[11.5px] font-normal">
              {user.email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/data">
              <Archive />
              Backup & Data
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/guide">
              <BookOpen />
              How it works
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            destructive
            icon={<LogOut />}
            onSelect={() => void signOut({ callbackUrl: "/" })}
          >
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

/** Visible affordance for ⌘K, which is otherwise undiscoverable. */
function CommandTrigger() {
  const dispatch = () => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
    );
  };

  return (
    <button
      type="button"
      onClick={dispatch}
      aria-label="Search"
      className={cn(
        "bg-surface border-line text-ink-3 hover:border-line-2 hover:text-ink-2 flex w-full max-w-sm items-center gap-2 rounded-[var(--radius-sm)] border px-2.5 py-1.5 text-[12.5px] transition-colors",
        "focus-visible:ring-3 focus-visible:ring-[var(--primary-soft)] outline-none",
      )}
    >
      <Search className="size-3.5" aria-hidden />
      <span className="hidden sm:inline">Jump to a mode, company, or command</span>
      <span className="sm:hidden">Search</span>
      <kbd className="border-line-2 ml-auto hidden rounded border px-1 font-mono text-[10px] sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}

const noopSubscribe = () => () => {};

function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(noopSubscribe, () => true, () => false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme">
          {!mounted ? (
            <Monitor />
          ) : theme === "dark" ? (
            <Moon />
          ) : theme === "light" ? (
            <Sun />
          ) : (
            <Monitor />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
