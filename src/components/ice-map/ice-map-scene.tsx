"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import * as THREE from "three";
import type { MappedWork } from "@/lib/works";
import {
  buildProjection,
  clusterWorks,
  type Cluster,
  type RussiaGeometry,
} from "./projection";
import { createIceTextures } from "./ice-texture";

const SLAB_DEPTH = 2.4;
const MARKER_Y = SLAB_DEPTH + 0.05;

/** Насколько курсор доворачивает камеру от края до края блока, в радианах. */
const POINTER_YAW = 0.2;
const POINTER_PITCH = 0.1;

const CUBE_MODEL = "/models/ice-cube.glb";
/** Желаемый размер метки по наибольшей стороне, в единицах сцены. */
const CUBE_SIZE = 1.9;
const TMP_SCALE = new THREE.Vector3();

/** Сколько секунд волна внимания задерживается на одной метке. */
const SPOTLIGHT_STEP = 2.6;
const COLOR_IDLE = new THREE.Color("#2d6f90");
const COLOR_FOCUS = new THREE.Color("#8fe4ff");
const COLOR_LIT = new THREE.Color("#cfe9ff");

export type MapView = "region" | "country";

/** Экранная позиция метки в процентах от размеров канвы. */
export type ScreenPoint = { x: number; y: number };

type SceneProps = {
  works: MappedWork[];
  view: MapView;
  onSelect: (cluster: Cluster) => void;
  /** Карта в зоне видимости. Вне её кадры не считаются вовсе. */
  active: boolean;
  /** Точка, к которой камера подлетает после клика: [x, z] в мире сцены. */
  focus: [number, number] | null;
  selectedId: string | null;
  /**
   * Перелёт закончился — можно показывать карточку. Экранные координаты точки
   * сцена считает сама и отдаёт один раз: держать их в состоянии и обновлять
   * каждый кадр было бы напрасной работой.
   */
  onSettled: (point: ScreenPoint | null) => void;
  /** Пользователь щёлкнул мимо меток — карточку пора убрать. */
  onInteract: () => void;
};

export function IceMapScene(props: SceneProps) {
  const [geo, setGeo] = useState<RussiaGeometry | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/geo/russia.json")
      .then((response) => response.json())
      .then((data: RussiaGeometry) => {
        if (!cancelled) setGeo(data);
      })
      .catch(() => {
        /* Карта необязательна: под ней всегда есть текстовый список городов. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Canvas
      frameloop={props.active ? "always" : "never"}
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 60, 70], fov: 38, near: 0.1, far: 500 }}
      // Клик мимо маркеров закрывает карточку — как щелчок по пустому месту.
      onPointerMissed={props.onInteract}
    >
      <color attach="background" args={["#04070c"]} />
      <fog attach="fog" args={["#04070c", 90, 220]} />

      <ambientLight intensity={0.4} />
      <directionalLight position={[-30, 50, 20]} intensity={1.2} color="#cfe9ff" />
      <AuroraLights />

      {/* Окружение собрано из Lightformer'ов, а не из HDR-файла: прозрачному
          материалу нужны отражения, но тянуть карту с CDN ради них не стоит. */}
      <Environment resolution={256}>
        <Lightformer
          intensity={2.2}
          position={[0, 20, -20]}
          scale={[30, 12, 1]}
          color="#9fe3ff"
        />
        <Lightformer
          intensity={1.4}
          position={[-20, 10, 15]}
          scale={[18, 8, 1]}
          color="#ffb3b3"
        />
        <Lightformer
          intensity={1}
          position={[20, 8, 10]}
          scale={[14, 6, 1]}
          color="#ffffff"
        />
      </Environment>

      {/* Модель метки грузится асинхронно — до неё сцена показывает плиту. */}
      <Suspense fallback={null}>
        {geo && <MapBody geo={geo} {...props} />}
      </Suspense>

      <CameraRig
        view={props.view}
        focus={props.focus}
        onSettled={props.onSettled}
      />
    </Canvas>
  );
}

