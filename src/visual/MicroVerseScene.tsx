import { useEffect, useRef } from "react";
import { Application, Assets, Container, Graphics, Sprite, Text, TextStyle, Texture } from "pixi.js";
import {
  MICROVERSE_ASSETS,
  MICROVERSE_LANDMARKS,
  MICROVERSE_PALETTE,
  type MicroVerseLandmark,
} from "./microverseAssets";
import type { MicroVerseNavigationMode, MicroVersePlot, MicroVerseSceneState } from "./microverseSceneState";

type Point = { x: number; y: number };

type Lantern = {
  halo: Graphics;
  flame: Graphics;
  phase: number;
};

type Glint = {
  shape: Graphics;
  x: number;
  y: number;
  phase: number;
};

type Particle = {
  shape: Graphics;
  x: number;
  y: number;
  drift: number;
  speed: number;
  phase: number;
};

type RainLine = {
  shape: Graphics;
  x: number;
  y: number;
  speed: number;
};

type WorldRuntime = {
  app: Application;
  root: Container;
  world: Container;
  player: Container;
  playerGlow: Graphics;
  camera: Point;
  destination: Point | null;
  keys: Set<string>;
  worldSize: Point;
  plotMarkers: Container[];
  lanterns: Lantern[];
  glints: Glint[];
  particles: Particle[];
  rainLines: RainLine[];
  navigationMode: MicroVerseNavigationMode;
  reduceMotion: boolean;
  destroy: () => void;
};

const CONTROL_KEYS = new Set(["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright"]);

export function MicroVerseScene({
  navigationMode = "STRATEGY",
  scene,
  onPlotSelect,
}: {
  navigationMode?: MicroVerseNavigationMode;
  scene: MicroVerseSceneState;
  onPlotSelect?: (projectId: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const runtimeRef = useRef<WorldRuntime | null>(null);
  const stateRef = useRef(scene);
  const plotSelectRef = useRef(onPlotSelect);
  const keysRef = useRef<Set<string>>(new Set());
  const navigationModeRef = useRef<MicroVerseNavigationMode>(navigationMode);
  const renderGenerationRef = useRef(0);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    stateRef.current = scene;
    navigationModeRef.current = navigationMode;
    if (navigationMode !== "CHARACTER") keysRef.current.clear();
    renderGenerationRef.current += 1;
    const generation = renderGenerationRef.current;
    void renderScene({
      app: appRef.current,
      generation,
      isCurrent: () => generation === renderGenerationRef.current,
      keys: keysRef.current,
      navigationMode,
      onPlotSelect: (projectId) => plotSelectRef.current?.(projectId),
      previousRuntime: runtimeRef.current,
      reduceMotion: reduceMotionRef.current,
      scene,
      setRuntime: (runtime) => {
        if (generation !== renderGenerationRef.current) {
          runtime.destroy();
          return;
        }
        runtimeRef.current?.destroy();
        runtimeRef.current = runtime;
      },
    });
  }, [navigationMode, scene]);

  useEffect(() => {
    plotSelectRef.current = onPlotSelect;
  }, [onPlotSelect]);

  useEffect(() => {
    let disposed = false;
    const host = hostRef.current;
    if (!host) return undefined;
    const hostElement: HTMLDivElement = host;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (navigationModeRef.current !== "CHARACTER") return;
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (!CONTROL_KEYS.has(key)) return;
      event.preventDefault();
      keysRef.current.add(key);
      if (runtimeRef.current) runtimeRef.current.destination = null;
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (navigationModeRef.current !== "CHARACTER") return;
      const key = event.key.toLowerCase();
      if (CONTROL_KEYS.has(key)) keysRef.current.delete(key);
    };

    async function start() {
      const app = new Application();
      await app.init({
        resizeTo: hostElement,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
      });

      if (disposed) {
        app.destroy(true);
        return;
      }

      appRef.current = app;
      hostElement.appendChild(app.canvas);

      const handlePointerDown = (event: PointerEvent) => {
        const runtime = runtimeRef.current;
        if (!runtime || runtime.navigationMode !== "CHARACTER") return;
        const rect = app.canvas.getBoundingClientRect();
        const screenX = ((event.clientX - rect.left) / rect.width) * app.screen.width;
        const screenY = ((event.clientY - rect.top) / rect.height) * app.screen.height;
        runtime.destination = {
          x: clamp(screenX - runtime.world.x, 40, runtime.worldSize.x - 40),
          y: clamp(screenY - runtime.world.y, 40, runtime.worldSize.y - 40),
        };
      };

      app.canvas.addEventListener("pointerdown", handlePointerDown);

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      reduceMotionRef.current = reduceMotion;
      app.ticker.add((ticker) => {
        const runtime = runtimeRef.current;
        if (!runtime) return;
        animateScene(runtime, Math.min(ticker.deltaMS / 1000, 0.05), ticker.lastTime / 1000);
      });

      renderGenerationRef.current += 1;
      const generation = renderGenerationRef.current;
      void renderScene({
        app,
        generation,
        isCurrent: () => generation === renderGenerationRef.current && !disposed,
        keys: keysRef.current,
        navigationMode: navigationModeRef.current,
        onPlotSelect: (projectId) => plotSelectRef.current?.(projectId),
        previousRuntime: runtimeRef.current,
        reduceMotion,
        scene: stateRef.current,
        setRuntime: (runtime) => {
          if (generation !== renderGenerationRef.current || disposed) {
            runtime.destroy();
            return;
          }
          runtimeRef.current?.destroy();
          runtimeRef.current = runtime;
        },
      });

      const resizeObserver = new ResizeObserver(() => {
        renderGenerationRef.current += 1;
        const resizeGeneration = renderGenerationRef.current;
        void renderScene({
          app,
          generation: resizeGeneration,
          isCurrent: () => resizeGeneration === renderGenerationRef.current && !disposed,
          keys: keysRef.current,
          navigationMode: navigationModeRef.current,
          onPlotSelect: (projectId) => plotSelectRef.current?.(projectId),
          previousRuntime: runtimeRef.current,
          reduceMotion,
          scene: stateRef.current,
          setRuntime: (runtime) => {
            if (resizeGeneration !== renderGenerationRef.current || disposed) {
              runtime.destroy();
              return;
            }
            runtimeRef.current?.destroy();
            runtimeRef.current = runtime;
          },
        });
      });

      resizeObserver.observe(hostElement);

      const cleanup = () => {
        resizeObserver.disconnect();
        app.canvas.removeEventListener("pointerdown", handlePointerDown);
      };
      hostElement.dataset.microverseCleanup = "ready";
      cleanupRef.current = cleanup;
    }

    const cleanupRef: { current?: () => void } = {};
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    void start();

    return () => {
      disposed = true;
      cleanupRef.current?.();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      runtimeRef.current?.destroy();
      runtimeRef.current = null;
      appRef.current?.destroy(true);
      appRef.current = null;
      hostElement.replaceChildren();
    };
  }, []);

  return <div className={`microverse-scene ${navigationMode.toLowerCase()}-mode`} ref={hostRef} />;
}

