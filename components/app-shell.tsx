"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "总览" },
  { href: "/upload", label: "上传" },
  { href: "/subject/math", label: "数学模块" },
  { href: "/subject/english", label: "英语模块" },
  { href: "/review-queue", label: "审核台" }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1480px] gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <aside className="hidden w-72 shrink-0 rounded-panel border border-white/70 bg-white/85 p-6 shadow-panel backdrop-blur lg:flex lg:flex-col">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent/70">Student Problem Tracker</p>
          <h1 className="mt-3 text-2xl font-semibold text-ink">问题诊断与变化追踪</h1>
          <p className="mt-3 text-sm leading-6 text-slate">
            后台只盯三件事：问题、动作、变化。
          </p>
        </div>
        <nav className="mt-8 space-y-2">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition",
                  active
                    ? "bg-ink text-white shadow-lg shadow-ink/10"
                    : "text-slate hover:bg-mist hover:text-ink"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <form action="/api/logout" method="post" className="mt-auto">
          <button className="w-full rounded-2xl border border-line px-4 py-3 text-sm font-medium text-slate transition hover:border-accent hover:text-accent">
            退出登录
          </button>
        </form>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
