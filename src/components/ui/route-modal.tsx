"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

/**
 * Модалка перехваченного роута. URL уже сменился на /works/[slug], поэтому
 * закрытие — это router.back(): пользователь возвращается в галерею, а прямой
 * заход на тот же адрес отдаёт полную страницу и модалку не показывает.
 */
export function RouteModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => router.back(), [router]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== "Tab") return;

      // Фокус-трап: внутри модалки Tab не должен уводить на страницу под ней.
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, [close]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex justify-center overflow-y-auto overscroll-contain bg-ink-950/80 p-0 backdrop-blur-sm sm:p-6"
    >
      {/* Клик по фону закрывает; кнопка, а не div — чтобы работала с клавиатуры. */}
      <button
        type="button"
        aria-label="Закрыть"
        onClick={close}
        className="fixed inset-0 h-full w-full cursor-default"
        tabIndex={-1}
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className="surface-blur relative z-10 my-0 h-fit w-full max-w-4xl px-5 pb-12 pt-16 outline-none sm:my-auto sm:px-12"
      >
        <button
          type="button"
          onClick={close}
          className="absolute right-5 top-5 text-lg leading-none text-frost-400 transition-colors hover:text-frost-50"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ✕
          </span>
          <span className="sr-only">Закрыть</span>
        </button>

        {children}
      </div>
    </div>
  );
}
