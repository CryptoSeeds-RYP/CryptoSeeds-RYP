import { useEffect, useRef } from "react";
import { Application, Assets, Container, Graphics, Sprite, Text, TextStyle } from "pixi.js";
import type { MicroVersePlot, MicroVerseSceneState } from "./microverseSceneState";

export function MicroVerseScene({
  scene,
  onPlotSelect,
}: {
  scene: MicroVerseSceneState;
  onPlotSelect?: (projectId: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const stateRef = useRef(scene);
  const plotSelectRef = useRef(onPlotSelect);

  useEffect(() => {
    stateRef.current = scene;
    renderScene(appRef.current, scene, plotSelectRef.current);
  }, [scene]);

  useEffect(() => {
    plotSelectRef.current = onPlotSelect;
  }, [onPlotSelect]);

  useEffect(() => {
    let disposed = false;
    const host = hostRef.current;
    if (!host) return undefined;
    const hostElement: HTMLDivElement = host;

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
      renderScene(app, stateRef.current, plotSelectRef.current);

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduceMotion) {
        app.ticker.add((ticker) => {
          animateScene(app, ticker.lastTime / 1000);
        });
      }
    }

    start();

    const resizeObserver = new ResizeObserver(() => {
      if (appRef.current) renderScene(appRef.current, stateRef.current, plotSelectRef.current);
    });
    resizeObserver.observe(hostElement);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      appRef.current?.destroy(true);
      appRef.current = null;
      hostElement.replaceChildren();
    };
  }, []);

  return <div className="microverse-scene" ref={hostRef} aria-hidden="true" />;
}

async function renderScene(
  app: Application | null,
  scene: MicroVerseSceneState,
  onPlotSelect?: (projectId: string) => void,
) {
  if (!app) return;

  app.stage.removeChildren();

  const terrain = await Assets.load("/assets/microverse-river-delta.jpg");
  const background = new Sprite(terrain);
  background.name = "terrain";
  fitSprite(background, app.screen.width, app.screen.height);
  app.stage.addChild(background);

  app.stage.addChild(buildAtmosphere(app, scene));

  const plotLayer = new Container();
  plotLayer.name = "plots";
  scene.plots.forEach((plot) => {
    plotLayer.addChild(buildPlotMarker(plot, app.screen.width, app.screen.height, onPlotSelect));
  });
  app.stage.addChild(plotLayer);
}

function animateScene(app: Application, time: number) {
  const plotLayer = app.stage.getChildByName("plots") as Container | undefined;
  if (!plotLayer) return;

  plotLayer.children.forEach((child, index) => {
    child.scale.set(1 + Math.sin(time * 2 + index) * 0.025);
  });
}

function fitSprite(sprite: Sprite, width: number, height: number) {
  const scale = Math.max(width / sprite.texture.width, height / sprite.texture.height);
  sprite.scale.set(scale);
  sprite.x = (width - sprite.texture.width * scale) / 2;
  sprite.y = (height - sprite.texture.height * scale) / 2;
}

function buildAtmosphere(app: Application, scene: MicroVerseSceneState) {
  const layer = new Graphics();
  const tierWarmth = scene.tier === "FRUIT" || scene.tier === "TREE" ? 0xb78236 : 0x163c2d;
  const alpha = scene.walletConnected ? 0.18 : 0.32;

  layer.rect(0, 0, app.screen.width, app.screen.height).fill({ color: 0x0c0d0a, alpha: 0.34 });
  layer.circle(app.screen.width * 0.72, app.screen.height * 0.26, app.screen.width * 0.22).fill({
    color: tierWarmth,
    alpha,
  });

  if (scene.weather === "RAIN") {
    for (let index = 0; index < 34; index += 1) {
      const x = ((index * 73) % app.screen.width) + 10;
      const y = ((index * 41) % app.screen.height) + 10;
      layer.moveTo(x, y).lineTo(x - 12, y + 24).stroke({ color: 0x9cb7cf, alpha: 0.2, width: 1 });
    }
  }

  return layer;
}

function buildPlotMarker(
  plot: MicroVersePlot,
  width: number,
  height: number,
  onPlotSelect?: (projectId: string) => void,
) {
  const marker = new Container();
  marker.x = plot.x * width;
  marker.y = plot.y * height;

  const active = plot.lifecycle !== "EMPTY";
  const colors = colorsForPlot(plot);
  const radius = active ? 28 : 22;

  if (plot.projectId) {
    marker.eventMode = "static";
    marker.cursor = "pointer";
    marker.on("pointertap", () => onPlotSelect?.(plot.projectId!));
  }

  const base = new Graphics();
  base.ellipse(0, 10, radius * 1.7, radius * 0.72).fill({ color: 0x0f130d, alpha: 0.72 });
  base.circle(0, 0, radius).fill({ color: colors.fill, alpha: active ? 0.34 : 0.18 });
  base.circle(0, 0, radius).stroke({ color: colors.ring, alpha: 0.84, width: 2 });
  drawPlotSymbol(base, plot, colors, radius);
  if (plot.lifecycle === "HARVEST" || plot.lifecycle === "MILESTONE") {
    base.circle(0, 0, radius + 8).stroke({ color: 0xfff1a3, alpha: 0.38, width: 3 });
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
      fill: 0xfff8df,
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: 12,
      fontWeight: "700",
      align: "center",
      wordWrap: true,
      wordWrapWidth: 120,
    }),
  });
  label.anchor.set(0.5, 0);
  label.y = radius + 10;

  marker.addChild(base, label);
  return marker;
}

function colorsForPlot(plot: MicroVersePlot) {
  if (plot.lifecycle === "EMPTY") return { fill: 0xecd882, ring: 0xb78236 };
  if (plot.lifecycle === "HARVEST" || plot.lifecycle === "MILESTONE") {
    return { fill: 0xffd66b, ring: 0xb78236 };
  }
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
