import Image from "next/image";
import Link from "next/link";
import { STATUS_LABELS, workMeta, type Work } from "@/lib/works";

export function WorkCard({ work, priority = false }: { work: Work; priority?: boolean }) {
  const isConcept = work.status === "concept";

  return (
    <Link href={`/works/${work.slug}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden bg-ink-800">
        {work.cover ? (
          <Image
            src={work.cover.src}
            alt={work.cover.alt}
            fill
            preload={priority}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-[1.2s] ease-[var(--ease-out-soft)] group-hover:scale-[1.03]"
          />
        ) : (
          <ConceptPlaceholder />
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/80 via-transparent to-transparent" />

        {/* Статус набран разрядкой вместо плашки: лишняя геометрия не нужна. */}
        <span
          className={`eyebrow absolute left-4 top-4 ${
            isConcept ? "text-aurora-400" : "text-glacier-300"
          }`}
        >
          {STATUS_LABELS[work.status]}
        </span>

        {work.award && (
          <span className="eyebrow absolute right-4 top-4 text-frost-100">
            {work.award}
          </span>
        )}
      </div>

      <div className="border-t hairline pt-4">
        <h3 className="text-2xl text-frost-50 transition-colors group-hover:text-glacier-300">
          {work.title}
        </h3>
        <p className="mt-2 font-mono text-xs uppercase tracking-[0.06em] text-frost-500">{workMeta(work)}</p>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-frost-400">
          {work.excerpt}
        </p>
      </div>
    </Link>
  );
}

/** Концепции без визуализаций: вместо пустого прямоугольника — честная заглушка. */
function ConceptPlaceholder() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_30%_20%,var(--color-ink-700),var(--color-ink-900))]">
      <div className="text-center">
        <svg
          viewBox="0 0 48 48"
          fill="none"
          className="mx-auto h-12 w-12 text-frost-500/50"
          aria-hidden="true"
        >
          <path
            d="M24 4 44 24 24 44 4 24 24 4Z"
            stroke="currentColor"
            strokeWidth="1.25"
          />
          <path d="M24 4v40M4 24h40" stroke="currentColor" strokeWidth="0.75" />
        </svg>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-frost-500">
          Эскиз готовится
        </p>
      </div>
    </div>
  );
}
