"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { useTheme } from "next-themes";
import {
  Building2,
  Download,
  FileText,
  Moon,
  Plus,
  Search,
  Sun,
  UserPlus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/react";
import { ALL_NAV_ITEMS, HELP_ITEM, MODE_SHORTCUTS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * Global ⌘K palette.
 *
 * Combines static navigation and actions with live search across applications
 * and contacts, so the same keystroke answers both "take me somewhere" and
 * "find that company I applied to".
 */
export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const trpc = useTRPC();

  React.useEffect(() => {
    let chord: ReturnType<typeof setTimeout> | null = null;
    let awaiting = false;

    const typing = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      if (typing(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
        awaiting = false;
        return;
      }

      const key = event.key.toLowerCase();
      if (!awaiting && key === "g") {
        awaiting = true;
        if (chord) clearTimeout(chord);
        chord = setTimeout(() => {
          awaiting = false;
        }, 800);
        return;
      }

      if (awaiting) {
        const href = MODE_SHORTCUTS[key];
        awaiting = false;
        if (href) {
          event.preventDefault();
          router.push(href);
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (chord) clearTimeout(chord);
    };
  }, [router]);

  // Only query once the palette is open and the user has typed enough to be
  // meaningful, so opening the palette costs nothing.
  const searchEnabled = open && query.trim().length >= 2;

  const { data: applications } = useQuery({
    ...trpc.applications.list.queryOptions({ search: query.trim(), limit: 6 }),
    enabled: searchEnabled,
  });

  const { data: contacts } = useQuery({
    ...trpc.contacts.list.queryOptions({ search: query.trim(), limit: 5 }),
    enabled: searchEnabled,
  });

  const run = React.useCallback((action: () => void) => {
    setOpen(false);
    setQuery("");
    // Defer so the dialog can unmount before navigation steals focus.
    requestAnimationFrame(action);
  }, []);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      shouldFilter
      className={cn(
        "fixed top-1/2 left-1/2 z-[100] w-[min(620px,92vw)] -translate-x-1/2 -translate-y-[55%]",
        "bg-surface border-line-2 overflow-hidden rounded-[var(--radius-lg)] border shadow-lg",
      )}
      overlayClassName="fixed inset-0 z-[99] bg-overlay backdrop-blur-[3px]"
    >
      <div className="border-line flex items-center gap-2.5 border-b px-4">
        <Search className="text-ink-3 size-4 shrink-0" aria-hidden />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Jump to a view, search a company, or run a command…"
          className="placeholder:text-ink-3 flex-1 bg-transparent py-3.5 text-[14.5px] outline-none"
        />
        <kbd className="border-line-2 text-ink-3 rounded border px-1.5 py-0.5 font-mono text-[10px]">
          ESC
        </kbd>
      </div>

      <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
        <Command.Empty className="text-ink-3 py-10 text-center text-[13px]">
          No results for “{query}”.
        </Command.Empty>

        {applications && applications.length > 0 && (
          <Group heading="Applications">
            {applications.map((app) => (
              <Item
                key={app.id}
                value={`app ${app.company} ${app.role}`}
                icon={<Building2 />}
                onSelect={() => run(() => router.push(`/applications/${app.id}`))}
                hint={app.status}
              >
                {app.company}
                {app.role ? (
                  <span className="text-ink-3"> · {app.role}</span>
                ) : null}
              </Item>
            ))}
          </Group>
        )}

        {contacts && contacts.length > 0 && (
          <Group heading="Contacts">
            {contacts.map((contact) => (
              <Item
                key={contact.id}
                value={`contact ${contact.name} ${contact.company ?? ""}`}
                icon={<UserPlus />}
                onSelect={() => run(() => router.push(`/contacts?focus=${contact.id}`))}
                hint={contact.company ?? undefined}
              >
                {contact.name}
              </Item>
            ))}
          </Group>
        )}

        <Group heading="Go to">
          {[...ALL_NAV_ITEMS, HELP_ITEM].map((item) => (
            <Item
              key={item.href}
              value={`go ${item.label} ${item.description}`}
              icon={<item.icon />}
              onSelect={() => run(() => router.push(item.href))}
              hint={item.shortcut}
            >
              {item.label}
              <span className="text-ink-3"> — {item.description}</span>
            </Item>
          ))}
        </Group>

        <Group heading="Actions">
          <Item
            value="new application log"
            icon={<Plus />}
            onSelect={() => run(() => router.push("/applications?new=1"))}
          >
            Log a new application
          </Item>
          <Item
            value="new resume branch tailor"
            icon={<FileText />}
            onSelect={() => run(() => router.push("/resume?newBranch=1"))}
          >
            Create a tailored resume branch
          </Item>
          <Item
            value="export backup download json"
            icon={<Download />}
            onSelect={() => run(() => router.push("/data"))}
          >
            Export a full backup
          </Item>
          <Item
            value="toggle theme dark light appearance"
            icon={resolvedTheme === "dark" ? <Sun /> : <Moon />}
            onSelect={() =>
              run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))
            }
          >
            Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
          </Item>
        </Group>
      </Command.List>
    </Command.Dialog>
  );
}

function Group({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <Command.Group
      heading={heading}
      className="[&_[cmdk-group-heading]]:text-eyebrow [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1"
    >
      {children}
    </Command.Group>
  );
}

function Item({
  value,
  icon,
  hint,
  onSelect,
  children,
}: {
  value: string;
  icon: React.ReactNode;
  hint?: string;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-[13.5px]",
        "data-[selected=true]:bg-primary-soft data-[selected=true]:text-primary-ink",
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:opacity-70",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && (
        <span className="text-ink-3 shrink-0 font-mono text-[10.5px] uppercase">
          {hint}
        </span>
      )}
    </Command.Item>
  );
}
