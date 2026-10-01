"use client";

/**
 * Logo 3D "OD" (voxels) da tela de abertura — public/od-logo.glb, mesmo modelo do vídeo docs/brave_*.mp4.
 *
 * three.js é importado sob demanda (fica fora do bundle principal) e o GLB tem ~180 KB comprimido.
 * Fases (controladas pela splash):
 *  - "idle": balanço suave de frente, flutuando;
 *  - "spin": uma volta completa no eixo Y (momento "Tudo pronto");
 *  - "exit": encolhe até sumir no centro, junto com o fade da splash.
 * Com prefers-reduced-motion o modelo fica parado de frente. Se o WebGL falhar, chama onReady mesmo
 * assim para a splash não travar (a logo só não aparece).
 */
import { useEffect, useRef, useState } from "react";

export type LogoPhase = "idle" | "spin" | "exit";

const MODEL_URL = "/od-logo.glb";
const SPIN_MS = 1250;
const EXIT_MS = 520;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeIn = (t: number) => t * t * t;

export function SplashLogo({
  phase,
  reduced,
  onReady,
  className,
}: {
  phase: LogoPhase;
  reduced: boolean;
  onReady: () => void;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Valores lidos dentro do loop de renderização sem reiniciar a cena.
  const phaseRef = useRef(phase);
  const reducedRef = useRef(reduced);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    phaseRef.current = phase;
    reducedRef.current = reduced;
    onReadyRef.current = onReady;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      try {
        const THREE = await import("three");
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        if (disposed) return;

        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: "low-power",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.style.cssText = "display:block;width:100%;height:100%";
        host.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 10);
        camera.position.set(0, 0, 1);

        scene.add(new THREE.HemisphereLight(0xe9e4ff, 0x1a1033, 1.6));
        const key = new THREE.DirectionalLight(0xffffff, 2.4);
        key.position.set(-0.6, 1, 1.2);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xb3a0f4, 1.4);
        rim.position.set(1, 0.3, -1);
        scene.add(rim);

        const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
        if (disposed) {
          renderer.dispose();
          return;
        }

        // Centraliza o modelo e enquadra a câmera pelo maior lado (o modelo gira, então usa a esfera).
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        const pivot = new THREE.Group();
        pivot.add(model);
        scene.add(pivot);
        const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
        camera.position.z = (radius * 1.08) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        camera.near = camera.position.z / 100;
        camera.far = camera.position.z * 10;
        camera.updateProjectionMatrix();

        const resize = () => {
          const { clientWidth: w, clientHeight: h } = host;
          if (!w || !h) return;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        };
        const ro = new ResizeObserver(resize);
        ro.observe(host);
        resize();

        let raf = 0;
        let spinStart = -1;
        let exitStart = -1;
        const t0 = performance.now();
        const frame = (now: number) => {
          raf = requestAnimationFrame(frame);
          const t = (now - t0) / 1000;
          const still = reducedRef.current;
          const ph = phaseRef.current;

          // Balanço de frente (o "idle" continua por baixo da volta, sem saltos).
          const swayY = still ? 0 : Math.sin(t * 0.9) * 0.22;
          const swayX = still ? 0 : Math.sin(t * 0.7 + 1) * 0.06;
          const bob = still ? 0 : Math.sin(t * 1.3) * radius * 0.025;

          let spin = 0;
          if (ph !== "idle" && !still) {
            if (spinStart < 0) spinStart = now;
            spin = easeInOut(Math.min(1, (now - spinStart) / SPIN_MS)) * Math.PI * 2;
          }
          let scale = 1;
          if (ph === "exit" && !still) {
            if (exitStart < 0) exitStart = now;
            scale = 1 - easeIn(Math.min(1, (now - exitStart) / EXIT_MS));
          }

          pivot.rotation.set(swayX, swayY + spin, 0);
          pivot.position.y = bob;
          pivot.scale.setScalar(Math.max(scale, 0.0001));
          renderer.render(scene, camera);
        };
        raf = requestAnimationFrame(frame);
        setVisible(true);
        onReadyRef.current();

        cleanup = () => {
          cancelAnimationFrame(raf);
          ro.disconnect();
          scene.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              o.geometry.dispose();
              (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
            }
          });
          renderer.dispose();
          renderer.forceContextLoss();
          renderer.domElement.remove();
        };
      } catch {
        // Sem WebGL ou falha ao baixar o modelo: segue sem a logo.
        if (!disposed) onReadyRef.current();
      }
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={`transition-[opacity,scale] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${visible ? "scale-100 opacity-100" : "scale-90 opacity-0"} ${className ?? ""}`}
    />
  );
}