async function renderScene({
  app,
  generation,
  isCurrent,
  keys,
  navigationMode,
  onPlotSelect,
  previousRuntime,
  reduceMotion,
  scene,
  setRuntime,
}: {
  app: Application | null;
  generation: number;
  isCurrent: () => boolean;
  keys: Set<string>;
  navigationMode: MicroVerseNavigationMode;
  onPlotSelect: (projectId: string) => void;
  previousRuntime: WorldRuntime | null;
  reduceMotion?: boolean;
  scene: MicroVerseSceneState;
  setRuntime: (runtime: WorldRuntime) => void;
}) {
  if (!app) return;

  const runtime = await buildWorld(app, scene, keys, navigationMode, onPlotSelect, previousRuntime, reduceMotion ?? false);
  if (generation < 0 || !isCurrent()) {
    runtime.destroy();
    return;
  }

  app.stage.removeChildren();
  app.stage.addChild(runtime.root);
  setRuntime(runtime);
}

async function buildWorld(
  app: Application,
  scene: MicroVerseSceneState,
  keys: Set<string>,
  navigationMode: MicroVerseNavigationMode,
  onPlotSelect: (projectId: string) => void,
  previousRuntime: WorldRuntime | null,
  reduceMotion: boolean,
): Promise<WorldRuntime> {
  const worldSize = {
    x: navigationMode === "STRATEGY" ? Math.max(app.screen.width, 1) : Math.max(1680, app.screen.width * 1.62),
    y: navigationMode === "STRATEGY" ? Math.max(app.screen.height, 1) : Math.max(1120, app.screen.height * 1.58),
  };
  const root = new Container();
  const world = new Container();
  const plotMarkers: Container[] = [];
  const glints: Glint[] = [];
  const lanterns: Lantern[] = [];
  const particles: Particle[] = [];
  const rainLines: RainLine[] = [];

  const terrain = await Assets.load(MICROVERSE_ASSETS.conceptPlate).catch(() =>
    Assets.load(MICROVERSE_ASSETS.fallbackTerrain),
  );
  const landmarkTextures = await loadLandmarkTextures();
  const background = new Sprite(terrain);
  background.label = "terrain";
  background.alpha = 0.28;
  fitSprite(background, worldSize.x, worldSize.y);
  world.addChild(background);

  world.addChild(buildTerrainLayer(worldSize, scene));
  const water = buildWaterLayer(worldSize, scene, glints);
  world.addChild(water);
  world.addChild(buildPathLayer(worldSize));
  world.addChild(buildArchitectureLayer(worldSize, scene, lanterns, landmarkTextures));
  world.addChild(buildGardenLayer(worldSize));
  if (navigationMode === "STRATEGY") world.addChild(buildStrategicHotspotLayer(worldSize, scene));

  const plotLayer = new Container();
  plotLayer.label = "plots";
  scene.plots.forEach((plot) => {
    const marker = buildPlotMarker(plot, plot.x * worldSize.x, plot.y * worldSize.y, onPlotSelect);
    plotMarkers.push(marker);
    plotLayer.addChild(marker);
  });
  world.addChild(plotLayer);

  const player = buildPlayer();
  const startingPoint = previousRuntime
    ? {
        x: clamp(previousRuntime.player.x, 40, worldSize.x - 40),
        y: clamp(previousRuntime.player.y, 40, worldSize.y - 40),
      }
    : { x: worldSize.x * 0.49, y: worldSize.y * 0.58 };
  player.x = startingPoint.x;
  player.y = startingPoint.y;
  player.visible = navigationMode === "CHARACTER";
  world.addChild(player);

  const foreground = buildForegroundLayer(worldSize);
  world.addChild(foreground);

  const playerGlow = new Graphics();
  const particleLayer = buildParticleLayer(app, scene, particles, rainLines);
  const atmosphere = buildScreenAtmosphere(app, scene);
  root.addChild(world, playerGlow, particleLayer, atmosphere);

  const runtime: WorldRuntime = {
    app,
    root,
    world,
    player,
    playerGlow,
    camera: previousRuntime?.camera ?? { x: 0, y: 0 },
    destination: null,
    keys,
    worldSize,
    plotMarkers,
    lanterns,
    glints,
    particles,
    rainLines,
    navigationMode,
    reduceMotion,
    destroy: () => root.destroy({ children: true }),
  };

  if (navigationMode === "CHARACTER") {
    updateCamera(runtime, 1);
  } else {
    updateStrategicCamera(runtime);
  }
  return runtime;
}

async function loadLandmarkTextures() {
  const entries = await Promise.all(
    MICROVERSE_LANDMARKS.map(async (landmark) => {
      if (!landmark.assetPath) return null;
      const texture = await Assets.load(landmark.assetPath).catch(() => null);
      return texture ? ([landmark.id, texture] as const) : null;
    }),
  );

  return new Map(entries.filter((entry): entry is readonly [string, Texture] => Boolean(entry)));
}

function animateScene(runtime: WorldRuntime, deltaSeconds: number, time: number) {
  const motionScale = runtime.reduceMotion ? 0.28 : 1;
  if (runtime.navigationMode === "CHARACTER") {
    movePlayer(runtime, deltaSeconds * motionScale);
    updateCamera(runtime, runtime.reduceMotion ? 0.22 : 0.095);
  } else {
    updateStrategicCamera(runtime);
  }
  updatePlayerGlow(runtime);

  runtime.plotMarkers.forEach((child, index) => {
    child.scale.set(1 + Math.sin(time * 1.6 + index * 0.9) * 0.026 * motionScale);
  });

  runtime.lanterns.forEach((lantern) => {
    const pulse = 1 + Math.sin(time * 2.4 + lantern.phase) * 0.16 * motionScale;
    lantern.halo.scale.set(pulse);
    lantern.flame.alpha = 0.78 + Math.sin(time * 3 + lantern.phase) * 0.16 * motionScale;
  });

  runtime.glints.forEach((glint) => {
    glint.shape.x = glint.x + Math.sin(time * 1.8 + glint.phase) * 8 * motionScale;
    glint.shape.y = glint.y + Math.cos(time * 1.2 + glint.phase) * 3 * motionScale;
    glint.shape.alpha = 0.14 + Math.sin(time * 2.1 + glint.phase) * 0.08 * motionScale;
  });

  runtime.particles.forEach((particle) => {
    particle.y -= particle.speed * deltaSeconds * 14;
    particle.x += Math.sin(time + particle.phase) * particle.drift * deltaSeconds * 12;
    if (particle.y < -12) {
      particle.y = runtime.app.screen.height + 12;
      particle.x = (particle.x + 173) % runtime.app.screen.width;
    }
    particle.shape.x = particle.x;
    particle.shape.y = particle.y;
    particle.shape.alpha = 0.18 + Math.sin(time * 1.4 + particle.phase) * 0.1 * motionScale;
  });

  runtime.rainLines.forEach((rain) => {
    rain.y += rain.speed * deltaSeconds * 70;
    rain.x -= rain.speed * deltaSeconds * 24;
    if (rain.y > runtime.app.screen.height + 40) {
      rain.y = -40;
      rain.x = (rain.x + 211) % runtime.app.screen.width;
    }
    rain.shape.x = rain.x;
    rain.shape.y = rain.y;
  });
}

