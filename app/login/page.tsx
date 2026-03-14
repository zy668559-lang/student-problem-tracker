import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section className="rounded-[36px] border border-white/60 bg-[linear-gradient(135deg,#17324a_0%,#214d65_45%,#0f766e_100%)] p-8 text-white shadow-panel sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/70">Parent Console</p>
          <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-tight">
            5 秒看懂孩子这周到底卡在哪里，以及下周怎么修。
          </h1>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/15 bg-white/10 p-4">
              <p className="text-sm text-white/70">问题</p>
              <p className="mt-2 text-lg font-semibold">本周主要错因</p>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-4">
              <p className="text-sm text-white/70">动作</p>
              <p className="mt-2 text-lg font-semibold">自动修复建议</p>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-4">
              <p className="text-sm text-white/70">变化</p>
              <p className="mt-2 text-lg font-semibold">稳定与未稳住项</p>
            </div>
          </div>
        </section>
        <LoginForm />
      </div>
    </main>
  );
}
