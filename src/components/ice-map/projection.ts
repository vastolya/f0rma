import {
  geoAlbers,
  type GeoPermissibleObjects,
  type GeoProjection,
} from "d3-geo";
import type { MappedWork } from "@/lib/works";

export type RussiaGeometry = {
  type: "MultiPolygon";
  coordinates: [number, number][][][];
};

/** Полуширина плиты в мировых единицах Three. */
const HALF_WIDTH = 60;

/**
 * Коническая равновеликая проекция, стандартная для России. Поворот на 105° E
 * нужен не только для вида: без него Чукотка, уходящая за 180-й меридиан,
 * растягивает страну на весь мир.
 */
export function buildProjection(geo: RussiaGeometry): GeoProjection {
  return geoAlbers()
    .rotate([-105, 0])
    .center([-10, 65])
    .parallels([52, 64])
    .fitExtent(
      [
        [-HALF_WIDTH, -HALF_WIDTH / 2],
        [HALF_WIDTH, HALF_WIDTH / 2],
      ],
      geo as unknown as GeoPermissibleObjects,
    );
}

/** Точка на верхней грани плиты: экранный Y проекции становится мировым Z. */
export function project(
  projection: GeoProjection,
  coords: [number, number],
): [number, number] | null {
  const point = projection(coords);
  return point ? [point[0], point[1]] : null;
}

export type Cluster = {
  id: string;
  x: number;
  z: number;
  works: MappedWork[];
  label: string;
};

/**
 * Красноярск и Дивногорск разделяют 30 км — в масштабе страны это доли мировой
 * единицы, и маркеры сливаются в одно пятно. Поэтому близкие точки объединяем
 * в кластер, который по клику показывает список работ.
 */
export function clusterWorks(
  projection: GeoProjection,
  works: MappedWork[],
  threshold = 1.2,
): Cluster[] {
  const clusters: Cluster[] = [];

  for (const work of works) {
    const point = project(projection, work.coords);
    if (!point) continue;

    const [x, z] = point;
    const near = clusters.find(
      (cluster) => Math.hypot(cluster.x - x, cluster.z - z) < threshold,
    );

    if (near) {
      near.works.push(work);
      // Центр кластера — среднее его точек, иначе маркер липнет к первой работе.
      near.x = (near.x * (near.works.length - 1) + x) / near.works.length;
      near.z = (near.z * (near.works.length - 1) + z) / near.works.length;
    } else {
      clusters.push({ id: work.slug, x, z, works: [work], label: work.city });
    }
  }

  // Подпись кластера короткая: полный перечень городов перекрывал соседние точки.
  return clusters.map((cluster) => ({
    ...cluster,
    label:
      cluster.works.length === 1
        ? cluster.works[0].city
        : `${cluster.works[0].city} +${cluster.works.length - 1}`,
  }));
}
