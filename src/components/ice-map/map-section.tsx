"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MappedWork } from "@/lib/works";
import type { Cluster } from "./projection";
import type { MapView, ScreenPoint } from "./ice-map-scene";

/** WebGL-сцена не умеет рендериться на сервере — грузим её только в браузере. */
const IceMapScene = dynamic(
  () => import("./ice-map-scene").then((mod) => mod.IceMapScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-frost-500">Загружаем карту…</p>
      </div>
    ),
  },
);

export function MapSection({ works }: { works: MappedWork[] }) {
  const [view, setView] = useState<MapView>("region");
  const [selected, setSelected] = useState<Cluster | null>(null);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  /** Точка выбрана, но камера ещё летит к ней — карточки пока нет. */
  const [pending, setPending] = useState<Cluster | null>(null);
  /**
   * Позиция карточки снимается один раз, когда камера уже встала. Если бы
   * карточка ехала за точкой каждый кадр, она дёргалась бы вместе с картой.
   */
  const [anchor, setAnchor] = useState<ScreenPoint | null>(null);

  const pendingRef = useRef<Cluster | null>(null);

  const handleSelect = useCallback((cluster: Cluster) => {
    setSelected(null);
    setAnchor(null);
    setPending(cluster);
    pendingRef.current = cluster;
    setFocus([cluster.x, cluster.z]);
  }, []);

  /** Вторая фаза: камера встала — показываем карточку там, где метка сейчас. */
  const handleSettled = useCallback((point: ScreenPoint | null) => {
    const cluster = pendingRef.current;
    if (!cluster) return;

    pendingRef.current = null;

    // Небольшая пауза отделяет приближение от появления карточки.
    window.setTimeout(() => {
      setAnchor(point);
      setSelected(cluster);
      setPending(null);
    }, 200);
  }, []);

  const clear = useCallback(() => {
    pendingRef.current = null;
    setPending(null);
    setSelected(null);
    setAnchor(null);
  }, []);

  const changeView = useCallback(
    (next: MapView) => {
      setView(next);
      // Общий план важнее выбранной точки — иначе камера осталась бы у неё.
      setFocus(null);
      clear();
    },
    [clear],
  );

  const close = useCallback(() => {
    clear();
    setFocus(null);
  }, [clear]);

  const highlightedId = selected?.id ?? pending?.id ?? null;

  /**
   * Пока карта за пределами экрана, сцена не рендерится вовсе. Иначе WebGL
   * продолжает считать кадры всю прокрутку страницы и отъедает её плавность.
   */
  const frameRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="relative">
      <div
        ref={frameRef}
        className="map-canvas relative h-[72vh] min-h-[460px] w-full overflow-hidden border-y border-white/5 bg-ink-950"
      >
        <IceMapScene
          works={works}
          view={view}
          onSelect={handleSelect}
          active={active}
          focus={focus}
          selectedId={highlightedId}
          onSettled={handleSettled}
          onInteract={clear}
        />

        {/* Затемнение сверху: под ним надпись читается поверх светлой плиты. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-ink-950 via-ink-950/85 to-transparent" />

        {/*
          Надпись и переключатель лежат в той же сетке, что и остальные секции
          страницы, и прижаты к её правому краю — иначе они висели бы у края
          окна и выпадали из общей колонки.
        */}
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="mx-auto flex h-full max-w-7xl flex-col justify-between px-5 py-6 sm:px-8">
            <div className="ml-auto max-w-[16rem] text-right">
              <p className="eyebrow">География</p>
              <p className="mt-3 text-sm leading-relaxed text-frost-400">
                Города, где стоят скульптуры. Нажмите на метку.
              </p>
            </div>

            <div className="pointer-events-auto ml-auto flex gap-7">
              <ViewButton
                active={view === "region"}
                onClick={() => changeView("region")}
              >
                Красноярский край
              </ViewButton>
              <ViewButton
                active={view === "country"}
                onClick={() => changeView("country")}
              >
                Вся Россия
              </ViewButton>
            </div>
          </div>
        </div>

        {selected && (
          <ClusterPreview cluster={selected} anchor={anchor} onClose={close} />
        )}
      </div>
    </section>
  );
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="switch"
    >
      {children}
    </button>
  );
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * Превью поверх карты. URL оно не меняет — именно поэтому карточка внутри может
 * быть ссылкой: клик по ней уводит на полную страницу проекта.
 *
 * Карточка держится за свою точку и раскрывается из неё: так видно, какой
 * именно маркер открыт. На узком экране места для этого нет — там она
 * привычной панелью снизу.
 */
