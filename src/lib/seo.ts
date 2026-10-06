import { site, team } from "@/lib/site";
import { getRealizedWorks } from "@/lib/works";

const ORG_ID = `${site.url}/#organization`;
const WEBSITE_ID = `${site.url}/#website`;

const SERVICES = [
  "Ледовые скульптуры на заказ",
  "Ледовая фотозона и арка",
  "Логотип изо льда",
  "Шоу-резьба по льду на банкете",
  "Новогоднее оформление фасадов и витрин",
  "Ледовый городок",
];

/** Организация, сайт и команда — одним графом, чтобы поисковик связал их между собой. */
export function organizationJsonLd() {
  const cover = getRealizedWorks().find((work) => work.cover)?.cover;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: `Коллектив «${site.name}»`,
        alternateName: site.name,
        description: site.description,
        url: site.url,
        logo: `${site.url}/icon.svg`,
        ...(cover ? { image: `${site.url}${cover.src}` } : {}),
        email: site.contacts.email.label,
        telephone: site.contacts.phone.href.replace("tel:", ""),
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer service",
          telephone: site.contacts.phone.href.replace("tel:", ""),
          email: site.contacts.email.label,
          areaServed: "RU",
          availableLanguage: "Russian",
        },
        areaServed: [
          ...site.cities.map((city) => ({ "@type": "City", name: city })),
          { "@type": "AdministrativeArea", name: site.region },
        ],
        knowsAbout: [
          "Ледовая скульптура",
          "Резьба по льду",
          "Художественная подсветка",
          "Новогоднее оформление",
        ],
        founder: { "@id": `${site.url}/#person-0` },
        member: team.map((_, index) => ({ "@id": `${site.url}/#person-${index}` })),
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Услуги",
          itemListElement: SERVICES.map((name) => ({
            "@type": "Offer",
            itemOffered: { "@type": "Service", name, areaServed: site.region },
          })),
        },
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        url: site.url,
        name: `Коллектив «${site.name}»`,
        inLanguage: "ru-RU",
        publisher: { "@id": ORG_ID },
      },
      ...team.map((member, index) => ({
        "@type": "Person",
        "@id": `${site.url}/#person-${index}`,
        name: member.name,
        jobTitle: member.role,
        description: member.bio,
        image: `${site.url}${member.photo.src}`,
        worksFor: { "@id": ORG_ID },
      })),
    ],
  };
}

/** Хлебные крошки: Главная → … → текущая страница. */
export function breadcrumbsJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Главная", path: "/" }, ...items].map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${site.url}${item.path === "/" ? "" : item.path}`,
    })),
  };
}
