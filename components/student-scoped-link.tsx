"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

export function StudentScopedLink({
  studentId,
  href,
  className,
  children,
  testId
}: {
  studentId: number;
  href: string;
  className?: string;
  children: ReactNode;
  testId?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending) {
      return;
    }

    setPending(true);
    await fetch("/api/students/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId })
    }).catch(() => undefined);
    router.push(href);
  }

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={handleClick}
      disabled={pending}
      className={className}
    >
      {children}
    </button>
  );
}
