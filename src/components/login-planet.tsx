"use client";

import { useEffect, useRef, useState } from "react";

export function LoginPlanet() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};

    async function setup() {
      if (!host) return;
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      if (disposed) return;
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(92, 92);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.style.cssText = "display:block;width:100%;height:100%";
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x483080, 2));
      const light = new THREE.DirectionalLight(0xffffff, 3);
      light.position.set(3, 4, 5);
      scene.add(light);
      let frame = 0;
      const releaseModel = (model: import("three").Object3D) => {
        const textures = new Set<import("three").Texture>();
        model.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.geometry.dispose();
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            for (const value of Object.values(material)) {
              if (value instanceof THREE.Texture) textures.add(value);
            }
            material.dispose();
          }
        });
        textures.forEach((texture) => texture.dispose());
      };
      cleanup = () => {
        cancelAnimationFrame(frame);
        releaseModel(scene);
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };

      const gltf = await new GLTFLoader().loadAsync("/voxel-planet-orbits.glb");
      if (disposed) {
        releaseModel(gltf.scene);
        return;
      }
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
      gltf.scene.position.sub(box.getCenter(new THREE.Vector3()));
      const pivot = new THREE.Group();
      pivot.add(gltf.scene);
      scene.add(pivot);
      camera.position.z = radius * 1.1 / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2));
      camera.near = camera.position.z / 100;
      camera.far = camera.position.z * 10;
      camera.updateProjectionMatrix();

      const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
      let last = performance.now();
      const render = (now: number) => {
        const elapsed = Math.min((now - last) / 1000, 0.1);
        last = now;
        if (!document.hidden && host.getClientRects().length) {
          if (!motion.matches) pivot.rotation.y += elapsed * Math.PI * 2 / 40;
          renderer.render(scene, camera);
        }
        frame = requestAnimationFrame(render);
      };
      renderer.render(scene, camera);
      setReady(true);
      frame = requestAnimationFrame(render);
    }

    void setup().catch(() => { cleanup(); });
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <div aria-hidden="true" className="relative size-[92px] shrink-0">
      {/* Enquanto o modelo carrega (ou se o WebGL falhar): brilho lilás no lugar do planeta, sem a logo antiga. */}
      <div
        className={`absolute inset-5 rounded-full bg-[radial-gradient(circle_at_35%_30%,#c9bcf7_0%,#8b6ae8_45%,transparent_72%)] blur-[2px] transition-opacity duration-700 ${ready ? "opacity-0" : "animate-pulse opacity-50"}`}
      />
      <div ref={hostRef} className={`size-full transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`} />
    </div>
  );
}
