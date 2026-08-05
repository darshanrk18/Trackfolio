"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/feedback";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="This view failed to load"
      description={error.message || "Try again in a moment."}
      onRetry={reset}
    />
  );
}
