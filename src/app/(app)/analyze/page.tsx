import type { Metadata } from "next";
import { AnalyzeView } from "./analyze-view";

export const metadata: Metadata = { title: "Analyze" };

export default function AnalyzePage() {
  return <AnalyzeView />;
}
