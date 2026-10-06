import type { MetadataRoute } from "next";
import { site, team } from "@/lib/site";
import { getAllWorks } from "@/lib/works";

/** Дата сборки — честнее фиксированной даты: карта сайта обновляется при каждом деплое. */
const BUILT_AT = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  const all = getAllWorks();

  // Фотографии в карте сайта попадают в поиск по картинкам Google и Яндекса.
  const works = all.map((work) => ({
    url: `${site.url}/works/${work.slug}`,
    lastModified: BUILT_AT,
    changeFrequency: "yearly" as const,
    priority: work.status === "realized" ? 0.8 : 0.5,
    images: work.media.map((item) => `${site.url}${item.src}`),
  }));

  return [
    {
      url: site.url,
      lastModified: BUILT_AT,
      changeFrequency: "monthly",
      priority: 1,
      images: [
        ...all.flatMap((work) => (work.cover ? [`${site.url}${work.cover.src}`] : [])),
        ...team.map((member) => `${site.url}${member.photo.src}`),
      ],
    },
    {
      url: `${site.url}/works`,
      lastModified: BUILT_AT,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    ...works,
  ];
}
