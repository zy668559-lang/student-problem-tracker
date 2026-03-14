import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const toneMap = {
  accent: "border-accent/20 bg-accent/10 text-accent",
  gold: "border-gold/25 bg-gold/10 text-gold",
  rose: "border-rose/20 bg-rose/10 text-rose",
  ink: "border-ink/10 bg-ink/10 text-ink"
} as const;

export function Badge({
  children,
  tone = "ink"
}: {
  children: ReactNode;
  tone?: keyof typeof toneMap;
}) {
  return (
    <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", toneMap[tone])}>
      {children}
    </span>
  );
}
