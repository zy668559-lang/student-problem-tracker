"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password")
      })
    });

    const result = (await response.json()) as { ok: boolean; message?: string };

    if (!response.ok || !result.ok) {
      setError(result.message ?? "登录失败");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form
      action={handleSubmit}
      className="rounded-panel border border-white/70 bg-white/90 p-8 shadow-panel backdrop-blur"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent/70">Local MVP</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">登录会员后台</h1>
        <p className="mt-3 text-sm leading-6 text-slate">
          演示账号：<code>parent@example.com</code> / <code>demo123</code>
        </p>
      </div>
      <div className="mt-8 space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">邮箱</span>
          <input
            name="email"
            type="email"
            required
            defaultValue="parent@example.com"
            className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 outline-none transition focus:border-accent"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">密码</span>
          <input
            name="password"
            type="password"
            required
            defaultValue="demo123"
            className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 outline-none transition focus:border-accent"
          />
        </label>
      </div>
      {error ? <p className="mt-4 text-sm text-rose">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="mt-8 w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "登录中..." : "进入后台"}
      </button>
    </form>
  );
}
