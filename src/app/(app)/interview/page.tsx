import type { Metadata } from "next";
import { Suspense } from "react";
import { InterviewView } from "./interview-view";
import { Skeleton } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Interview Prep" };

export default function InterviewPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <InterviewView />
    </Suspense>
  );
}
