import type { Metadata } from "next";
import { ApplicationWorkspace } from "./workspace-view";

export const metadata: Metadata = { title: "Workspace" };

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ApplicationWorkspace id={id} />;
}
