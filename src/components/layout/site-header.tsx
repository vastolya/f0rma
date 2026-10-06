import Link from "next/link";
import { nav, site } from "@/lib/site";

export function SiteHeader() {
  // Фон сплошной, без backdrop-blur: размытие пересчитывается на каждом кадре
  // прокрутки и заметно подтормаживает страницу.
  return (
    <header className="sticky top-0 z-40 border-b hairline bg-ink-950">
      <div className="mx-auto flex max-w-7xl items-baseline justify-between gap-4 px-5 py-5 sm:px-8">
        <Link
          href="/"
          className="font-display text-2xl uppercase leading-none tracking-[0.04em] text-frost-50"
        >
          {site.name}
        </Link>

        <nav className="flex items-baseline gap-6 sm:gap-8">
          {/* На мобильном остаются только «Работы» и телефон: он полезнее якорей. */}
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`switch ${item.href === "/works" ? "" : "hidden lg:inline"}`}
            >
              {item.label}
            </Link>
          ))}

          <a
            href={site.contacts.phone.href}
            className="whitespace-nowrap font-mono text-sm tabular-nums tracking-[0.04em] text-frost-50 transition-colors hover:text-glacier-300"
          >
            {site.contacts.phone.label}
          </a>
        </nav>
      </div>
    </header>
  );
}
