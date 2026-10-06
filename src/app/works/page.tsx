import type { Metadata } from "next";
import Link from "next/link";
import { WorkCard } from "@/components/work/work-card";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbsJsonLd } from "@/lib/seo";
import { site } from "@/lib/site";
import { getAllWorks, type WorkStatus } from "@/lib/works";

type Filter = "all" | WorkStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "realized", label: "Реализованные" },
  { value: "concept", label: "Концепции" },
];

export const metadata: Metadata = {
  title: "Ледовые скульптуры — работы и концепции",
  description:
    "Портфолио ледовых скульптур: реализованные проекты в Красноярске, Дивногорске и Ужуре и концепции, которые можно заказать под свою площадку.",
  alternates: { canonical: "/works" },
  openGraph: {
    title: "Ледовые скульптуры — работы и концепции",
    description:
      "Реализованные ледовые скульптуры в Красноярском крае и концепции под вашу площадку.",
    url: "/works",
  },
};

type Props = { searchParams: Promise<{ filter?: string }> };

export default async function WorksPage({ searchParams }: Props) {
  const { filter } = await searchParams;
  const active: Filter =
    filter === "realized" || filter === "concept" ? filter : "all";

  const works = getAllWorks().filter(
    (work) => active === "all" || work.status === active,
  );

  const all = getAllWorks();

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd data={breadcrumbsJsonLd([{ name: "Работы", path: "/works" }])} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Ледовые скульптуры — работы и концепции",
          url: `${site.url}/works`,
          inLanguage: "ru-RU",
          mainEntity: {
            "@type": "ItemList",
            itemListElement: all.map((work, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: `${site.url}/works/${work.slug}`,
              name: work.title,
            })),
          },
        }}
      />
      <header className="max-w-xl">
        <h1 className="text-5xl leading-[0.95] text-frost-50 sm:text-7xl">
          <span className="eyebrow mb-5 block leading-normal">
            Портфолио ледовых скульптур
          </span>
          Работы и концепции
        </h1>
        <p className="mt-7 text-lg leading-relaxed text-frost-400">
          Реализованные скульптуры и форматы под конкретную площадку.
        </p>
      </header>

      {/* Фильтр живёт в URL, а не в состоянии: ссылку на отфильтрованный список
          можно отправить, и она открывается сразу в нужном виде. */}
      <nav className="mt-12 flex flex-wrap gap-x-8 gap-y-3 border-b hairline pb-px">
        {FILTERS.map((item) => (
          <Link
            key={item.value}
            href={item.value === "all" ? "/works" : `/works?filter=${item.value}`}
            scroll={false}
            aria-current={item.value === active ? "page" : undefined}
            className="switch"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-12 grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {works.map((work, index) => (
          <WorkCard key={work.slug} work={work} priority={index < 3} />
        ))}
      </div>

      {works.length === 0 && (
        <p className="mt-16 text-frost-500">В этом разделе пока ничего нет.</p>
      )}
    </div>
  );
}
