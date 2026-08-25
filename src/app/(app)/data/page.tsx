import type { Metadata } from "next";
import { DataView } from "./data-view";

export const metadata: Metadata = { title: "Backup & Data" };

export default function DataPage() {
  return <DataView />;
}
