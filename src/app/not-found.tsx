import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Страница не найдена",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
      <p className="eyebrow">Ошибка 404</p>
      <h1 className="mt-6 text-5xl leading-[0.95] text-frost-50 sm:text-7xl">
        <span className="block">Эта скульптура</span>
        <span className="block sm:pl-[16%]">уже растаяла</span>
      </h1>
      <p className="mt-8 max-w-md text-lg leading-relaxed text-frost-400">
        Такой страницы нет. Посмотрите работы или вернитесь на главную.
      </p>
      <div className="mt-12 flex flex-wrap items-baseline gap-x-10 gap-y-4">
        <Link href="/works" className="action">
          Работы
          <span aria-hidden="true">→</span>
        </Link>
        <Link href="/" className="action action-quiet">
          На главную
        </Link>
      </div>
    </section>
  );
}
