import worksData from "@/data/works.json";

/**
 * Единственная точка доступа к проектам. Сейчас данные лежат в локальном JSON;
 * когда появится бекенд, меняется только этот файл — компоненты его не замечают.
 */

export type WorkStatus = "realized" | "concept";

export type Media = {
  type: "image" | "video";
  src: string;
  alt: string;
  width: number;
  height: number;
  poster?: string;
};

export type Spec = {
  label: string;
  value: string;
};

export type Work = {
  slug: string;
  title: string;
  status: WorkStatus;
  /** Город есть только у реализованных работ — он же подпись маркера на карте. */
  city?: string;
  venue?: string;
  /** [долгота, широта] — порядок как в GeoJSON, чтобы проекция принимала их как есть. */
  coords?: [number, number];
  year?: number;
  excerpt: string;
  description: string[];
  specs: Spec[];
  award?: string;
  client?: string;
  /** null у концепций, для которых ещё нет визуализаций. */
  cover: Media | null;
  media: Media[];
};

/** Реализованная работа с координатами — то, что попадает на карту. */
export type MappedWork = Work & {
  city: string;
  coords: [number, number];
};

const works = worksData as Work[];

export function getAllWorks(): Work[] {
  return works;
}

export function getWorkBySlug(slug: string): Work | undefined {
  return works.find((work) => work.slug === slug);
}

export function getRealizedWorks(): Work[] {
  return works.filter((work) => work.status === "realized");
}

export function getConceptWorks(): Work[] {
  return works.filter((work) => work.status === "concept");
}

/**
 * Работы для карты. Координаты обязательны: работа без них просто не отрисуется,
 * поэтому отсекаем их здесь, а не в компоненте сцены.
 */
export function getMappedWorks(): MappedWork[] {
  return works.filter(
    (work): work is MappedWork =>
      work.status === "realized" && Array.isArray(work.coords) && Boolean(work.city),
  );
}

export const STATUS_LABELS: Record<WorkStatus, string> = {
  realized: "Реализовано",
  concept: "Концепция",
};

/** Подпись под заголовком карточки: «Красноярск, 2025» / «Концепция». */
export function workMeta(work: Work): string {
  const parts = [work.city, work.year ? String(work.year) : null].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : STATUS_LABELS[work.status];
}
