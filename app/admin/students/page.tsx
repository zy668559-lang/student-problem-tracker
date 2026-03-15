export const dynamic = "force-dynamic";

import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import { listAdminStudents } from "@/lib/db/admin";
import { formatDate, reviewStatusLabel } from "@/lib/utils";

export default function AdminStudentsPage() {
  const students = listAdminStudents();

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Students</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">学生列表</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">看学生档案、最近上传、最近 diagnosis 和最近记忆标签，确认数据是不是按 student_id 独立沉淀。</p>
      </section>

      <div className="space-y-5">
        {students.map((student) => (
          <SectionCard key={student.studentId} title={student.studentName} subtitle={`${student.grade ?? "未填年级"} · ${student.school ?? "未填学校"}`}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2 text-sm leading-6 text-slate">
                <p><span className="font-semibold text-ink">家长账号：</span>{student.parentName} / {student.parentEmail}</p>
                <p><span className="font-semibold text-ink">最近上传：</span>{student.latestUploadLabel ?? "还没传过"}{student.latestUploadAt ? ` · ${formatDate(student.latestUploadAt)}` : ""}</p>
                <p><span className="font-semibold text-ink">最近诊断：</span>{student.latestDiagnosisStage ?? "还没生成过"}{student.latestDiagnosisStatus ? ` · ${reviewStatusLabel(student.latestDiagnosisStatus)}` : ""}</p>
                <p><span className="font-semibold text-ink">下轮优先级：</span>{student.nextPriority ?? "还没沉淀出来"}</p>
              </div>
              <div className="space-y-3 text-sm leading-6 text-slate">
                <p className="font-semibold text-ink">最近记忆标签</p>
                <div className="flex flex-wrap gap-3">
                  {student.recentMemoryTags.length > 0 ? student.recentMemoryTags.map((tag) => (
                    <span key={tag} className="rounded-full border border-line px-3 py-2">{tag}</span>
                  )) : <span className="text-slate">这位孩子还没沉出记忆标签。</span>}
                </div>
                <div className="flex flex-wrap gap-3 pt-2">
                  {student.latestDiagnosisId ? <Link href={`/diagnosis/${student.latestDiagnosisId}`} className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white">看诊断</Link> : null}
                  {student.latestWeeklyReportId ? <Link href={`/weekly-report/${student.latestWeeklyReportId}`} className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink">看周报</Link> : null}
                </div>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
