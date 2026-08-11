import type { Metadata } from "next";
import { WorkspacePicker } from "./workspace-picker";

export const metadata: Metadata = { title: "Workspace" };

export default function WorkspacePage() {
  return <WorkspacePicker />;
}
