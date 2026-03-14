export default function NotFound() {
  return (
    <div className="rounded-panel border border-white/70 bg-white/90 p-8 shadow-panel">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Not Found</p>
      <h1 className="mt-3 text-3xl font-semibold text-ink">页面不存在</h1>
      <p className="mt-3 text-sm leading-7 text-slate">请从左侧导航重新进入页面。</p>
    </div>
  );
}
