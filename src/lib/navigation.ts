import type { LucideIcon } from "lucide-react";
import {
  Archive,
  BarChart3,
  BookOpen,
  Braces,
  Briefcase,
  Building2,
  FileText,
  GitCompareArrows,
  History,
  LayoutDashboard,
  MessagesSquare,
  PenLine,
  Settings,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Key into the badge counts returned by the layout's data fetch. */
  badgeKey?: "actions" | "applications" | "versions" | "contacts" | "coverLetters";
  /** Shown in the command palette and as a tooltip. */
  description: string;
  shortcut?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Four work modes in the primary sidebar / mobile bar.
 * Secondary destinations stay on ALL_NAV_ITEMS so bookmarks and ⌘K still work.
 */
export const MODE_NAV: readonly NavItem[] = [
  {
    href: "/dashboard",
    label: "Today",
    icon: LayoutDashboard,
    badgeKey: "actions",
    description: "Search pulse and the next actions that matter",
    shortcut: "G D",
  },
  {
    href: "/resume",
    label: "Documents",
    icon: FileText,
    badgeKey: "versions",
    description: "Resume lab, cover letters, history and compare",
    shortcut: "G R",
  },
  {
    href: "/applications",
    label: "Pipeline",
    icon: Building2,
    badgeKey: "applications",
    description: "Board, workspaces, interviews and people",
    shortcut: "G P",
  },
  {
    href: "/analyze",
    label: "Insights",
    icon: Target,
    description: "Fit, grounded assistant and conversion",
    shortcut: "G N",
  },
] as const;

/** Routes that belong to a mode even when they are not the mode's primary href. */
export const MODE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "/dashboard": ["/dashboard", "/actions"],
  "/resume": ["/resume", "/cover-letters", "/history", "/compare"],
  "/applications": ["/applications", "/workspace", "/interview", "/contacts"],
  "/analyze": ["/analyze", "/assistant", "/analytics"],
};

export function isNavActive(pathname: string, href: string): boolean {
  const targets = MODE_ALIASES[href] ?? [href];
  return targets.some((target) => pathname === target || pathname.startsWith(`${target}/`));
}

export const SECONDARY_NAV: readonly NavItem[] = [
  {
    href: "/actions",
    label: "Action Center",
    icon: Zap,
    badgeKey: "actions",
    description: "The full ranked queue of follow-ups and gaps",
    shortcut: "G A",
  },
  {
    href: "/cover-letters",
    label: "Cover Letters",
    icon: PenLine,
    badgeKey: "coverLetters",
    description: "Draft and version cover letters",
  },
  {
    href: "/history",
    label: "History",
    icon: History,
    description: "Every saved version, kept in full",
  },
  {
    href: "/compare",
    label: "Compare",
    icon: GitCompareArrows,
    description: "Diff any two versions before you send",
  },
  {
    href: "/assistant",
    label: "AI Assistant",
    icon: Sparkles,
    description: "Rewrite bullets and find honest gaps",
  },
  {
    href: "/workspace",
    label: "Workspace",
    icon: Briefcase,
    description: "Open an application workspace",
  },
  {
    href: "/interview",
    label: "Interview Prep",
    icon: MessagesSquare,
    description: "Prepare from what you actually sent",
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    description: "Learn what actually converts",
  },
  {
    href: "/contacts",
    label: "Contacts",
    icon: Users,
    badgeKey: "contacts",
    description: "Recruiters, referrals and networking",
  },
] as const;

export const ACCOUNT_NAV: readonly NavItem[] = [
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    description: "Profile, theme and preferences",
  },
  {
    href: "/data",
    label: "Backup & Data",
    icon: Archive,
    description: "Export, restore and portability",
  },
] as const;

/** Kept for older imports; the sidebar now uses MODE_NAV. */
export const NAV_GROUPS: readonly NavGroup[] = [
  { label: "Modes", items: [...MODE_NAV] },
];

export const ALL_NAV_ITEMS: readonly NavItem[] = [
  ...MODE_NAV,
  ...SECONDARY_NAV,
  ...ACCOUNT_NAV,
];

export const HELP_ITEM: NavItem = {
  href: "/guide",
  label: "How Trackfolio works",
  icon: BookOpen,
  description: "A two-minute tour of the workflow",
};

export const MODE_SHORTCUTS: Readonly<Record<string, string>> = {
  d: "/dashboard",
  r: "/resume",
  p: "/applications",
  n: "/analyze",
  a: "/actions",
};

export { Braces };
