import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MapSection } from "@/components/ice-map/map-section";
import { WorkCard } from "@/components/work/work-card";
import { JsonLd } from "@/components/seo/json-ld";
import { organizationJsonLd } from "@/lib/seo";
import { site, team, type Member } from "@/lib/site";
import { getMappedWorks, getRealizedWorks } from "@/lib/works";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  const mapped = getMappedWorks();
  const realized = getRealizedWorks();

  return (
    <>
      <JsonLd data={organizationJsonLd()} />

      <section className="relative overflow-hidden">
        {/* Тихий ореол за заголовком — как подсветка вокруг льда ночью. */}
        <div className="glow -left-32 -top-24 h-[40rem] w-[52rem]" />

        <div className="relative mx-auto max-w-7xl px-5 pb-14 pt-20 sm:px-8 sm:pb-20 sm:pt-28">
          {/*
            Надзаголовок входит в h1: так ключевая фраза «ледовые скульптуры
            в Красноярске» попадает в главный заголовок страницы, а визуально
            всё остаётся как было. Вторая строка сдвинута вправо — лесенка.
          */}
          <h1 className="text-6xl leading-[0.95] text-frost-50 sm:text-8xl">
            <span className="eyebrow mb-6 block leading-normal">
              {site.tagline} в Красноярске
            </span>
            <span className="block">Лёд держит форму</span>
            <span className="block sm:pl-[16%]">ровно одну зиму</span>
          </h1>

          <div className="mt-10 flex flex-wrap items-end justify-between gap-x-10 gap-y-8 sm:pl-[16%]">
            <p className="max-w-md text-lg leading-relaxed text-frost-400">
              Скульптура из натурального льда и праздничное оформление для
              ресторанов, магазинов и городских площадок Красноярского края. {site.season}.
            </p>

            <div className="flex flex-wrap items-baseline gap-x-10 gap-y-4">
              <Link href="/works" className="action">
                Работы
                <span aria-hidden="true">→</span>
              </Link>
              <Link href="#contacts" className="action action-quiet">
                Контакты
              </Link>
            </div>
          </div>
        </div>
      </section>

      <MapSection works={mapped} />

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
        <SectionHead index="01" label="Работы" title="Что уже стоит">
          <Link href="/works" className="action action-quiet text-sm">
            Все работы
            <span aria-hidden="true">→</span>
          </Link>
        </SectionHead>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {realized.map((work) => (
            <WorkCard key={work.slug} work={work} />
          ))}
        </div>
      </section>

      <section id="about" className="scroll-mt-20 border-y hairline bg-ink-900">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
          <SectionHead index="02" label="О нас" title="Кто делает «Форму»" />
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-frost-400">
            Художники и технические специалисты, которых мы собираем под каждый
            проект, — и ответственность за весь путь от идеи до готового объекта.
          </p>

          <div className="mt-14 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((member) => (
              <MemberCard key={member.name} member={member} />
            ))}
          </div>
        </div>
      </section>

      <section id="contacts" className="scroll-mt-20">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
          <SectionHead index="03" label="Контакты" title="Напишите или позвоните" />
          <p className="mt-6 max-w-md text-lg leading-relaxed text-frost-400">
            Обсуждаем идею, площадку и даты. Лучше в октябре: с середины ноября
            графики монтажа уже заполнены.
          </p>

          <dl className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2">
            <ContactItem
              label="Телефон"
              value={site.contacts.phone.label}
              href={site.contacts.phone.href}
            />
            <ContactItem
              label="Почта"
              value={site.contacts.email.label}
              href={site.contacts.email.href}
            />
          </dl>

          <p className="mt-14 text-sm text-frost-500">
            {site.cities.join(", ")}. В другие города — по договорённости.
          </p>
        </div>
      </section>
    </>
  );
}

/** Заголовок секции с порядковым номером — ориентир при прокрутке. */
function SectionHead({
  index,
  label,
  title,
  children,
}: {
  index: string;
  label: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">
          <span className="text-glacier-400">{index}</span> — {label}
        </p>
        <h2 className="mt-4 text-4xl text-frost-50 sm:text-5xl">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function MemberCard({ member }: { member: Member }) {
  return (
    <article>
      <div className="relative aspect-[3/4] overflow-hidden bg-ink-800">
        <Image
          src={member.photo.src}
          alt={`${member.name} — ${member.role.toLowerCase()}, коллектив «${site.name}»`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
          className="object-cover grayscale"
          style={{ objectPosition: member.photo.position }}
        />
      </div>

      <div className="mt-6">
        <h3 className="text-3xl text-frost-50">{member.name}</h3>
        <p className="eyebrow mt-2 text-glacier-300">{member.role}</p>
        <p className="mt-5 text-sm leading-relaxed text-frost-300">{member.bio}</p>
        <p className="mt-5 font-mono text-xs uppercase tracking-[0.06em] text-frost-500">
          {member.facts.join(" · ")}
        </p>
      </div>
    </article>
  );
}

function ContactItem({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <div className="border-t hairline pt-5">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-3">
        <a
          href={href}
          className="font-display text-3xl tracking-[0.01em] text-frost-50 transition-colors hover:text-glacier-300 sm:text-4xl"
        >
          {value}
        </a>
      </dd>
    </div>
  );
}
