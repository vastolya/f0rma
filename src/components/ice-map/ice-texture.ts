import * as THREE from "three";

/**
 * Фактура льда генерируется прямо в браузере: нужен мелкий нерегулярный рельеф
 * с прожилками, и тащить ради него растровый файл не стоит — шум занимает
 * пару килобайт кода вместо сотен килобайт картинки.
 */

/** Детерминированный генератор: фактура не должна меняться между рендерами. */
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function createHeightField(size: number) {
  const random = createRandom(20260107);
  const field = new Float32Array(size * size);

  // Несколько октав пятен — крупные дают разводы, мелкие зернистость.
  for (const [count, radius, weight] of [
    [90, size * 0.22, 0.55],
    [260, size * 0.09, 0.3],
    [900, size * 0.03, 0.15],
  ] as const) {
    for (let i = 0; i < count; i += 1) {
      const cx = random() * size;
      const cy = random() * size;
      const r = radius * (0.5 + random());
      const amplitude = (random() - 0.5) * 2 * weight;
      const minX = Math.floor(cx - r);
      const maxX = Math.ceil(cx + r);
      const minY = Math.floor(cy - r);
      const maxY = Math.ceil(cy + r);

      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const dx = x - cx;
          const dy = y - cy;
          const distance = Math.hypot(dx, dy);
          if (distance > r) continue;

          // Плавный спад к краю пятна, чтобы не было видно окружностей.
          const falloff = 0.5 + 0.5 * Math.cos((distance / r) * Math.PI);
          // Заворачиваем координаты — текстура должна быть бесшовной.
          const wx = ((x % size) + size) % size;
          const wy = ((y % size) + size) % size;
          field[wy * size + wx] += amplitude * falloff * falloff;
        }
      }
    }
  }

  // Трещины: тонкие тёмные росчерки поверх разводов.
  for (let i = 0; i < 70; i += 1) {
    let x = random() * size;
    let y = random() * size;
    let angle = random() * Math.PI * 2;
    const length = size * (0.15 + random() * 0.5);
    const depth = 0.35 + random() * 0.4;

    for (let step = 0; step < length; step += 1) {
      angle += (random() - 0.5) * 0.25;
      x += Math.cos(angle);
      y += Math.sin(angle);
      const wx = ((Math.round(x) % size) + size) % size;
      const wy = ((Math.round(y) % size) + size) % size;
      field[wy * size + wx] -= depth * (1 - step / length);
    }
  }

  return field;
}

function toTexture(canvas: HTMLCanvasElement, repeat: number) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 4;
  return texture;
}

export type IceTextures = {
  roughness: THREE.Texture;
  normal: THREE.Texture;
  dispose: () => void;
};

export function createIceTextures(size = 512, repeat = 6): IceTextures {
  const field = createHeightField(size);

  // Шероховатость: изморозь матовая везде, выступы лишь чуть глаже впадин —
  // иначе гладкие участки ловят свет зеркальными бликами.
  const roughnessCanvas = document.createElement("canvas");
  roughnessCanvas.width = size;
  roughnessCanvas.height = size;
  const roughnessCtx = roughnessCanvas.getContext("2d")!;
  const roughnessData = roughnessCtx.createImageData(size, size);

  for (let i = 0; i < field.length; i += 1) {
    const value = Math.max(0.62, Math.min(1, 0.84 - field[i] * 0.18));
    const channel = Math.round(value * 255);
    roughnessData.data[i * 4] = channel;
    roughnessData.data[i * 4 + 1] = channel;
    roughnessData.data[i * 4 + 2] = channel;
    roughnessData.data[i * 4 + 3] = 255;
  }
  roughnessCtx.putImageData(roughnessData, 0, 0);

  // Нормали считаем из того же поля высот разностью соседних отсчётов.
  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = size;
  normalCanvas.height = size;
  const normalCtx = normalCanvas.getContext("2d")!;
  const normalData = normalCtx.createImageData(size, size);
  const strength = 1.3;

  const at = (x: number, y: number) =>
    field[(((y % size) + size) % size) * size + (((x % size) + size) % size)];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (at(x - 1, y) - at(x + 1, y)) * strength;
      const dy = (at(x, y - 1) - at(x, y + 1)) * strength;
      const length = Math.hypot(dx, dy, 1);
      const index = (y * size + x) * 4;
      normalData.data[index] = Math.round(((dx / length) * 0.5 + 0.5) * 255);
      normalData.data[index + 1] = Math.round(((dy / length) * 0.5 + 0.5) * 255);
      normalData.data[index + 2] = Math.round((1 / length) * 255);
      normalData.data[index + 3] = 255;
    }
  }
  normalCtx.putImageData(normalData, 0, 0);

  const roughness = toTexture(roughnessCanvas, repeat);
  const normal = toTexture(normalCanvas, repeat);

  return {
    roughness,
    normal,
    dispose: () => {
      roughness.dispose();
      normal.dispose();
    },
  };
}
