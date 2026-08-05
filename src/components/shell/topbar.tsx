"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { LogOut, Menu, Monitor, Moon, Search, Settings, Sun } from "lucide-react";
import { signOut } from "next-auth/react";
import { ALL_NAV_ITEMS, NAV_GROUPS } from "@/lib/navigation";
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
import {
  Dialog,
  DialogContent,
  DialogHiddenTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Logo } from "./logo";

export function Topbar({
  user,
}: {
  user: { name?: string | null; email: string; image?: string | null };
}) {
  const pathname = usePathname();
  const current = ALL_NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <header className="bg-bg/85 border-line sticky top-0 z-40 flex h-13 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-md lg:px-6">
      <MobileNav />

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[14.5px] font-semibold">
          {current?.label ?? "Trackfolio"}
        </h1>
      </div>

      <CommandTrigger />

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
          <DropdownMenuItem asChild icon={<Settings />}>
            <Link href="/settings">Settings</Link>
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
      className={cn(
        "bg-surface border-line text-ink-3 hover:border-line-2 hover:text-ink-2 flex items-center gap-2 rounded-[var(--radius-sm)] border px-2.5 py-1.5 text-[12.5px] transition-colors",
        "focus-visible:ring-3 focus-visible:ring-[var(--primary-soft)] outline-none",
      )}
    >
      <Search className="size-3.5" aria-hidden />
      <span className="hidden sm:inline">Search</span>
      <kbd className="border-line-2 hidden rounded border px-1 font-mono text-[10px] sm:inline">
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

function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [seenPath, setSeenPath] = React.useState(pathname);
  if (pathname !== seenPath) {
    setSeenPath(pathname);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
          <Menu />
        </Button>
      </DialogTrigger>
      <DialogContent size="sm" className="top-0 left-0 h-dvh max-h-dvh translate-x-0 translate-y-0 rounded-none">
        <DialogHiddenTitle>Navigation</DialogHiddenTitle>
        <div className="px-1 pb-4">
          <Logo />
        </div>
        <div className="overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="text-eyebrow mb-1 px-1">{group.label}</p>
              <ul className="space-y-px">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-[14px]",
                          active
                            ? "bg-primary-soft text-primary-ink font-semibold"
                            : "text-ink-2 hover:bg-surface-2",
                        )}
                      >
                        <item.icon className="size-4 shrink-0 opacity-75" aria-hidden />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
