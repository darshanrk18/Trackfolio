import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shell/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo href="/" className="mb-8" />
      <p className="text-eyebrow mb-2">404</p>
      <h1 className="font-display text-[28px] font-bold tracking-[-0.02em]">
        That page isn’t here
      </h1>
      <p className="text-ink-2 mt-2 max-w-[46ch] text-[14px]">
        The link may be old, or the application you’re looking for was deleted.
      </p>
      <div className="mt-6 flex gap-2">
        <Button variant="primary" asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
