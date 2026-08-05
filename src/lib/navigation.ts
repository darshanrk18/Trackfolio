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

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        description: "Where your search stands right now",
        shortcut: "G D",
      },
      {
        href: "/actions",
        label: "Action Center",
        icon: Zap,
        badgeKey: "actions",
        description: "The highest-value things to do next",
        shortcut: "G A",
      },
    ],
  },
  {
    label: "Documents",
    items: [
      {
        href: "/resume",
        label: "Resume Lab",
        icon: FileText,
        badgeKey: "versions",
        description: "Branch, tailor and compile your resume",
        shortcut: "G R",
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
    ],
  },
  {
    label: "Analysis",
    items: [
      {
        href: "/analyze",
        label: "Analyze",
        icon: Target,
        description: "Resume health and job-description fit",
        shortcut: "G N",
      },
      {
        href: "/assistant",
        label: "AI Assistant",
        icon: Sparkles,
        description: "Rewrite bullets and find honest gaps",
      },
    ],
  },
  {
    label: "Pipeline",
    items: [
      {
        href: "/applications",
        label: "Applications",
        icon: Building2,
        badgeKey: "applications",
        description: "Every submission and where it stands",
        shortcut: "G P",
      },
      {
        href: "/workspace",
        label: "Workspace",
        icon: Briefcase,
        description: "One company, everything together",
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
    ],
  },
  {
    label: "System",
    items: [
      {
        href: "/data",
        label: "Backup & Data",
        icon: Archive,
        description: "Export, restore and portability",
      },
      {
        href: "/settings",
        label: "Settings",
        icon: Settings,
        description: "Profile, theme and preferences",
      },
    ],
  },
] as const;

export const ALL_NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export const HELP_ITEM: NavItem = {
  href: "/guide",
  label: "How Trackfolio works",
  icon: BookOpen,
  description: "A two-minute tour of the workflow",
};

export { Braces };
