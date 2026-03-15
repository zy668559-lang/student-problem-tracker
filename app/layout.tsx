import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { listStudentsForUser } from "@/lib/db/admin";
import { ensureProductSchema } from "@/lib/db/product";
import { getServerSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Student Problem Tracker",
  description: "学生问题诊断与变化追踪系统本地 MVP"
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  ensureProductSchema();
  const session = await getServerSession();
  const students = session?.userId ? listStudentsForUser(session.userId) : [];

  return (
    <html lang="zh-CN">
      <body>
        <AppShell session={session} students={students}>{children}</AppShell>
      </body>
    </html>
  );
}