function movePlayer(runtime: WorldRuntime, deltaSeconds: number) {
  const horizontal =
    (runtime.keys.has("d") || runtime.keys.has("arrowright") ? 1 : 0) -
    (runtime.keys.has("a") || runtime.keys.has("arrowleft") ? 1 : 0);
  const vertical =
    (runtime.keys.has("s") || runtime.keys.has("arrowdown") ? 1 : 0) -
    (runtime.keys.has("w") || runtime.keys.has("arrowup") ? 1 : 0);
  const speed = 255;

  if (horizontal !== 0 || vertical !== 0) {
    const length = Math.hypot(horizontal, vertical) || 1;
    runtime.player.x += (horizontal / length) * speed * deltaSeconds;
    runtime.player.y += (vertical / length) * speed * deltaSeconds;
    runtime.destination = null;
  } else if (runtime.destination) {
    const dx = runtime.destination.x - runtime.player.x;
    const dy = runtime.destination.y - runtime.player.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 5) {
      runtime.destination = null;
    } else {
      const step = Math.min(speed * deltaSeconds, distance);
      runtime.player.x += (dx / distance) * step;
      runtime.player.y += (dy / distance) * step;
    }
  }

  runtime.player.x = clamp(runtime.player.x, 36, runtime.worldSize.x - 36);
  runtime.player.y = clamp(runtime.player.y, 36, runtime.worldSize.y - 36);

  const walkBob = runtime.destination || horizontal !== 0 || vertical !== 0 ? 1 : 0;
  runtime.player.rotation = Math.sin(performance.now() / 155) * 0.018 * walkBob;
}

function updateCamera(runtime: WorldRuntime, ease: number) {
  const target = {
    x: cameraAxisTarget(runtime.app.screen.width, runtime.worldSize.x, runtime.player.x),
    y: cameraAxisTarget(runtime.app.screen.height, runtime.worldSize.y, runtime.player.y),
  };
  runtime.camera.x += (target.x - runtime.camera.x) * ease;
  runtime.camera.y += (target.y - runtime.camera.y) * ease;
  runtime.world.x = runtime.camera.x;
  runtime.world.y = runtime.camera.y;
}

function updateStrategicCamera(runtime: WorldRuntime) {
  runtime.camera.x = 0;
  runtime.camera.y = 0;
  runtime.world.x = 0;
  runtime.world.y = 0;
}

function updatePlayerGlow(runtime: WorldRuntime) {
  if (runtime.navigationMode !== "CHARACTER") {
    runtime.playerGlow.clear();
    return;
  }

  const playerScreenX = runtime.player.x + runtime.world.x;
  const playerScreenY = runtime.player.y + runtime.world.y;
  runtime.playerGlow.clear();
  runtime.playerGlow.circle(playerScreenX, playerScreenY, 168).fill({ color: 0xffe39b, alpha: 0.045 });
  runtime.playerGlow.circle(playerScreenX, playerScreenY, 72).fill({ color: 0xffffff, alpha: 0.04 });
}

function buildTerrainLayer(worldSize: Point, scene: MicroVerseSceneState) {
  const layer = new Graphics();
  const tierGlow = scene.tier === "FRUIT" || scene.tier === "TREE" ? 0xffc857 : MICROVERSE_PALETTE.greenhouseTeal;

  layer.rect(0, 0, worldSize.x, worldSize.y).fill({ color: MICROVERSE_PALETTE.terrainBase, alpha: 1 });
  layer.rect(0, 0, worldSize.x, worldSize.y).fill({ color: MICROVERSE_PALETTE.terrainWash, alpha: 0.3 });

  for (let index = 0; index < 56; index += 1) {
    const x = (index * 97) % worldSize.x;
    const y = (index * 53) % worldSize.y;
    const length = 34 + (index % 5) * 14;
    const color = index % 3 === 0 ? 0xe2fff4 : 0x1c7884;
    layer.moveTo(x, y).lineTo(x + length, y + Math.sin(index) * 5).stroke({
      color,
      alpha: index % 3 === 0 ? 0.34 : 0.2,
      cap: "round",
      width: index % 3 === 0 ? 4 : 6,
    });
  }

  drawIsland(layer, worldSize.x * 0.5, worldSize.y * 0.55, 420, 190, 0x4da765, tierGlow);
  drawIsland(layer, worldSize.x * 0.2, worldSize.y * 0.69, 230, 138, 0x448e58, 0xffd45f);
  drawIsland(layer, worldSize.x * 0.78, worldSize.y * 0.36, 265, 142, 0x5aac66, 0x8fc8ff);
  drawIsland(layer, worldSize.x * 0.83, worldSize.y * 0.73, 190, 118, 0x438f61, 0xdca8ff);
  drawIsland(layer, worldSize.x * 0.27, worldSize.y * 0.31, 190, 105, 0x69b766, 0xffd45f);

  for (let index = 0; index < 120; index += 1) {
    const x = (index * 131) % worldSize.x;
    const y = (index * 89) % worldSize.y;
    const color = index % 7 === 0 ? 0xe48ca6 : index % 5 === 0 ? 0xffdf78 : 0xd8ef9a;
    layer.circle(x, y, 2 + (index % 3)).fill({ color, alpha: 0.42 });
  }

  return layer;
}

