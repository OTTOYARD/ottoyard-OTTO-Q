import React, { useRef, useMemo, Suspense, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Points, PointMaterial, Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { Skeleton } from "@/components/ui/skeleton";

interface VehicleShowroom3DProps {
  vehicleStatus: string;
  soc: number;
  vehicleColor: string;
}

// The model lives in the MVP project's public vehicle-renders bucket. otto-q-core (gxdrc) has no storage buckets, so
// its URL for this object returns 400 and the showroom never loaded (checked 2026-09-26). Point back here when the
// asset is copied to core.
const GLB_URL =
  "https://ycsisvozzgmisboumfqc.supabase.co/storage/v1/object/public/vehicle-renders/Tesla/2023_tesla_model_3_performance.glb";

const statusColors: Record<string, string> = {
  ready: "#22c55e",
  charging: "#3b82f6",
  at_depot: "#3b82f6",
  at_home: "#22c55e",
  in_service: "#f59e0b",
  en_route_depot: "#3b82f6",
};

/* ── Paint keywords for material detection ── */
const BODY_KEYWORDS = ["body", "paint", "car", "exterior", "hood", "door", "fender", "bumper", "trunk", "roof", "quarter"];
const GLASS_KEYWORDS = ["glass", "window", "windshield", "windscreen"];

function isBodyMesh(name: string): boolean {
  const lower = name.toLowerCase();
  return BODY_KEYWORDS.some((k) => lower.includes(k));
}

function isGlassMesh(name: string): boolean {
  const lower = name.toLowerCase();
  return GLASS_KEYWORDS.some((k) => lower.includes(k));
}

/* ══════════════════════════════════════════════
   Tesla Model 3 GLB Loader
   ══════════════════════════════════════════════ */

function TeslaModel3GLB({ paintColor }: { paintColor: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(GLB_URL);

  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  // Paint & glass materials
  const paintMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(paintColor),
        metalness: 0.9,
        roughness: 0.15,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.5,
        reflectivity: 1.0,
      }),
    [paintColor]
  );

  const glassMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#0a0a1a",
        metalness: 0.1,
        roughness: 0.05,
        transmission: 0.8,
        transparent: true,
        opacity: 0.75,
        ior: 1.52,
        thickness: 0.3,
        envMapIntensity: 1.0,
      }),
    []
  );

  // Apply materials & auto-center/scale
  useEffect(() => {
    // Traverse and apply materials
    clonedScene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const name = child.name || (child.material as THREE.Material)?.name || "";
      if (isBodyMesh(name)) {
        child.material = paintMat;
      } else if (isGlassMesh(name)) {
        child.material = glassMat;
      }
      child.castShadow = true;
      child.receiveShadow = true;
    });

    // Auto-center and scale to fit showroom
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = 3.2; // fits nicely in the showroom
    const scale = targetSize / maxDim;

    clonedScene.scale.setScalar(scale);
    clonedScene.position.set(-center.x * scale, -box.min.y * scale - 0.5, -center.z * scale);
    clonedScene.rotation.y = Math.PI;
  }, [clonedScene, paintMat, glassMat]);

  // Update paint color reactively
  useEffect(() => {
    paintMat.color.set(paintColor);
    paintMat.needsUpdate = true;
  }, [paintColor, paintMat]);

  // Gentle floating animation
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.5) * 0.025;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
    </group>
  );
}

// Preload the model
useGLTF.preload(GLB_URL);

/* ── Reflective showroom floor ── */
function ShowroomFloor({ accentColor }: { accentColor: string }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]} receiveShadow>
        <circleGeometry args={[6, 64]} />
        <meshStandardMaterial
          color="#08080e"
          metalness={0.97}
          roughness={0.06}
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.54, 0]}>
        <ringGeometry args={[3.5, 3.6, 64]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={0.3}
          transparent
          opacity={0.35}
        />
      </mesh>
    </group>
  );
}

/* ── Starfield backdrop ── */
function Starfield({ count = 2000 }: { count?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 15 + Math.random() * 5;
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, [count]);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.02;
    }
  });

  return (
    <group ref={groupRef}>
      <Points positions={positions} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          color="#e8eaff"
          size={0.186}
          sizeAttenuation
          depthWrite={false}
          opacity={1.0}
        />
      </Points>
    </group>
  );
}

/* ── Nebula dome ── */
function NebulaDome({ accentColor }: { accentColor: string }) {
  const ref1 = useRef<THREE.Mesh>(null);
  const ref2 = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref1.current) {
      (ref1.current.material as THREE.MeshStandardMaterial).opacity = 0.04 + Math.sin(t * 0.2) * 0.015;
    }
    if (ref2.current) {
      (ref2.current.material as THREE.MeshStandardMaterial).opacity = 0.03 + Math.cos(t * 0.15 + 1) * 0.01;
    }
  });

  return (
    <>
      <mesh ref={ref1} position={[3, 4, -8]} scale={[8, 6, 6]}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial
          color="#1a0a2e"
          transparent
          opacity={0.04}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={ref2} position={[-4, 3, -6]} scale={[7, 5, 5]}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial
          color={accentColor}
          transparent
          opacity={0.03}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 6, -3]} scale={[10, 4, 8]}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial
          color="#0a0a2a"
          transparent
          opacity={0.05}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

