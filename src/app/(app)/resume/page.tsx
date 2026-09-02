import type { Metadata } from "next";
import { Suspense } from "react";
import { ResumeLab } from "./resume-lab";
import { Skeleton } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Resume Lab" };

export default function ResumePage() {
  return (
    <Suspense fallback={<Skeleton className="h-[640px]" />}>
      <ResumeLab />
    </Suspense>
  );
}