function buildWaterLayer(worldSize: Point, scene: MicroVerseSceneState, glints: Glint[]) {
  const layer = new Container();
  const water = new Graphics();
  const canal = [
    { x: -80, y: worldSize.y * 0.58 },
    { x: worldSize.x * 0.2, y: worldSize.y * 0.53 },
    { x: worldSize.x * 0.43, y: worldSize.y * 0.6 },
    { x: worldSize.x * 0.66, y: worldSize.y * 0.48 },
    { x: worldSize.x + 80, y: worldSize.y * 0.55 },
  ];
  const branch = [
    { x: worldSize.x * 0.55, y: worldSize.y * 0.12 },
    { x: worldSize.x * 0.58, y: worldSize.y * 0.35 },
    { x: worldSize.x * 0.53, y: worldSize.y * 0.6 },
    { x: worldSize.x * 0.48, y: worldSize.y + 80 },
  ];

  strokePath(water, canal, 138, MICROVERSE_PALETTE.waterDeep, 0.52);
  strokePath(water, canal, 100, MICROVERSE_PALETTE.waterMid, 0.74);
  strokePath(water, canal, 18, MICROVERSE_PALETTE.waterLight, scene.weather === "GOLDEN_HARVEST" ? 0.48 : 0.36);
  strokePath(water, branch, 94, MICROVERSE_PALETTE.waterDeep, 0.52);
  strokePath(water, branch, 62, MICROVERSE_PALETTE.waterMid, 0.68);
  strokePath(water, branch, 10, 0xe9fff7, 0.34);
  layer.addChild(water);

  for (let index = 0; index < 34; index += 1) {
    const glint = new Graphics();
    const x = worldSize.x * (0.08 + ((index * 0.071) % 0.84));
    const y = index % 2 === 0 ? worldSize.y * (0.52 + ((index * 17) % 16) / 200) : worldSize.y * (0.18 + ((index * 23) % 64) / 100);
    glint.ellipse(0, 0, 18 + (index % 5) * 7, 3.2).fill({ color: 0xeaffff, alpha: 0.38 });
    glint.x = x;
    glint.y = y;
    glints.push({ shape: glint, x, y, phase: index * 0.54 });
    layer.addChild(glint);
  }

  return layer;
}

function buildPathLayer(worldSize: Point) {
  const layer = new Graphics();
  const plaza = { x: worldSize.x * 0.51, y: worldSize.y * 0.55 };
  const pathColor = MICROVERSE_PALETTE.soilGold;
  const shadow = MICROVERSE_PALETTE.pathShadow;
  const gold = 0xffe8a2;

  const paths = [
    [{ x: worldSize.x * 0.12, y: worldSize.y * 0.73 }, plaza, { x: worldSize.x * 0.88, y: worldSize.y * 0.68 }],
    [{ x: worldSize.x * 0.28, y: worldSize.y * 0.3 }, plaza, { x: worldSize.x * 0.78, y: worldSize.y * 0.27 }],
    [{ x: worldSize.x * 0.48, y: worldSize.y * 0.87 }, plaza, { x: worldSize.x * 0.52, y: worldSize.y * 0.18 }],
  ];

  paths.forEach((path) => {
    strokePath(layer, path, 50, shadow, 0.72);
    strokePath(layer, path, 36, pathColor, 0.96);
    strokePath(layer, path, 7, gold, 0.58);
  });

  layer.ellipse(plaza.x, plaza.y + 18, 286, 136).fill({ color: 0x45644c, alpha: 0.5 });
  drawOutlinedEllipse(layer, plaza.x, plaza.y, 262, 122, 0xf2cb72, 0.96, 0x4f6f55, 0.82, 8);
  layer.ellipse(plaza.x - 52, plaza.y - 24, 122, 42).fill({ color: 0xffe5a0, alpha: 0.34 });
  layer.circle(plaza.x, plaza.y, 48).stroke({ color: 0xffffff, alpha: 0.42, width: 5 });

  drawBridge(layer, worldSize.x * 0.35, worldSize.y * 0.56, 130, 54);
  drawBridge(layer, worldSize.x * 0.58, worldSize.y * 0.44, 112, 50);
  drawBridge(layer, worldSize.x * 0.52, worldSize.y * 0.7, 54, 128);

  return layer;
}

function buildArchitectureLayer(
  worldSize: Point,
  scene: MicroVerseSceneState,
  lanterns: Lantern[],
  landmarkTextures: Map<string, Texture>,
) {
  const layer = new Container();
  const buildings = new Graphics();
  const sprites = new Container();

  MICROVERSE_LANDMARKS.forEach((landmark) => {
    const texture = landmarkTextures.get(landmark.id);
    if (texture) {
      sprites.addChild(buildLandmarkSprite(landmark, texture, worldSize));
    } else {
      drawLandmark(buildings, landmark, worldSize, scene);
    }
  });
  layer.addChild(buildings, sprites);

  const lanternPositions = [
    { x: worldSize.x * 0.39, y: worldSize.y * 0.56 },
    { x: worldSize.x * 0.48, y: worldSize.y * 0.46 },
    { x: worldSize.x * 0.58, y: worldSize.y * 0.57 },
    { x: worldSize.x * 0.63, y: worldSize.y * 0.37 },
    { x: worldSize.x * 0.34, y: worldSize.y * 0.72 },
    { x: worldSize.x * 0.71, y: worldSize.y * 0.72 },
    { x: worldSize.x * 0.46, y: worldSize.y * 0.78 },
    { x: worldSize.x * 0.55, y: worldSize.y * 0.23 },
  ];
  lanternPositions.forEach((point, index) => {
    const lantern = buildLantern(point.x, point.y, index);
    lanterns.push(lantern.runtime);
    layer.addChild(lantern.container);
  });

  return layer;
}

function buildGardenLayer(worldSize: Point) {
  const layer = new Graphics();
  const groves = [
    { x: 0.17, y: 0.43, count: 24 },
    { x: 0.26, y: 0.8, count: 18 },
    { x: 0.68, y: 0.18, count: 20 },
    { x: 0.88, y: 0.48, count: 18 },
  ];

  groves.forEach((grove, groveIndex) => {
    for (let index = 0; index < grove.count; index += 1) {
      const angle = index * 2.399 + groveIndex;
      const distance = 18 + (index % 5) * 14;
      const x = worldSize.x * grove.x + Math.cos(angle) * distance;
      const y = worldSize.y * grove.y + Math.sin(angle) * distance * 0.72;
      drawCanopyTree(layer, x, y, 0.72 + (index % 4) * 0.08, index % 3 === 0 ? 0x7fc65d : 0x2f8d5f);
    }
  });

  return layer;
}

function buildStrategicHotspotLayer(worldSize: Point, scene: MicroVerseSceneState) {
  const layer = new Graphics();

  MICROVERSE_LANDMARKS.forEach((landmark) => {
    const x = worldSize.x * landmark.x;
    const y = worldSize.y * landmark.y + 22 * landmark.scale;
    layer.ellipse(x, y, 88 * landmark.scale, 34 * landmark.scale).fill({ color: landmark.accent, alpha: 0.08 });
    layer.ellipse(x, y, 88 * landmark.scale, 34 * landmark.scale).stroke({
      color: landmark.accent,
      alpha: 0.34,
      width: 3 * landmark.scale,
    });
    layer.ellipse(x, y, 54 * landmark.scale, 19 * landmark.scale).stroke({
      color: MICROVERSE_PALETTE.ivory,
      alpha: 0.2,
      width: 1.4 * landmark.scale,
    });
  });

  scene.plots.forEach((plot) => {
    const x = worldSize.x * plot.x;
    const y = worldSize.y * plot.y + 14;
    const colors = colorsForPlot(plot);
    const alpha = plot.lifecycle === "EMPTY" ? 0.2 : 0.42;
    layer.ellipse(x, y, 58, 22).fill({ color: colors.ring, alpha: alpha * 0.28 });
    layer.ellipse(x, y, 58, 22).stroke({ color: colors.ring, alpha, width: 3 });
  });

  return layer;
}

