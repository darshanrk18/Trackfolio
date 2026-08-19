import type { Metadata } from "next";
import { ActionsView } from "./actions-view";

export const metadata: Metadata = { title: "Action Center" };

export default function ActionsPage() {
  return <ActionsView />;
}
