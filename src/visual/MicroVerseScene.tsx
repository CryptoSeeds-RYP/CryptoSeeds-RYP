import { useEffect, useRef } from "react";
import { Application, Assets, Container, Graphics, Sprite, Text, TextStyle } from "pixi.js";
import type { MicroVersePlot, MicroVerseSceneState } from "./microverseSceneState";

export function MicroVerseScene({ scene }: { scene: MicroVerseSceneState }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const stateRef = useRef(scene);

  useEffect(() => {
    stateRef.current = scene;
    renderScene(appRef.current, scene);
  }, [scene]);

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
      renderScene(app, stateRef.current);

      app.ticker.add((ticker) => {
        animateScene(app, ticker.lastTime / 1000);
      });
    }

    start();

    const resizeObserver = new ResizeObserver(() => {
      if (appRef.current) renderScene(appRef.current, stateRef.current);
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

async function renderScene(app: Application | null, scene: MicroVerseSceneState) {
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
    plotLayer.addChild(buildPlotMarker(plot, app.screen.width, app.screen.height));
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

function buildPlotMarker(plot: MicroVersePlot, width: number, height: number) {
  const marker = new Container();
  marker.x = plot.x * width;
  marker.y = plot.y * height;

  const active = plot.status !== "EMPTY";
  const markerColor = active ? 0x80c66d : 0xecd882;
  const ringColor = active ? 0x2c755e : 0xb78236;
  const radius = active ? 28 : 22;

  const base = new Graphics();
  base.ellipse(0, 10, radius * 1.7, radius * 0.72).fill({ color: 0x0f130d, alpha: 0.72 });
  base.circle(0, 0, radius).fill({ color: markerColor, alpha: active ? 0.34 : 0.18 });
  base.circle(0, 0, radius).stroke({ color: ringColor, alpha: 0.84, width: 2 });
  base.circle(0, 0, 5 + plot.progress / 12).fill({ color: markerColor, alpha: 0.9 });

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