function MapBody({
  geo,
  works,
  onSelect,
  selectedId,
}: SceneProps & { geo: RussiaGeometry }) {
  const projection = useMemo(() => buildProjection(geo), [geo]);

  const geometry = useMemo(() => {
    const shapes: THREE.Shape[] = [];

    for (const polygon of geo.coordinates) {
      const [outer, ...holes] = polygon;
      const shape = ringToShape(outer, projection);
      if (!shape) continue;

      for (const hole of holes) {
        const path = ringToShape(hole, projection);
        if (path) shape.holes.push(path);
      }

      shapes.push(shape);
    }

    /*
      Нормали оставляем те, что построил ExtrudeGeometry. computeVertexNormals
      усредняет их по общим вершинам и сглаживает рёбра, которые у плиты должны
      быть острыми, — отсюда брались вертикальные полосы по всей кромке.
    */
    return new THREE.ExtrudeGeometry(shapes, {
      depth: SLAB_DEPTH,
      bevelEnabled: true,
      bevelThickness: 0.22,
      bevelSize: 0.18,
      bevelSegments: 1,
      curveSegments: 1,
    });
  }, [geo, projection]);

  /**
   * Контур берега отдельными линиями. Wireframe по экструзии рисовал бы ещё и
   * рёбра триангуляции — через всю страну тянулась паутина.
   */
  const outline = useMemo(() => {
    const positions: number[] = [];

    for (const polygon of geo.coordinates) {
      for (const ring of polygon) {
        const points = ring
          .map((coords) => projection(coords))
          .filter((point): point is [number, number] => Boolean(point));

        for (let i = 0; i < points.length - 1; i += 1) {
          positions.push(points[i][0], SLAB_DEPTH + 0.03, points[i][1]);
          positions.push(points[i + 1][0], SLAB_DEPTH + 0.03, points[i + 1][1]);
        }
      }
    }

    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    return buffer;
  }, [geo, projection]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => outline.dispose(), [outline]);

  const clusters = useMemo(
    () => clusterWorks(projection, works),
    [projection, works],
  );

  const compact = useThree((state) => state.size.width) < 768;

  const ice = useMemo(() => createIceTextures(), []);
  useEffect(() => ice.dispose, [ice]);

  return (
    <group>
      {/* Плита лежит в плоскости XZ: shape строится в XY и кладётся поворотом. */}
      <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        {/*
          Лёд матовый, «морозный»: шероховатость задаёт текстура, лака нет.
          Глянцевая плита отражала каждый источник резким пятном.

          transmission заставляет three перерисовывать сцену в отдельный буфер
          каждый кадр. На узких экранах это главный источник просадок, поэтому
          там берём обычный полупрозрачный материал.
        */}
        {compact ? (
          <meshStandardMaterial
            color="#a8cfe6"
            roughness={1}
            metalness={0}
            roughnessMap={ice.roughness}
            normalMap={ice.normal}
            normalScale={new THREE.Vector2(0.3, 0.3)}
            transparent
            opacity={0.9}
            envMapIntensity={0.6}
          />
        ) : (
          <meshPhysicalMaterial
            color="#bcdcef"
            roughness={1}
            metalness={0}
            roughnessMap={ice.roughness}
            normalMap={ice.normal}
            normalScale={new THREE.Vector2(0.35, 0.35)}
            transmission={0.78}
            thickness={5}
            ior={1.31}
            attenuationColor="#3f9ed4"
            attenuationDistance={14}
            specularIntensity={0.35}
            envMapIntensity={0.7}
          />
        )}
      </mesh>

      {/* Контур поверху — без него экструзия читается как бесформенное пятно. */}
      <lineSegments geometry={outline}>
        <lineBasicMaterial color="#9fe3ff" transparent opacity={0.5} />
      </lineSegments>

      {clusters.map((cluster, index) => (
        <IceCrystal
          key={cluster.id}
          cluster={cluster}
          index={index}
          total={clusters.length}
          selected={cluster.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

/**
 * Готовит экземпляр ледяного куба из модели.
 *
 * Модель приходит в своих единицах и со своей привязкой — у этой габарит около
 * трёх сотых единицы, а начало координат лежит в основании. Поэтому вместо
 * подобранного на глаз множителя считаем габарит и центр по факту: модель можно
 * будет заменить на другую, ничего здесь не трогая.
 *
 * Материал подменяем своим: он должен выглядеть как остальной лёд на карте и
 * слушаться анимации свечения.
 */
function useIceCube() {
  const { scene } = useGLTF(CUBE_MODEL);

  const instance = useMemo(() => {
    const model = scene.clone(true);

    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());

    const material = new THREE.MeshPhysicalMaterial({
      color: "#bfe6f8",
      roughness: 0.12,
      metalness: 0,
      transmission: 0.65,
      thickness: 0.8,
      ior: 1.31,
      transparent: true,
      opacity: 0.95,
      emissive: new THREE.Color("#2d6f90"),
      emissiveIntensity: 0.25,
      envMapIntensity: 1.6,
    });

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = material;
      }
    });

    // Центрируем модель в собственной группе, чтобы она крутилась вокруг себя.
    model.position.sub(center);

    const holder = new THREE.Group();
    holder.add(model);
    holder.scale.setScalar(CUBE_SIZE / Math.max(size.x, size.y, size.z));

    return { holder, material };
  }, [scene]);

  useEffect(() => () => instance.material.dispose(), [instance]);

  return instance;
}

useGLTF.preload(CUBE_MODEL);

/**
 * Метка проекта — объём, а не точка с подписью. Текстовые ярлыки висели поверх
 * канвы и пересчитывали позиции на каждом движении камеры; объект живёт внутри
 * сцены и ничего не стоит. Форма намеренно простая: сюда встанет модель
 * ледяного куба, когда она появится.
 */
function IceCrystal({
  cluster,
  index,
  total,
  selected,
  onSelect,
}: {
  cluster: Cluster;
  index: number;
  total: number;
  selected: boolean;
  onSelect: (cluster: Cluster) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const spin = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  const angle = useRef(0);
  const reducedMotion = usePrefersReducedMotion();
  const cube = useIceCube();

  // Свечение меняется покадрово, поэтому материал держим в ref.
  const glow = useRef(cube.material);
  useEffect(() => {
    glow.current = cube.material;
  }, [cube]);

  const lit = hovered || selected;

  /*
    У каждой метки свой сдвиг по времени и своя скорость. Синхронное движение
    читалось бы как индикатор загрузки; вразнобой карта выглядит обитаемой.
  */
  const phase = index * 1.9;
  const spinSpeed = 0.3 + (index % 3) * 0.08;
  const breathSpeed = 1.15 + (index % 4) * 0.12;

  useFrame((state, delta) => {
    const t = reducedMotion ? 0 : state.clock.elapsedTime;
    const local = t + phase;
    const breath = 0.5 + 0.5 * Math.sin(local * breathSpeed);

    /*
      Волна внимания обходит метки по кругу и подсвечивается только та, до
      которой она дошла. Так взгляд ведут по одной точке за раз, вместо того
      чтобы мигать всеми сразу.
    */
    const cursor = total > 0 ? (t / SPOTLIGHT_STEP) % total : 0;
    const gap = Math.abs(cursor - index);
    const wrapped = Math.min(gap, total - gap);
    const attention = reducedMotion ? 0 : Math.max(0, 1 - wrapped) ** 2;

    if (spin.current) {
      // Скорость вращения гуляет: куб то почти замирает, то проворачивается.
      const pace = 0.25 + 1.15 * (0.5 + 0.5 * Math.sin(local * 0.33));
      angle.current += delta * spinSpeed * pace;
      spin.current.rotation.y = angle.current;
      spin.current.rotation.x = Math.sin(local * 0.45) * 0.16;

      // Два несовпадающих периода — всплытие получается неравномерным.
      spin.current.position.y =
        1.9 + Math.sin(local * 0.85) * 0.34 + Math.sin(local * 0.37) * 0.16;

      const base = selected ? 1.35 : hovered ? 1.18 : 1;
      const pulse = 1 + breath * 0.06 + attention * 0.14;
      spin.current.scale.lerp(TMP_SCALE.setScalar(base * pulse), 0.15);
    }

    // Свечение дышит и разгорается, когда очередь доходит до этой метки.
    const material = glow.current;
    material.emissiveIntensity =
      (lit ? 0.5 : 0.18) + breath * 0.2 + attention * 0.9;

    material.emissive.copy(COLOR_IDLE).lerp(COLOR_FOCUS, attention);
    if (lit) material.emissive.lerp(COLOR_LIT, 0.6);

    // Круг расходится по льду и гаснет — самый заметный сигнал «нажми сюда».
    if (halo.current && !reducedMotion) {
      const cycle = (t * 0.42 + index * 0.37) % 1;
      const scale = 1 + cycle * 2.8;
      halo.current.scale.set(scale, scale, scale);
      (halo.current.material as THREE.MeshBasicMaterial).opacity =
        (selected ? 0.55 : 0.3 + attention * 0.45) * (1 - cycle);
    }
  });

  return (
    <group
      position={[cluster.x, MARKER_Y, cluster.z]}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "";
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(cluster);
      }}
    >
      {/* Мишень стоит отдельно от анимации: иначе попасть по ней было бы сложнее. */}
      <mesh visible={false} position={[0, 1.9, 0]}>
        <boxGeometry args={[3.8, 4.4, 3.8]} />
      </mesh>

      <mesh
        ref={halo}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.04, 0]}
        visible={!reducedMotion}
      >
        <ringGeometry args={[0.7, 0.82, 48]} />
        <meshBasicMaterial
          color={selected ? "#ffffff" : "#6cd0f5"}
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      <group ref={spin} position={[0, 1.9, 0]}>
        <primitive object={cube.holder} />
      </group>
    </group>
  );
}

