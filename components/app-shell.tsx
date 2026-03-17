"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { StudentSwitcher } from "@/components/student-switcher";
import type { AppSession, StudentOption } from "@/lib/types";
import { cn } from "@/lib/utils";

const parentNavGroups = [
  {
    title: "家长视角",
    items: [
      { href: "/parent-overview", label: "家长总览" },
      { href: "/membership", label: "\u4e09\u79cd\u65b9\u5f0f\u5dee\u5728\u54ea" }
    ]
  },
  {
    title: "学生视角",
    items: [
      { href: "/student-home", label: "孩子首页" },
      { href: "/subject/math", label: "数学模块" },
      { href: "/subject/english", label: "英语模块" }
    ]
  },
  {
    title: "系统运营",
    items: [
      { href: "/upload", label: "上传" },
      { href: "/timeline", label: "\u53d8\u5316\u8bb0\u5f55" }
    ]
  }
] as const;

const adminNavItems = [
  { href: "/admin", label: "后台总览" },
  { href: "/admin/whitelist", label: "白名单" },
  { href: "/admin/students", label: "学生列表" },
  { href: "/admin/operations", label: "审核与成单" },
  { href: "/admin/assets", label: "素材库" },
  { href: "/admin/recheck-tasks", label: "复检任务" },
  { href: "/admin/followups", label: "跟进漏斗" },
  { href: "/admin/memberships", label: "会员状态" }
] as const;

export function AppShell({
  children,
  session,
  students
}: {
  children: ReactNode;
  session: AppSession | null;
  students: StudentOption[];
}) {
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
          <p className="mt-3 text-sm leading-6 text-slate">这一侧只帮你分清三件事：谁在看，先做什么，接下来去哪。</p>
        </div>

        <div className="mt-6 space-y-4">
          {!isAdmin ? <StudentSwitcher students={students} activeStudentId={session?.activeStudentId ?? null} /> : null}
          <div className="rounded-3xl border border-line bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent/70">账号视角</p>
            <p className="mt-3 text-sm font-semibold text-ink">{isAdmin ? "管理员账号" : "家长账号"}</p>
            <p className="mt-2 text-sm leading-6 text-slate">
              {isAdmin
                ? "管理员只看运营处理，不改前台角色壳。"
                : "\u5f53\u524d\u8d26\u53f7\u4e0b\u7684\u5b69\u5b50\u4f1a\u5206\u5f00\u770b\uff0c\u4e0a\u4f20\u3001\u6bcf\u5468\u5c0f\u7ed3\u3001\u53d8\u5316\u8bb0\u5f55\u548c\u4f1a\u5458\u72b6\u6001\u90fd\u4e0d\u4f1a\u4e32\u7ebf\u3002"}
            </p>
          </div>
        </div>

        {!isAdmin ? (
          <div className="mt-8 space-y-6">
            {parentNavGroups.map((group) => (
              <div key={group.title}>
                <p className="px-1 text-xs font-semibold uppercase tracking-[0.24em] text-accent/70">{group.title}</p>
                <nav className="mt-3 space-y-2">
                  {group.items.map((item) => {
                    const active = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition",
                          active ? "bg-ink text-white shadow-lg shadow-ink/10" : "text-slate hover:bg-mist hover:text-ink"
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        ) : null}

        {isAdmin ? (
          <div className="mt-8 border-t border-line pt-6">
            <p className="px-4 text-xs font-semibold uppercase tracking-[0.24em] text-accent/70">系统运营</p>
            <nav className="mt-3 space-y-2">
              {adminNavItems.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition",
                      active ? "bg-accent text-white shadow-lg shadow-accent/15" : "text-slate hover:bg-mist hover:text-ink"
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