function buildLandmarkSprite(landmark: MicroVerseLandmark, texture: Texture, worldSize: Point) {
  const sprite = new Sprite(texture);
  const targetWidth = landmarkSpriteWidth(landmark);
  const scale = targetWidth / Math.max(texture.width, 1);

  sprite.anchor.set(0.5, 0.86);
  sprite.x = worldSize.x * landmark.x;
  sprite.y = worldSize.y * landmark.y + 78 * landmark.scale;
  sprite.scale.set(scale);
  sprite.alpha = 0.96;
  sprite.label = landmark.id;

  return sprite;
}

function landmarkSpriteWidth(landmark: MicroVerseLandmark) {
  if (landmark.kind === "HOMESTEAD") return 250 * landmark.scale;
  if (landmark.kind === "GOVERNANCE_HALL") return 230 * landmark.scale;
  if (landmark.kind === "SEEDBOT_TERMINAL") return 238 * landmark.scale;
  return 150 * landmark.scale;
}

function buildForegroundLayer(worldSize: Point) {
  const layer = new Graphics();
  for (let index = 0; index < 18; index += 1) {
    const x = (index * 257) % worldSize.x;
    const y = index % 2 === 0 ? worldSize.y - 40 - (index % 5) * 12 : 28 + (index % 4) * 18;
    layer.ellipse(x, y, 74, 24).fill({ color: 0x07100c, alpha: 0.12 });
    layer.circle(x - 18, y - 18, 32).fill({ color: 0x173a2b, alpha: 0.5 });
    layer.circle(x + 16, y - 24, 28).fill({ color: 0x2d6040, alpha: 0.38 });
  }
  return layer;
}

function buildParticleLayer(
  app: Application,
  scene: MicroVerseSceneState,
  particles: Particle[],
  rainLines: RainLine[],
) {
  const layer = new Container();
  const particleCount = scene.weather === "GOLDEN_HARVEST" ? 76 : 44;
  for (let index = 0; index < particleCount; index += 1) {
    const particle = new Graphics();
    const color = index % 4 === 0 ? 0xffdc84 : index % 3 === 0 ? 0x9df3ff : 0xe7ffe1;
    const radius = index % 5 === 0 ? 2.2 : 1.35;
    particle.circle(0, 0, radius).fill({ color, alpha: 0.48 });
    const x = (index * 97) % Math.max(app.screen.width, 1);
    const y = (index * 61) % Math.max(app.screen.height, 1);
    particle.x = x;
    particle.y = y;
    particles.push({ shape: particle, x, y, drift: 0.6 + (index % 6) * 0.25, speed: 0.28 + (index % 7) * 0.06, phase: index * 0.37 });
    layer.addChild(particle);
  }

  if (scene.weather === "RAIN" || scene.weather === "STORM") {
    const count = scene.weather === "STORM" ? 58 : 36;
    for (let index = 0; index < count; index += 1) {
      const rain = new Graphics();
      rain.moveTo(0, 0).lineTo(-11, 25).stroke({
        color: scene.weather === "STORM" ? 0xb8dcff : 0x9fcbd9,
        alpha: scene.weather === "STORM" ? 0.34 : 0.24,
        width: 1,
      });
      const x = (index * 83) % Math.max(app.screen.width, 1);
      const y = (index * 47) % Math.max(app.screen.height, 1);
      rain.x = x;
      rain.y = y;
      rainLines.push({ shape: rain, x, y, speed: 5 + (index % 5) });
      layer.addChild(rain);
    }
  }

  return layer;
}

function buildScreenAtmosphere(app: Application, scene: MicroVerseSceneState) {
  const layer = new Graphics();
  const width = app.screen.width;
  const height = app.screen.height;
  const eventColor = scene.weather === "SEASONAL_EVENT" ? 0xa158ff : scene.weather === "STORM" ? 0x4f78b6 : 0xd59645;
  const walletAlpha = scene.walletConnected ? 0.16 : 0.28;

  layer.rect(0, 0, width, height).fill({ color: 0xfff1bf, alpha: 0.035 });
  layer.circle(width * 0.72, height * 0.26, Math.max(width, height) * 0.28).fill({
    color: eventColor,
    alpha: walletAlpha * 0.78,
  });
  layer.rect(0, 0, width, height).stroke({ color: 0xf8d477, alpha: 0.16, width: 2 });
  layer.rect(0, 0, width, height).fill({ color: 0x082a39, alpha: scene.weather === "STORM" ? 0.12 : 0.01 });

  return layer;
}

function buildPlayer() {
  const player = new Container();
  const body = new Graphics();
  body.ellipse(0, 22, 24, 9).fill({ color: 0x315241, alpha: 0.36 });
  body.circle(0, 0, 21).fill({ color: 0x243f58, alpha: 1 });
  body.circle(0, 0, 21).stroke({ color: 0x23313d, alpha: 0.94, width: 4 });
  body.ellipse(0, 10, 15, 19).fill({ color: 0x2f8584, alpha: 1 });
  body.ellipse(-3, 6, 7, 12).fill({ color: 0x9ddfca, alpha: 0.64 });
  body.circle(0, -10, 10).fill({ color: 0xffd58f, alpha: 1 });
  body.circle(0, -10, 10).stroke({ color: 0x513a28, alpha: 0.94, width: 3 });
  body.circle(0, -15, 13).stroke({ color: 0xffd45f, alpha: 0.9, width: 4 });
  body.rect(-3, -1, 6, 22).fill({ color: 0xffef8a, alpha: 0.86 });
  body.circle(0, 0, 29).stroke({ color: 0xffffff, alpha: 0.26, width: 2 });
  player.addChild(body);
  return player;
}

