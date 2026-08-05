import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { serverApi } from "@/trpc/server";
import { Sidebar, type BadgeCounts } from "@/components/shell/sidebar";
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

  try {
    const api = await serverApi();
    const [stats, actions] = await Promise.all([
      api.applications.stats(),
      api.insights.actionQueue(),
    ]);
    counts = {
      applications: stats.total,
      actions: actions.length,
    };
    alerts = {
      actions: actions.some((a) => a.kind === "urgent"),
    };
  } catch (error) {
    logger.warn({ err: error }, "failed to load sidebar badge counts");
  }

  return (
    <div className="flex min-h-dvh">
      <Sidebar counts={counts} alerts={alerts} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} />
        <main id="main" className="min-w-0 flex-1 px-4 pt-5 pb-20 lg:px-8">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
