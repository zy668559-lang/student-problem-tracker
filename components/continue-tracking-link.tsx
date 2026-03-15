"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

export function ContinueTrackingLink({
  href,
  diagnosisId,
  eventValue,
  className,
  children
}: {
  href: string;
  diagnosisId?: number | null;
  eventValue?: string | null;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending) return;
    setPending(true);
    if (diagnosisId) {
      await fetch("/api/result-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagnosisId, eventName: "click_continue_tracking", eventValue: eventValue ?? null }),
        keepalive: true
      }).catch(() => undefined);
    }
    router.push(href);
  }

  return (
    <button type="button" onClick={handleClick} disabled={pending} className={className}>
      {children}
    </button>
  );
}