function buildPlotMarker(plot: MicroVersePlot, x: number, y: number, onPlotSelect: (projectId: string) => void) {
  const marker = new Container();
  marker.x = x;
  marker.y = y;

  const active = plot.lifecycle !== "EMPTY";
  const colors = colorsForPlot(plot);
  const radius = active ? 28 : 22;

  if (plot.projectId) {
    marker.eventMode = "static";
    marker.cursor = "pointer";
    marker.on("pointertap", (event) => {
      event.stopPropagation();
      onPlotSelect(plot.projectId!);
    });
  }

  const base = new Graphics();
  base.ellipse(0, 12, radius * 1.9, radius * 0.76).fill({ color: 0x050805, alpha: 0.62 });
  base.circle(0, 0, radius + 12).fill({ color: colors.ring, alpha: active ? 0.12 : 0.07 });
  base.circle(0, 0, radius).fill({ color: colors.fill, alpha: active ? 0.36 : 0.2 });
  base.circle(0, 0, radius).stroke({ color: colors.ring, alpha: 0.88, width: 2 });
  drawPlotSymbol(base, plot, colors, radius);
  if (plot.lifecycle === "HARVEST" || plot.lifecycle === "MILESTONE") {
    base.circle(0, 0, radius + 8).stroke({ color: 0xfff1a3, alpha: 0.42, width: 3 });
  }
  if (plot.lifecycle === "PAUSED") {
    base.moveTo(-radius + 6, -radius + 6).lineTo(radius - 6, radius - 6).stroke({
      color: 0xffc7a3,
      alpha: 0.86,
      width: 3,
    });
  }

  const label = new Text({
    text: plot.label,
    style: new TextStyle({
      align: "center",
      fill: 0xfff8df,
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: 12,
      fontWeight: "700",
      wordWrap: true,
      wordWrapWidth: 128,
    }),
  });
  label.anchor.set(0.5, 0);
  label.y = radius + 12;

  marker.addChild(base, label);
  return marker;
}

function drawIsland(
  layer: Graphics,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  grassColor: number,
  accent: number,
) {
  drawOutlinedEllipse(layer, x, y + 20, radiusX + 36, radiusY + 26, 0x6c8f68, 0.34, 0x15526a, 0.5, 10);
  drawOutlinedEllipse(layer, x, y + 6, radiusX + 22, radiusY + 18, 0xffdc83, 1, 0x15526a, 0.78, 9);
  drawOutlinedEllipse(layer, x, y - 10, radiusX, radiusY, grassColor, 1, 0x2d724f, 0.86, 5);
  layer.ellipse(x - radiusX * 0.25, y - radiusY * 0.32, radiusX * 0.45, radiusY * 0.34).fill({
    color: 0x9dff81,
    alpha: 0.35,
  });
  layer.ellipse(x + radiusX * 0.3, y + radiusY * 0.1, radiusX * 0.36, radiusY * 0.22).fill({
    color: 0x248d69,
    alpha: 0.18,
  });
  layer.circle(x + radiusX * 0.58, y - radiusY * 0.28, 28).fill({ color: accent, alpha: 0.2 });
  layer.circle(x + radiusX * 0.58, y - radiusY * 0.28, 28).stroke({ color: 0xffffff, alpha: 0.26, width: 3 });
}

function drawOutlinedEllipse(
  layer: Graphics,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  fill: number,
  fillAlpha: number,
  stroke: number,
  strokeAlpha: number,
  strokeWidth: number,
) {
  layer.ellipse(x, y, radiusX, radiusY).fill({ color: fill, alpha: fillAlpha });
  layer.ellipse(x, y, radiusX, radiusY).stroke({ color: stroke, alpha: strokeAlpha, width: strokeWidth });
}

function drawOutlinedRect(
  layer: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: number,
  fillAlpha: number,
  stroke: number,
  strokeAlpha: number,
  strokeWidth: number,
) {
  layer.rect(x, y, width, height).fill({ color: fill, alpha: fillAlpha });
  layer.rect(x, y, width, height).stroke({ color: stroke, alpha: strokeAlpha, width: strokeWidth });
}

function drawCanopyTree(layer: Graphics, x: number, y: number, scale: number, leafColor: number) {
  layer.ellipse(x, y + 9 * scale, 18 * scale, 7 * scale).fill({ color: 0x345c45, alpha: 0.36 });
  drawOutlinedRect(layer, x - 3 * scale, y - 1 * scale, 6 * scale, 18 * scale, 0xb56f34, 1, 0x5d3b20, 0.74, 2 * scale);
  layer.circle(x - 11 * scale, y - 8 * scale, 12 * scale).fill({ color: leafColor, alpha: 1 });
  layer.circle(x + 9 * scale, y - 10 * scale, 13 * scale).fill({ color: leafColor, alpha: 1 });
  layer.circle(x, y - 19 * scale, 14 * scale).fill({ color: 0xa3ef65, alpha: 0.96 });
  layer.circle(x - 11 * scale, y - 8 * scale, 12 * scale).stroke({ color: 0x2d724f, alpha: 0.8, width: 2 * scale });
  layer.circle(x + 9 * scale, y - 10 * scale, 13 * scale).stroke({ color: 0x2d724f, alpha: 0.8, width: 2 * scale });
  layer.circle(x, y - 19 * scale, 14 * scale).stroke({ color: 0x2d724f, alpha: 0.8, width: 2 * scale });
}

function drawLandmark(
  layer: Graphics,
  landmark: MicroVerseLandmark,
  worldSize: Point,
  scene: MicroVerseSceneState,
) {
  const x = worldSize.x * landmark.x;
  const y = worldSize.y * landmark.y;
  const accent = scene.walletConnected || landmark.kind !== "GOVERNANCE_HALL" ? landmark.accent : 0xffcf5a;

  if (landmark.kind === "SEEDBOT_TERMINAL") {
    drawSeedBotGreenhouse(layer, x, y, landmark.scale, accent);
    return;
  }

  if (landmark.kind === "HARVEST_LEDGER") {
    drawHarvestLedger(layer, x, y, landmark.scale, accent);
    return;
  }

  if (landmark.kind === "STEWARD_GLADE") {
    drawStewardGlade(layer, x, y, landmark.scale, accent);
    return;
  }

  if (landmark.kind === "LOREHOUSE") {
    drawLorehouse(layer, x, y, landmark.scale, accent);
    return;
  }

  if (landmark.kind === "TREASURY_GROVE") {
    drawTreasuryGrove(layer, x, y, landmark.scale, accent);
    return;
  }

  drawDomeCluster(layer, x, y, landmark.scale, accent);
}

function drawHarvestLedger(layer: Graphics, x: number, y: number, scale: number, accent: number) {
  layer.ellipse(x, y + 40 * scale, 78 * scale, 25 * scale).fill({ color: 0x14271f, alpha: 0.42 });
  drawOutlinedRect(layer, x - 42 * scale, y - 2 * scale, 84 * scale, 58 * scale, 0x6b4d25, 0.92, 0xf1cc74, 0.7, 4 * scale);
  layer.rect(x - 31 * scale, y + 8 * scale, 62 * scale, 10 * scale).fill({ color: 0xfff1ba, alpha: 0.3 });
  layer.rect(x - 31 * scale, y + 25 * scale, 62 * scale, 8 * scale).fill({ color: 0xfff1ba, alpha: 0.24 });
  layer.circle(x, y - 7 * scale, 24 * scale).fill({ color: accent, alpha: 0.2 });
  layer.circle(x, y - 7 * scale, 24 * scale).stroke({ color: accent, alpha: 0.58, width: 3 * scale });
  layer.moveTo(x - 14 * scale, y - 6 * scale).lineTo(x, y + 9 * scale).lineTo(x + 18 * scale, y - 13 * scale).stroke({
    color: 0xfff8df,
    alpha: 0.78,
    width: 4 * scale,
    cap: "round",
    join: "round",
  });
}