/* ── Ambient particles ── */
function AmbientParticles({ count, speed, color }: { count: number; speed: number; color: string }) {
  const pointsRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 6;
      arr[i * 3 + 1] = Math.random() * 3.5 - 0.5;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    return arr;
  }, [count]);

  useFrame((_state, delta) => {
    if (!pointsRef.current) return;
    const posAttr = pointsRef.current.geometry.attributes.position;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += delta * speed * 0.25;
      if (arr[i * 3 + 1] > 3) arr[i * 3 + 1] = -0.5;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <Points ref={pointsRef} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color={color}
        size={0.02}
        sizeAttenuation
        depthWrite={false}
        opacity={0.5}
      />
    </Points>
  );
}

/* ── Cinematic lighting rig ── */
function CinematicLightRig({ status }: { status: string }) {
  const keyLightRef = useRef<THREE.SpotLight>(null);
  const rimLightRef = useRef<THREE.SpotLight>(null);
  const fillLightRef = useRef<THREE.SpotLight>(null);
  const color = statusColors[status] || "#3b82f6";

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (keyLightRef.current) keyLightRef.current.intensity = 3.0 + Math.sin(t * 0.4) * 0.2;
    if (rimLightRef.current) rimLightRef.current.intensity = 2.2 + Math.cos(t * 0.6) * 0.15;
    if (fillLightRef.current) fillLightRef.current.intensity = 1.2 + Math.sin(t * 0.5 + 1) * 0.1;
  });

  return (
    <>
      <spotLight ref={keyLightRef} position={[4, 5, 3]} angle={0.4} penumbra={0.8} color="#ffffff" intensity={3.0} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <spotLight ref={rimLightRef} position={[-3, 4, -3]} angle={0.5} penumbra={0.9} color={color} intensity={2.2} />
      <spotLight ref={fillLightRef} position={[-4, 2, 2]} angle={0.6} penumbra={1} color="#e0e0ff" intensity={1.2} />
      <spotLight position={[0, 6, -2]} angle={0.35} penumbra={1} color={color} intensity={0.4} />
      <spotLight position={[2, 1, -4]} angle={0.5} penumbra={0.9} color="#ffffff" intensity={0.5} />
      <spotLight position={[0, 8, 0]} angle={0.6} penumbra={1} color="#ffffff" intensity={2.5} castShadow />
      <spotLight position={[3, 3, 4]} angle={0.5} penumbra={0.8} color="#ffffff" intensity={1.5} />
      <spotLight position={[0, 4, 0]} angle={0.3} penumbra={0.6} color="#ffffff" intensity={3.0} castShadow />
      <spotLight position={[1, 5, 4]} angle={0.4} penumbra={0.7} color="#ffffff" intensity={2.0} />
      <ambientLight intensity={0.25} color="#e8e8ff" />
    </>
  );
}

/* ── Error boundary for GLB loading ── */
class GLBErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

/* ── Fallback ── */
function ShowroomFallback() {
  return (
    <div className="w-full h-72 md:h-96 flex items-center justify-center">
      <Skeleton className="w-[320px] md:w-[420px] h-40 rounded-xl" />
    </div>
  );
}

function GLBLoadError() {
  return (
    <div className="w-full h-72 md:h-96 flex items-center justify-center bg-muted/20 rounded-xl">
      <p className="text-muted-foreground text-sm">Unable to load 3D model</p>
    </div>
  );
}

/* ── Main export ── */
export const VehicleShowroom3D: React.FC<VehicleShowroom3DProps> = ({
  vehicleStatus,
  soc,
  vehicleColor,
}) => {
  const particleCount = Math.max(20, Math.round(soc * 50));
  const particleSpeed = 0.3 + soc * 0.6;
  const accentColor = statusColors[vehicleStatus] || "#3b82f6";

  return (
    <div className="w-full h-72 md:h-96 relative">
      <GLBErrorBoundary fallback={<GLBLoadError />}>
        <Suspense fallback={<ShowroomFallback />}>
          <Canvas
            camera={{ position: [3.2, 1.8, 5.5], fov: 32 }}
            style={{ background: "#030308" }}
            gl={{
              alpha: true,
              antialias: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 1.3,
            }}
            dpr={[1, 2]}
            shadows
          >
            <CinematicLightRig status={vehicleStatus} />
            <TeslaModel3GLB paintColor={vehicleColor} />
            <ShowroomFloor accentColor={accentColor} />
            <Starfield />
            <NebulaDome accentColor={accentColor} />
            <AmbientParticles count={particleCount} speed={particleSpeed} color={accentColor} />
            <Environment preset="night" environmentIntensity={1.0} />
            <OrbitControls
              autoRotate
              autoRotateSpeed={0.35}
              enableZoom={false}
              enablePan={false}
              minPolarAngle={Math.PI / 3.5}
              maxPolarAngle={Math.PI / 2.2}
            />
          </Canvas>
        </Suspense>
      </GLBErrorBoundary>
    </div>
  );
};
