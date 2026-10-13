"use client";

import Image from "next/image";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { Media } from "@/lib/works";

/**
 * Полноэкранный просмотр фотографий работы. Провайдер держит список кадров,
 * а LightboxTrigger оборачивает уже отрендеренное на сервере изображение —
 * так WorkContent остаётся серверным компонентом.
 */

const ZOOM = 2.5;
const SWIPE_THRESHOLD = 50;

const LightboxContext = createContext<((index: number) => void) | null>(null);

export function LightboxProvider({
  media,
  children,
}: {
  media: Media[];
  children: React.ReactNode;
}) {
  const [index, setIndex] = useState<number | null>(null);

  return (
    <LightboxContext.Provider value={setIndex}>
      {children}
      {index !== null &&
        createPortal(
          <Lightbox
            media={media}
            index={index}
            onIndexChange={setIndex}
            onClose={() => setIndex(null)}
          />,
          document.body,
        )}
    </LightboxContext.Provider>
  );
}

export function LightboxTrigger({
  index,
  label,
  className,
  children,
}: {
  index: number;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const open = useContext(LightboxContext);

  return (
    <button
      type="button"
      onClick={() => open?.(index)}
      aria-label={`Открыть фото: ${label}`}
      className={`group block w-full cursor-zoom-in ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

function Lightbox({
  media,
  index,
  onIndexChange,
  onClose,
}: {
  media: Media[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const item = media[index];
  const count = media.length;
  const rootRef = useRef<HTMLDivElement>(null);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  const go = useCallback(
    (delta: number) => {
      if (count < 2) return;
      setZoomed(false);
      onIndexChange((index + delta + count) % count);
    },
    [count, index, onIndexChange],
  );

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    rootRef.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    // Слушаем на window в фазе захвата и гасим событие: иначе Escape и Tab
    // долетят до RouteModal под нами и закроют всю карточку работы.
    function onKeyDown(event: KeyboardEvent) {
      event.stopPropagation();

      if (event.key === "Escape") {
        event.preventDefault();
        if (zoomed) setZoomed(false);
        else onClose();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      } else if (event.key === "Tab") {
        const focusables = rootRef.current?.querySelectorAll<HTMLElement>("button");
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
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [go, onClose, zoomed]);

  // Соседние кадры подгружаем заранее, чтобы листание было мгновенным.
  const neighbours =
    count > 1 ? [media[(index + 1) % count], media[(index - 1 + count) % count]] : [];

  function originFrom(event: React.PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    return `${Math.min(100, Math.max(0, x))}% ${Math.min(100, Math.max(0, y))}%`;
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pointerStart.current = { x: event.clientX, y: event.clientY };
    moved.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = pointerStart.current;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) {
      moved.current = true;
    }
    // Увеличенный кадр «осматриваем»: точка увеличения следует за курсором/пальцем.
    if (zoomed && (event.pointerType === "mouse" || start)) {
      setOrigin(originFrom(event));
    }
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;

    if (!zoomed && moved.current) {
      if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
      return;
    }
    if (moved.current) return;

    if (!zoomed) setOrigin(originFrom(event));
    setZoomed((value) => !value);
  }

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={item.alt}
      tabIndex={-1}
      className="fixed inset-0 z-[60] flex flex-col bg-ink-950/95 outline-none backdrop-blur-sm"
    >
      <div className="relative z-10 flex items-center justify-between px-5 py-4 text-sm text-frost-400 sm:px-8">
        <span className="eyebrow tabular-nums">
          {count > 1 ? `${index + 1} / ${count}` : ""}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-lg leading-none text-frost-400 transition-colors hover:text-frost-50"
        >
          <span aria-hidden="true">✕</span>
          <span className="sr-only">Закрыть</span>
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        {/* Клик по пустому полю вокруг кадра закрывает просмотр. */}
        <button
          type="button"
          aria-label="Закрыть"
          tabIndex={-1}
          onClick={onClose}
          className="absolute inset-0 h-full w-full cursor-default"
        />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden px-0 pb-4 sm:px-20 sm:pb-8">
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (pointerStart.current = null)}
            className={`pointer-events-auto relative h-full w-full touch-none select-none ${
              zoomed ? "cursor-zoom-out" : "cursor-zoom-in"
            }`}
            style={{ maxWidth: `calc((100dvh - 8rem) * ${item.width / item.height})` }}
          >
            <Image
              key={item.src}
              src={item.src}
              alt={item.alt}
              fill
              sizes="100vw"
              draggable={false}
              className="object-contain transition-transform duration-300 ease-out"
              style={{ transform: zoomed ? `scale(${ZOOM})` : "none", transformOrigin: origin }}
            />
          </div>
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 hidden -translate-y-1/2 p-4 text-2xl text-frost-400 transition-colors hover:text-frost-50 sm:block"
            >
              <span aria-hidden="true">←</span>
              <span className="sr-only">Предыдущее фото</span>
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 hidden -translate-y-1/2 p-4 text-2xl text-frost-400 transition-colors hover:text-frost-50 sm:block"
            >
              <span aria-hidden="true">→</span>
              <span className="sr-only">Следующее фото</span>
            </button>
          </>
        )}
      </div>

      <div className="hidden" aria-hidden="true">
        {neighbours.map((neighbour) => (
          <Image
            key={neighbour.src}
            src={neighbour.src}
            alt=""
            width={neighbour.width}
            height={neighbour.height}
            sizes="100vw"
            loading="eager"
          />
        ))}
      </div>
    </div>
  );
}