function drawSeedBotGreenhouse(layer: Graphics, x: number, y: number, scale: number, accent: number) {
  layer.ellipse(x, y + 48 * scale, 96 * scale, 31 * scale).fill({ color: 0x10231f, alpha: 0.42 });
  drawOutlinedRect(layer, x - 58 * scale, y + 4 * scale, 116 * scale, 55 * scale, 0x183a35, 0.92, 0xd6b35d, 0.72, 4 * scale);
  drawOutlinedEllipse(layer, x, y - 6 * scale, 66 * scale, 46 * scale, 0x1f8590, 0.88, 0xd6b35d, 0.84, 5 * scale);
  layer.rect(x - 46 * scale, y + 13 * scale, 92 * scale, 14 * scale).fill({ color: 0x92f0dc, alpha: 0.22 });
  layer.moveTo(x - 42 * scale, y + 43 * scale).lineTo(x + 42 * scale, y + 43 * scale).stroke({
    color: accent,
    alpha: 0.7,
    width: 4 * scale,
    cap: "round",
  });
  layer.circle(x, y + 24 * scale, 13 * scale).fill({ color: accent, alpha: 0.7 });
  layer.circle(x, y + 24 * scale, 13 * scale).stroke({ color: 0xffffff, alpha: 0.42, width: 2 * scale });
  for (let index = 0; index < 4; index += 1) {
    const nodeX = x - 36 * scale + index * 24 * scale;
    layer.circle(nodeX, y + 44 * scale, 4.5 * scale).fill({ color: 0xbdf8ee, alpha: 0.74 });
  }
}

function drawStewardGlade(layer: Graphics, x: number, y: number, scale: number, accent: number) {
  layer.ellipse(x, y + 30 * scale, 86 * scale, 32 * scale).fill({ color: 0x183f31, alpha: 0.58 });
  layer.circle(x, y + 2 * scale, 34 * scale).fill({ color: accent, alpha: 0.12 });
  layer.circle(x, y + 2 * scale, 34 * scale).stroke({ color: accent, alpha: 0.48, width: 3 * scale });
  layer.moveTo(x, y + 34 * scale).lineTo(x, y - 44 * scale).stroke({ color: 0xd7b1ff, alpha: 0.76, width: 5 * scale, cap: "round" });
  for (let index = 0; index < 6; index += 1) {
    const angle = index * (Math.PI / 3);
    layer.circle(x + Math.cos(angle) * 43 * scale, y + Math.sin(angle) * 21 * scale, 10 * scale).fill({
      color: index % 2 === 0 ? 0x7fc65d : 0x9edcdf,
      alpha: 0.78,
    });
  }
}

function drawLorehouse(layer: Graphics, x: number, y: number, scale: number, accent: number) {
  drawWindmill(layer, x, y, scale);
  layer.circle(x - 42 * scale, y + 48 * scale, 12 * scale).fill({ color: accent, alpha: 0.32 });
  layer.circle(x + 42 * scale, y + 48 * scale, 12 * scale).fill({ color: accent, alpha: 0.32 });
}

function drawTreasuryGrove(layer: Graphics, x: number, y: number, scale: number, accent: number) {
  layer.ellipse(x, y + 32 * scale, 84 * scale, 30 * scale).fill({ color: 0x213f28, alpha: 0.5 });
  for (let index = 0; index < 7; index += 1) {
    const angle = index * 0.9;
    drawCanopyTree(
      layer,
      x + Math.cos(angle) * 38 * scale,
      y + Math.sin(angle) * 20 * scale,
      0.74 * scale,
      index % 2 === 0 ? 0x7fc65d : 0x2f8d5f,
    );
  }
  layer.circle(x, y, 18 * scale).fill({ color: accent, alpha: 0.58 });
  layer.circle(x, y, 18 * scale).stroke({ color: 0xffffff, alpha: 0.4, width: 2 * scale });
}

function drawWindmill(layer: Graphics, x: number, y: number, scale: number) {
  layer.ellipse(x, y + 52 * scale, 52 * scale, 18 * scale).fill({ color: 0x3f6653, alpha: 0.34 });
  drawOutlinedRect(layer, x - 24 * scale, y - 8 * scale, 48 * scale, 72 * scale, 0xfff1ba, 1, 0x2e4d53, 0.95, 5 * scale);
  drawOutlinedEllipse(layer, x, y - 20 * scale, 32 * scale, 24 * scale, 0xff7f61, 1, 0x2e4d53, 0.95, 4 * scale);
  const hubY = y - 28 * scale;
  layer.moveTo(x, hubY).lineTo(x, hubY - 52 * scale).stroke({ color: 0xfff7d0, alpha: 0.95, width: 7 * scale, cap: "round" });
  layer.moveTo(x, hubY).lineTo(x + 48 * scale, hubY + 8 * scale).stroke({ color: 0xfff7d0, alpha: 0.95, width: 7 * scale, cap: "round" });
  layer.moveTo(x, hubY).lineTo(x - 44 * scale, hubY + 18 * scale).stroke({ color: 0xfff7d0, alpha: 0.95, width: 7 * scale, cap: "round" });
  layer.moveTo(x, hubY).lineTo(x + 8 * scale, hubY + 48 * scale).stroke({ color: 0xfff7d0, alpha: 0.95, width: 7 * scale, cap: "round" });
  layer.circle(x, hubY, 10 * scale).fill({ color: 0xffd45f, alpha: 1 });
  layer.circle(x, hubY, 10 * scale).stroke({ color: 0x2e4d53, alpha: 0.9, width: 3 * scale });
}

