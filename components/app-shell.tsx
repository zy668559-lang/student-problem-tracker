"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { StudentSwitcher } from "@/components/student-switcher";
import type { AppSession, StudentOption } from "@/lib/types";
import { cn } from "@/lib/utils";

const parentNavItems = [
  { href: "/dashboard", label: "总览" },
  { href: "/upload", label: "上传" },
  { href: "/subject/math", label: "数学模块" },
  { href: "/subject/english", label: "英语模块" },
  { href: "/review-queue", label: "审核台" },
  { href: "/timeline", label: "证据时间轴" }
];

const adminNavItems = [
  { href: "/admin", label: "后台总览" },
  { href: "/admin/whitelist", label: "白名单" },
  { href: "/admin/students", label: "学生列表" },
  { href: "/admin/operations", label: "审核与成本" },
  { href: "/admin/assets", label: "素材库" },
  { href: "/admin/recheck-tasks", label: "复检任务" },
  { href: "/admin/followups", label: "跟进漏斗" }
];

export function AppShell({ children, session, students }: { children: ReactNode; session: AppSession | null; students: StudentOption[] }) {
  const pathname = usePathname();
  const isAdmin = session?.role === "admin";

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

        <div className="mt-6 space-y-4">
          {!isAdmin ? <StudentSwitcher students={students} activeStudentId={session?.activeStudentId ?? null} /> : null}
          <div className="rounded-3xl border border-line bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent/70">账号视角</p>
            <p className="mt-3 text-sm font-semibold text-ink">{isAdmin ? "管理员账号" : "家长账号"}</p>
            <p className="mt-2 text-sm leading-6 text-slate">{isAdmin ? "管理员能进运营后台，也会留下操作日志。" : "现在这个账号下的孩子会分开看数据，不会把上传、记忆和周报混在一起。"}</p>
          </div>
        </div>

        {!isAdmin ? (
          <nav className="mt-8 space-y-2">
            {parentNavItems.map((item) => {
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
        ) : null}

        {isAdmin ? (
          <div className="mt-8 border-t border-line pt-6">
            <p className="px-4 text-xs font-semibold uppercase tracking-[0.24em] text-accent/70">运营后台</p>
            <nav className="mt-3 space-y-2">
              {adminNavItems.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition",
                      active
                        ? "bg-accent text-white shadow-lg shadow-accent/15"
                        : "text-slate hover:bg-mist hover:text-ink"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        ) : null}

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



