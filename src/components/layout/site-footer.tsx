import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/5 bg-ink-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 font-mono text-xs uppercase tracking-[0.06em] text-frost-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>Коллектив «{site.name}»</p>
        <p>{site.cities.join(" · ")}</p>
      </div>
    </footer>
  );
}