function drawDomeCluster(layer: Graphics, x: number, y: number, scale: number, accent: number) {
  layer.ellipse(x, y + 42 * scale, 82 * scale, 28 * scale).fill({ color: 0x385445, alpha: 0.36 });
  drawOutlinedRect(layer, x - 45 * scale, y - 3 * scale, 90 * scale, 58 * scale, 0xfff1ba, 1, 0x2e4d53, 0.9, 5 * scale);
  layer.rect(x - 36 * scale, y + 6 * scale, 72 * scale, 18 * scale).fill({ color: 0xffffff, alpha: 0.22 });
  drawOutlinedEllipse(layer, x, y - 15 * scale, 48 * scale, 40 * scale, 0x2a8ebf, 1, 0x2e4d53, 0.96, 5 * scale);
  layer.ellipse(x - 12 * scale, y - 28 * scale, 20 * scale, 11 * scale).fill({ color: 0x7de9ff, alpha: 0.38 });
  drawOutlinedEllipse(layer, x - 58 * scale, y + 24 * scale, 25 * scale, 28 * scale, 0xff9d68, 0.98, 0x2e4d53, 0.9, 4 * scale);
  drawOutlinedEllipse(layer, x + 58 * scale, y + 24 * scale, 25 * scale, 28 * scale, 0xff9d68, 0.98, 0x2e4d53, 0.9, 4 * scale);
  layer.circle(x, y + 26 * scale, 9 * scale).fill({ color: accent, alpha: 0.62 });
  layer.circle(x, y + 26 * scale, 9 * scale).stroke({ color: 0xffffff, alpha: 0.46, width: 2 * scale });
  for (let index = 0; index < 5; index += 1) {
    const columnX = x - 32 * scale + index * 16 * scale;
    drawOutlinedRect(layer, columnX, y + 8 * scale, 6 * scale, 38 * scale, 0xffffff, 0.44, 0x2e4d53, 0.35, 1 * scale);
  }
}

function buildLantern(x: number, y: number, index: number) {
  const container = new Container();
  container.x = x;
  container.y = y;
  const stand = new Graphics();
  stand.moveTo(0, 4).lineTo(0, -28).stroke({ color: 0x3a2417, alpha: 0.82, width: 3 });
  stand.moveTo(-10, -26).lineTo(10, -26).stroke({ color: 0x3a2417, alpha: 0.82, width: 2 });
  const halo = new Graphics();
  halo.circle(0, -30, 38).fill({ color: 0xffcf73, alpha: 0.11 });
  const flame = new Graphics();
  flame.circle(0, -30, 7).fill({ color: 0xffe094, alpha: 0.86 });
  flame.circle(0, -30, 3).fill({ color: 0xffffff, alpha: 0.68 });
  container.addChild(halo, stand, flame);
  return { container, runtime: { halo, flame, phase: index * 0.71 } };
}

function drawBridge(layer: Graphics, x: number, y: number, width: number, height: number) {
  layer.rect(x - width / 2, y - height / 2, width, height).fill({ color: 0x8d7857, alpha: 0.82 });
  layer.rect(x - width / 2, y - height / 2, width, height).stroke({ color: 0xe4c478, alpha: 0.48, width: 3 });
  const slats = Math.max(3, Math.floor(Math.max(width, height) / 20));
  for (let index = 1; index < slats; index += 1) {
    if (width > height) {
      const slatX = x - width / 2 + (width / slats) * index;
      layer.moveTo(slatX, y - height / 2).lineTo(slatX, y + height / 2).stroke({ color: 0x3d2d21, alpha: 0.32, width: 2 });
    } else {
      const slatY = y - height / 2 + (height / slats) * index;
      layer.moveTo(x - width / 2, slatY).lineTo(x + width / 2, slatY).stroke({ color: 0x3d2d21, alpha: 0.32, width: 2 });
    }
  }
}

function colorsForPlot(plot: MicroVersePlot) {
  if (plot.lifecycle === "EMPTY") return { fill: 0xecd882, ring: 0xb78236 };
  if (plot.lifecycle === "HARVEST" || plot.lifecycle === "MILESTONE") return { fill: 0xffd66b, ring: 0xb78236 };
  if (plot.lifecycle === "COMPLETED") return { fill: 0xa8d8c0, ring: 0x407c68 };
  if (plot.lifecycle === "PAUSED") return { fill: 0xffa37b, ring: 0x9d5039 };
  if (plot.lifecycle === "PREPARING") return { fill: 0xf0c77a, ring: 0x8a693c };
  if (plot.visualKind === "RESEARCH_GREENHOUSE") return { fill: 0x8fb7ff, ring: 0x4a6ea8 };
  if (plot.visualKind === "WATER_NODE") return { fill: 0x76c7d8, ring: 0x2f7c8e };
  if (plot.visualKind === "DONATION_GLADE") return { fill: 0xd7b1ff, ring: 0x76509b };
  return { fill: 0x80c66d, ring: 0x2c755e };
}

function drawPlotSymbol(
  layer: Graphics,
  plot: MicroVersePlot,
  colors: { fill: number; ring: number },
  radius: number,
) {
  const growth = Math.max(6, Math.min(15, 5 + plot.progress / 12));

  if (plot.visualKind === "RESEARCH_GREENHOUSE") {
    layer.rect(-12, -7, 24, 18).fill({ color: colors.fill, alpha: 0.86 });
    layer.rect(-15, -10, 30, 24).stroke({ color: 0xfff8df, alpha: 0.45, width: 1 });
    return;
  }

  if (plot.visualKind === "WATER_NODE") {
    layer.ellipse(0, 1, growth * 0.8, growth * 1.25).fill({ color: colors.fill, alpha: 0.9 });
    layer.circle(0, -radius + 9, 3).fill({ color: 0xfff8df, alpha: 0.72 });
    return;
  }

  if (plot.visualKind === "DONATION_GLADE") {
    layer.circle(-7, -2, 7).fill({ color: colors.fill, alpha: 0.82 });
    layer.circle(7, -2, 7).fill({ color: colors.fill, alpha: 0.82 });
    layer.circle(0, 7, 8).fill({ color: colors.fill, alpha: 0.82 });
    return;
  }

  if (plot.visualKind === "GROVE") {
    layer.rect(-3, 0, 6, 14).fill({ color: 0x5b3c21, alpha: 0.9 });
    layer.circle(0, -6, growth).fill({ color: colors.fill, alpha: 0.9 });
    return;
  }

  layer.circle(0, 0, growth).fill({ color: colors.fill, alpha: 0.9 });
}

function fitSprite(sprite: Sprite, width: number, height: number) {
  const scale = Math.max(width / sprite.texture.width, height / sprite.texture.height);
  sprite.scale.set(scale);
  sprite.x = (width - sprite.texture.width * scale) / 2;
  sprite.y = (height - sprite.texture.height * scale) / 2;
}

function strokePath(layer: Graphics, points: Point[], width: number, color: number, alpha: number) {
  if (points.length === 0) return;
  layer.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => layer.lineTo(point.x, point.y));
  layer.stroke({ color, alpha, width, cap: "round", join: "round" });
}

function cameraAxisTarget(viewportSize: number, worldSize: number, playerCoordinate: number) {
  if (worldSize <= viewportSize) return (viewportSize - worldSize) / 2;
  return clamp(viewportSize / 2 - playerCoordinate, viewportSize - worldSize, 0);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || target.isContentEditable;
}
