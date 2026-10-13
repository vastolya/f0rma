import Image from "next/image";
import { STATUS_LABELS, type Work } from "@/lib/works";

/**
 * Единственное место, где описан контент работы. Его рендерят и полная страница
 * /works/[slug], и перехваченная модалка — так текст не расходится между ними.
 */
export function WorkContent({ work }: { work: Work }) {
  const location = [work.city, work.venue].filter(Boolean).join(" · ");

  return (
    <article className="pb-16">
      <header className="mb-10">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <span
            className={`eyebrow ${
              work.status === "concept" ? "text-aurora-400" : "text-glacier-300"
            }`}
          >
            {STATUS_LABELS[work.status]}
          </span>
          {work.award && <span className="eyebrow text-frost-100">{work.award}</span>}
        </div>

        <h1 className="mt-5 font-display text-4xl leading-[1.05] text-frost-50 sm:text-6xl">
          {work.title}
        </h1>

        {(location || work.year) && (
          <p className="mt-4 text-frost-400">
            {location}
            {location && work.year ? ", " : ""}
            {work.year}
          </p>
        )}
      </header>

      {work.cover && (
        <figure className="mb-14 overflow-hidden bg-ink-800">
          <Image
            src={work.cover.src}
            alt={work.cover.alt}
            width={work.cover.width}
            height={work.cover.height}
            preload
            sizes="(max-width: 1024px) 100vw, 900px"
            className="h-auto w-full object-cover"
          />
        </figure>
      )}

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
        <div className="space-y-5 text-[1.0625rem] leading-relaxed text-frost-200">
          {work.description.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
        </div>

        <aside>
          <h2 className="eyebrow mb-4">Характеристики</h2>
          <dl className="divide-y divide-[color-mix(in_oklab,var(--color-frost-400)_16%,transparent)] border-y hairline">
            {work.specs.map((spec) => (
              <div
                key={spec.label}
                className="flex flex-wrap justify-between gap-x-6 gap-y-1 py-3"
              >
                <dt className="text-sm text-frost-500">{spec.label}</dt>
                <dd className="text-right text-sm text-frost-100">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>

      {work.media.length > 1 && (
        <section className="mt-16">
          <h2 className="eyebrow mb-5">
            {work.status === "concept" ? "Визуализации" : "Съёмка"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {work.media.slice(1).map((item) => (
              <figure
                key={item.src}
                className="overflow-hidden bg-ink-800"
              >
                <Image
                  src={item.src}
                  alt={item.alt}
                  width={item.width}
                  height={item.height}
                  loading="lazy"
                  sizes="(max-width: 640px) 100vw, 45vw"
                  className="h-auto w-full object-cover"
                />
              </figure>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
