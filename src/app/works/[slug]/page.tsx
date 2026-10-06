import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import { WorkContent } from "@/components/work/work-content";
import { breadcrumbsJsonLd } from "@/lib/seo";
import { site } from "@/lib/site";
import { getAllWorks, getWorkBySlug, type Work } from "@/lib/works";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getAllWorks().map((work) => ({ slug: work.slug }));
}

/**
 * Заголовок для выдачи. В названиях вроде «Пиковая дама» нет слова «лёд», а
 * ищут именно его — поэтому реализованным работам добавляем тип объекта.
 */
function seoTitle(work: Work): string {
  const hasKeyword = /л[её]д|льд/i.test(work.title);
  const base =
    work.status === "concept"
      ? `${work.title} — концепция`
      : hasKeyword
        ? work.title
        : `Ледовая скульптура «${work.title}»`;
  const location = [work.city, work.year].filter(Boolean).join(", ");
  return location ? `${base}, ${location}` : base;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const work = getWorkBySlug(slug);

  if (!work) return {};

  const title = seoTitle(work);

  return {
    title,
    description: work.excerpt,
    alternates: { canonical: `/works/${work.slug}` },
    openGraph: {
      type: "article",
      title,
      description: work.excerpt,
      url: `/works/${work.slug}`,
      images: work.cover
        ? [
            {
              url: work.cover.src,
              width: work.cover.width,
              height: work.cover.height,
              alt: work.cover.alt,
            },
          ]
        : undefined,
    },
  };
}

export default async function WorkPage({ params }: Props) {
  const { slug } = await params;
  const work = getWorkBySlug(slug);

  if (!work) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VisualArtwork",
    name: work.title,
    description: work.excerpt,
    url: `${site.url}/works/${work.slug}`,
    artMedium: "Натуральный лёд",
    artform: "Ледовая скульптура",
    creator: {
      "@type": "Organization",
      "@id": `${site.url}/#organization`,
      name: `Коллектив «${site.name}»`,
      url: site.url,
    },
    ...(work.media.length > 0
      ? { image: work.media.map((item) => `${site.url}${item.src}`) }
      : {}),
    ...(work.city
      ? {
          locationCreated: {
            "@type": "Place",
            name: [work.venue, work.city].filter(Boolean).join(", "),
          },
        }
      : {}),
    ...(work.year ? { dateCreated: String(work.year) } : {}),
    ...(work.award ? { award: work.award } : {}),
  };

  return (
    <div className="mx-auto max-w-5xl px-5 pt-10 sm:px-8">
      <JsonLd data={jsonLd} />
      <JsonLd
        data={breadcrumbsJsonLd([
          { name: "Работы", path: "/works" },
          { name: work.title, path: `/works/${work.slug}` },
        ])}
      />

      <Link
        href="/works"
        className="mb-10 inline-flex items-center gap-2 text-sm text-frost-400 transition-colors hover:text-glacier-300"
      >
        <span aria-hidden="true">←</span> Все работы
      </Link>

      <WorkContent work={work} />
    </div>
  );
}
