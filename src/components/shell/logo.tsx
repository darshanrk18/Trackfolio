import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Wordmark. The diamond is a rotated square that reads as both a commit node
 * and a milestone marker, which is the product in one glyph.
 */
export function Logo({
  compact = false,
  href = "/dashboard",
  className,
}: {
  compact?: boolean;
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("group flex items-center gap-2 outline-none", className)}
      aria-label="Trackfolio home"
    >
      <span
        aria-hidden
        className="bg-primary size-2.5 shrink-0 rotate-45 rounded-[2px] transition-transform duration-200 group-hover:rotate-[135deg]"
      />
      {!compact && (
        <span className="min-w-0">
          <span className="font-display block text-[16px] leading-none font-bold tracking-[-0.02em]">
            Trackfolio
          </span>
          <span className="text-eyebrow mt-1 block leading-none">Job Search OS</span>
        </span>
      )}
    </Link>
  );
}
