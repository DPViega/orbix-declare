"use client";

import { useEffect, useRef, type RefObject } from "react";

export type WelcomePhase = "loading" | "arrival" | "hold" | "exit";

/**
 * Logo completa em voxels (OD + Orbix Declare).
 *
 * O canvas cobre a tela inteira; `frame` é a caixa onde a logo fica em repouso. A câmera é calculada
 * para a logo caber nessa caixa, e na saída ela acelera até a câmera e atravessa a tela, crescendo
 * além das bordas sem ser cortada.
 */
export function WelcomeLogo({ frame: frameRef, phase, reduced, onReady }: {
  frame: RefObject<HTMLElement | null>;
  phase: WelcomePhase;
  reduced: boolean;
  onReady: (loaded: boolean) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const state = useRef({ phase, reduced, onReady });
  useEffect(() => { state.current = { phase, reduced, onReady }; });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let release = () => {};

    void (async () => {
      try {
        const THREE = await import("three");
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        if (disposed) return;
        const scene = new THREE.Scene();
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setClearColor(0x000000, 0);
        host.appendChild(renderer.domElement);
        const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 1000);
        const pivot = new THREE.Group();
        scene.add(pivot);
        scene.add(new THREE.HemisphereLight(0xe9e4ff, 0x191129, 1.5));
        const key = new THREE.DirectionalLight(0xffffff, 2.1);
        key.position.set(-3, 5, 8);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xb3a0f4, 1.2);
        rim.position.set(4, 1, -3);
        scene.add(rim);
        const gold = new THREE.DirectionalLight(0xffdf9b, 0);
        gold.position.set(0, 2, 5);
        scene.add(gold);

        let raf = 0;
        const observer: { current?: ResizeObserver } = {};
        const disposeModel = (object: import("three").Object3D) => {
          object.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return;
            child.geometry.dispose();
            for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
              for (const value of Object.values(material)) {
                if (value instanceof THREE.Texture) value.dispose();
              }
              material.dispose();
            }
          });
        };
        const onContextLost = (event: Event) => {
          event.preventDefault();
          cancelAnimationFrame(raf);
          if (!disposed) state.current.onReady(false);
        };
        renderer.domElement.addEventListener("webglcontextlost", onContextLost);
        release = () => {
          cancelAnimationFrame(raf);
          observer.current?.disconnect();
          renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
          disposeModel(scene);
          renderer.dispose();
          renderer.forceContextLoss();
          renderer.domElement.remove();
        };

        const gltf = await new GLTFLoader().loadAsync("/orbix-declare.glb");
        if (disposed) { disposeModel(gltf.scene); return; }
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3());
        gltf.scene.position.sub(box.getCenter(new THREE.Vector3()));
        pivot.add(gltf.scene);
        let distance = 1;
        // Posição de repouso (no plano da logo) que a coloca no centro da caixa `frame`.
        const rest = { x: 0, y: 0 };
        const halfFov = Math.tan(Math.PI / 12); // fov 30°
        const resize = () => {
          const { clientWidth: width, clientHeight: height } = host;
          if (!width || !height) return;
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          const view = host.getBoundingClientRect();
          const box = frameRef.current?.getBoundingClientRect() ?? view;
          // Altura visível necessária para a logo caber na caixa (com 14% de folga), em unidades do mundo.
          const visible = Math.max((size.y * height) / box.height, (size.x * height) / box.width) * 1.14;
          distance = visible / (2 * halfFov) + size.z;
          const perPx = (2 * distance * halfFov) / height;
          rest.x = (box.left + box.width / 2 - view.left - width / 2) * perPx;
          rest.y = -(box.top + box.height / 2 - view.top - height / 2) * perPx;
          camera.position.z = distance;
          camera.near = distance / 400;
          camera.far = distance * 20;
          camera.updateProjectionMatrix();
        };
        observer.current = new ResizeObserver(resize);
        observer.current.observe(host);
        if (frameRef.current) observer.current.observe(frameRef.current);
        resize();
        let arrivalStart: number | undefined;
        let exitStart: number | undefined;
        const frame = (now: number) => {
          const { phase: current, reduced: still } = state.current;
          if (current !== "loading" && arrivalStart === undefined) arrivalStart = now;
          const elapsed = arrivalStart === undefined ? 0 : (now - arrivalStart) / 1000;
          const arrival = still ? 1 : 1 - (1 - Math.min(1, elapsed / 1.2)) ** 4;
          if (current === "exit" && exitStart === undefined) exitStart = now;
          // Saída: acelera (ease-in cúbico) até passar da câmera, mirando o centro da tela.
          const exit = still || exitStart === undefined ? 0 : Math.min(1, (now - exitStart) / 1000) ** 3;
          pivot.scale.setScalar(still ? 1 : 0.14 + arrival * 0.86);
          pivot.position.z = -(1 - arrival) * distance * 1.8 + exit * (distance + size.z);
          pivot.position.x = rest.x * (1 - exit);
          pivot.position.y = rest.y * (1 - exit) + (still ? 0 : Math.sin(elapsed * 1.1) * size.y * 0.018 * (1 - exit));
          pivot.rotation.set(still ? 0 : (1 - arrival) * 0.1, still ? 0 : -(1 - arrival) * 0.25 + Math.sin(elapsed * 0.7) * 0.025, 0);
          gold.intensity = still ? 0 : Math.max(0, 1 - Math.abs(elapsed - 1.05) / 0.35) * 1.4;
          if (!document.hidden) renderer.render(scene, camera);
          raf = requestAnimationFrame(frame);
        };
        renderer.render(scene, camera);
        raf = requestAnimationFrame(frame);
        state.current.onReady(true);
      } catch {
        release();
        release = () => {};
        if (!disposed) state.current.onReady(false);
      }
    })();
    return () => { disposed = true; release(); };
  }, [frameRef]);

  return <div ref={hostRef} className="welcome-logo" aria-hidden="true" />;
}
