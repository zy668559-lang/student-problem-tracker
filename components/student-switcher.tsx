"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StudentOption } from "@/lib/types";

export function StudentSwitcher({ students, activeStudentId }: { students: StudentOption[]; activeStudentId: number | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (students.length <= 1) {
    return null;
  }

  async function handleChange(studentId: string) {
    setLoading(true);
    await fetch("/api/students/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: Number(studentId) })
    }).catch(() => undefined);
    router.refresh();
    setLoading(false);
  }

  return (
    <label className="block rounded-3xl border border-line bg-mist/60 p-4">
      <span className="block text-xs font-semibold uppercase tracking-[0.24em] text-accent/70">当前孩子</span>
      <select
        value={activeStudentId ?? students[0]?.id ?? ""}
        onChange={(event) => handleChange(event.target.value)}
        disabled={loading}
        className="mt-3 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent disabled:opacity-60"
      >
        {students.map((student) => (
          <option key={student.id} value={student.id}>
            {student.name}{student.grade ? ` · ${student.grade}` : ""}
          </option>
        ))}
      </select>
      <p className="mt-3 text-sm leading-6 text-slate">切孩子之后，上传、周报、记忆标签都会按这个孩子单独看，不会串。</p>
    </label>
  );
}
