import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { serverApi } from "@/trpc/server";
import { Sidebar, MobileTabBar, type BadgeCounts } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { CommandPalette } from "@/components/shell/command-palette";
import { logger } from "@/server/lib/logger";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  // Badge counts are decorative; a failure here must not blank the whole app.
  let counts: BadgeCounts = {};
  let alerts: Partial<Record<keyof BadgeCounts, boolean>> = {};
  let urgentCount = 0;

  try {
    const api = await serverApi();
    const shell = await api.insights.shell();
    counts = {
      applications: shell.applications,
      actions: shell.actions,
      versions: shell.versions,
      coverLetters: shell.coverLetters,
      contacts: shell.contacts,
    };
    alerts = {
      actions: shell.urgentActions > 0,
    };
    urgentCount = shell.urgentActions;
  } catch (error) {
    logger.warn({ err: error }, "failed to load sidebar badge counts");
  }

  return (
    <div className="flex min-h-dvh">
      <Sidebar counts={counts} alerts={alerts} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} urgentCount={urgentCount} />
        <main id="main" className="min-w-0 flex-1 px-4 pt-5 pb-24 lg:px-8 lg:pb-10">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>
      <MobileTabBar counts={counts} alerts={alerts} />
      <CommandPalette />
    </div>
  );
}