/** Огни идут в порядке флага: белый впереди, за ним синий, замыкает красный. */
const TRAIN_LIGHTS = [
  { color: "#ffffff", intensity: 2400 },
  { color: "#3d74ff", intensity: 4000 },
  { color: "#ff3b3b", intensity: 3400 },
] as const;

/** Отставание каждого следующего огня по маршруту, в радианах. */
const TRAIN_GAP = 0.42;
const TRAIN_SPEED = 0.16;
const TRAIN_HEIGHT = 55;

/**
 * Три огня — белый, синий и красный — едут друг за другом по одному маршруту
 * над плитой. Лёд статичен сам по себе, и только движущийся свет показывает его
 * фактуру.
 *
 * Это прожекторы с полностью размытым краем, а не точечный свет: точка давала
 * на льду маленький резкий блик, а конус светит вниз большим матовым пятном.
 */
function AuroraLights() {
  const refs = useRef<(THREE.SpotLight | null)[]>([]);
  const reducedMotion = usePrefersReducedMotion();

  useFrame((state) => {
    const t = reducedMotion ? 0 : state.clock.elapsedTime * TRAIN_SPEED;

    TRAIN_LIGHTS.forEach((_, index) => {
      const node = refs.current[index];
      if (!node) return;

      // Маршрут — вытянутый эллипс над картой с лёгкой «восьмёркой» по глубине,
      // чтобы пятна проходили и по краю, и через Красноярский край.
      const angle = t - index * TRAIN_GAP;
      const x = Math.cos(angle) * 40;
      const z = Math.sin(angle) * 24 + Math.sin(angle * 2) * 6;

      node.position.set(x, TRAIN_HEIGHT, z);
      node.target.position.set(x * 0.92, 0, z * 0.92);
      node.target.updateMatrixWorld();
    });
  });

  return (
    <>
      {TRAIN_LIGHTS.map((light, index) => (
        <spotLight
          key={light.color}
          ref={(node) => {
            refs.current[index] = node;
          }}
          position={[0, TRAIN_HEIGHT, 0]}
          intensity={light.intensity}
          color={light.color}
          angle={0.78}
          penumbra={1}
          decay={1.6}
        />
      ))}
    </>
  );
}