function ClusterPreview({
  cluster,
  anchor,
  onClose,
}: {
  cluster: Cluster;
  anchor: { x: number; y: number } | null;
  onClose: () => void;
}) {
  // Точка справа — раскрываем карточку влево, иначе она уедет за край карты.
  const flip = (anchor?.x ?? 0) > 55;

  const style = anchor
    ? ({
        "--anchor-x": `${clamp(anchor.x, 4, 96)}%`,
        // Нижняя граница держит карточку из-под липкой шапки страницы.
        "--anchor-y": `${clamp(anchor.y, 22, 72)}%`,
      } as React.CSSProperties)
    : undefined;

  return (
    <div
      style={style}
      className={`absolute inset-x-0 bottom-0 z-20 p-4 sm:inset-x-auto sm:bottom-auto sm:w-80 sm:p-0 ${
        anchor
          ? "sm:left-[var(--anchor-x)] sm:top-[var(--anchor-y)]"
          : "sm:right-6 sm:top-24"
      } ${
        anchor && flip
          ? "sm:-translate-x-[calc(100%+1.75rem)] sm:-translate-y-1/2"
          : anchor
            ? "sm:translate-x-7 sm:-translate-y-1/2"
            : ""
      }`}
    >
      {anchor && (
        <span
          aria-hidden="true"
          className={`map-preview-line absolute top-1/2 hidden h-px w-7 bg-gradient-to-r from-glacier-400/80 to-glacier-400/10 sm:block ${
            flip ? "-right-7 origin-right" : "-left-7 origin-left"
          }`}
        />
      )}

      <div
        key={cluster.id}
        className={`map-preview surface-blur p-5 ${
          flip ? "origin-right" : "origin-left"
        }`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <p className="eyebrow pt-1">
            {cluster.works.length > 1
              ? `${cluster.works.length} проекта`
              : cluster.works[0].city}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="-mt-1 shrink-0 text-sm leading-none text-frost-400 transition-colors hover:text-frost-50"
          >
            <span aria-hidden="true">✕</span>
            <span className="sr-only">Закрыть</span>
          </button>
        </div>

        <div className="space-y-2">
          {cluster.works.map((work, index) => (
            <PreviewCard key={work.slug} work={work} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PreviewCard({ work, index }: { work: MappedWork; index: number }) {
  return (
    <Link
      href={`/works/${work.slug}`}
      // Работы проявляются следом за самой карточкой, одна за другой.
      style={{ animationDelay: `${140 + index * 90}ms` }}
      className="map-preview-item group flex gap-4 border-t hairline pt-4 transition-colors"
    >
      {work.cover && (
        <div className="relative h-20 w-16 shrink-0 overflow-hidden bg-ink-800">
          <Image
            src={work.cover.src}
            alt=""
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="font-display text-lg uppercase leading-snug text-frost-50">
          {work.title}
        </p>
        <p className="mt-0.5 text-xs text-frost-500">
          {[work.city, work.year].filter(Boolean).join(", ")}
        </p>
        <p className="mt-2 text-xs text-glacier-400 opacity-0 transition-opacity group-hover:opacity-100">
          Смотреть проект →
        </p>
      </div>
    </Link>
  );
}