/**
 * Камера целиком под управлением кода — орбитальных контролов нет.
 *
 * Положение складывается из двух слоёв. Базовый ракурс задаётся выбранным видом
 * или точкой, к которой мы подлетаем, и подтягивается к цели плавным сглаживанием.
 * Поверх него курсор доворачивает камеру вокруг той же цели: карта отзывается на
 * движение мыши сама, вместо того чтобы ждать, пока её потянут.
 */
function CameraRig({
  view,
  focus,
  onSettled,
}: {
  view: MapView;
  focus: [number, number] | null;
  onSettled: (point: ScreenPoint | null) => void;
}) {
  const { camera, gl } = useThree();
  const reducedMotion = usePrefersReducedMotion();

  const desired = useMemo(() => {
    if (focus) {
      const [x, z] = focus;
      // Не вплотную: точка укрупняется, но вокруг неё остаётся видна страна.
      return {
        position: new THREE.Vector3(x, 29, z + 33),
        target: new THREE.Vector3(x, 0, z),
      };
    }

    if (view === "country") {
      return {
        position: new THREE.Vector3(0, 78, 86),
        target: new THREE.Vector3(0, 0, 0),
      };
    }

    // Проекты сосредоточены в Красноярском крае — камера садится туда, но так,
    // чтобы контур страны вокруг точек всё ещё читался.
    return {
      position: new THREE.Vector3(4, 40, 56),
      target: new THREE.Vector3(4, 0, 4),
    };
  }, [view, focus]);

  /** Опорный ракурс без учёта курсора: именно он догоняет desired. */
  const base = useRef({
    position: new THREE.Vector3(0, 60, 70),
    target: new THREE.Vector3(0, 0, 0),
  });

  const pointer = useRef({ x: 0, y: 0 });
  const pointerTarget = useRef({ x: 0, y: 0 });
  const flying = useRef(false);
  const startedAt = useRef(0);

  const spherical = useRef(new THREE.Spherical());
  const offset = useRef(new THREE.Vector3());
  const probe = useRef(new THREE.Vector3());

  /** Где метка оказалась на экране — в процентах от размеров канвы. */
  const projectFocus = useCallback((): ScreenPoint | null => {
    if (!focus) return null;

    camera.updateMatrixWorld();
    probe.current.set(focus[0], MARKER_Y + 1.5, focus[1]).project(camera);

    return {
      x: (probe.current.x * 0.5 + 0.5) * 100,
      y: (-probe.current.y * 0.5 + 0.5) * 100,
    };
  }, [camera, focus]);

  useEffect(() => {
    if (!focus) {
      flying.current = true;
      startedAt.current = performance.now();
      return;
    }

    // К точке подлетаем только если и правда стоим далеко: дёргать камеру,
    // когда она уже рядом, значит сбивать пользователю привычный ракурс.
    const needsFlight = base.current.position.distanceTo(desired.target) > 45;
    flying.current = needsFlight;
    startedAt.current = performance.now();

    // Лететь некуда — вторая фаза наступает сразу.
    if (!needsFlight) onSettled(projectFocus());
  }, [desired, focus, onSettled, projectFocus]);

  useEffect(() => {
    const element = gl.domElement;

    const onMove = (event: PointerEvent) => {
      // Палец по экрану — это прокрутка страницы, а не управление камерой.
      if (event.pointerType === "touch") return;

      const rect = element.getBoundingClientRect();
      pointerTarget.current = {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: ((event.clientY - rect.top) / rect.height) * 2 - 1,
      };
    };

    // Курсор ушёл с карты — она плавно возвращается в исходный ракурс.
    const onLeave = () => {
      pointerTarget.current = { x: 0, y: 0 };
    };

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);

    return () => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.1);

    // Базовый ракурс идёт к цели быстрее, доворот от курсора — мягче и ленивее.
    const kBase = 1 - Math.pow(0.08, step);
    const kPointer = 1 - Math.pow(0.25, step);

    base.current.position.lerp(desired.position, kBase);
    base.current.target.lerp(desired.target, kBase);

    pointer.current.x += (pointerTarget.current.x - pointer.current.x) * kPointer;
    pointer.current.y += (pointerTarget.current.y - pointer.current.y) * kPointer;

    offset.current.copy(base.current.position).sub(base.current.target);
    spherical.current.setFromVector3(offset.current);

    if (!reducedMotion) {
      spherical.current.theta += pointer.current.x * POINTER_YAW;
      spherical.current.phi = THREE.MathUtils.clamp(
        spherical.current.phi + pointer.current.y * POINTER_PITCH,
        0.22,
        1.32,
      );
    }

    offset.current.setFromSpherical(spherical.current);
    camera.position.copy(base.current.target).add(offset.current);
    camera.lookAt(base.current.target);

    if (!flying.current) return;

    /*
      Перелёт считаем законченным либо по расстоянию, либо по времени. Одного
      расстояния мало: на слабой машине кадров так немного, что сглаживание не
      успевает дойти до цели, и вторая фаза не наступала бы вовсе.
    */
    const arrived = base.current.position.distanceTo(desired.position) < 1;
    const expired = performance.now() - startedAt.current > 1600;

    if (arrived || expired) {
      flying.current = false;
      onSettled(projectFocus());
    }
  });

  return null;
}

function ringToShape(
  ring: [number, number][],
  projection: ReturnType<typeof buildProjection>,
): THREE.Shape | null {
  const shape = new THREE.Shape();
  let started = false;

  for (const coords of ring) {
    const point = projection(coords);
    if (!point) continue;

    // Экранный Y инвертируется: после поворота плиты север оказывается вдали.
    if (!started) {
      shape.moveTo(point[0], -point[1]);
      started = true;
    } else {
      shape.lineTo(point[0], -point[1]);
    }
  }

  return started ? shape : null;
}

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(MOTION_QUERY);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(MOTION_QUERY).matches,
    () => false,
  );
}
