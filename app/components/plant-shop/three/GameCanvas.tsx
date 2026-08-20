"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGame } from "../game/store";
import { greenhouseCenterZ, greenhouseDepth } from "../game/species";
import { OrbitControls } from "./controls-shim";
import { Greenhouse } from "./Greenhouse";
import { Market } from "./Market";
import { Sky, HORIZON_COLOR, KEY_LIGHT_DIRECTION } from "./Sky";

interface View {
    position: [number, number, number];
    target: [number, number, number];
}

const MARKET_VIEW: View = { position: [1.4, 4, 13], target: [1.4, 1.3, 0] };

/**
 * Framing for a greenhouse with `tables` benches.
 *
 * The building grows away from the camera as tables are bought, so the view has
 * to pull back and re-centre or the far end falls out of frame. The down-angle
 * stays shallow either way, to leave a band of sunset above the treeline.
 */
function greenhouseView(tables: number): View {
    const midZ = greenhouseCenterZ(tables);
    const depth = greenhouseDepth(tables);
    const distance = Math.max(10, 6.2 + depth * 0.8);
    return { position: [0, 3.3 + depth * 0.24, midZ + distance], target: [0, 1.5, midZ] };
}

/**
 * Drives the simulation from the render loop.
 *
 * Deliberately the only place that calls `advance`. `useFrame` gives us the real
 * frame delta; the store clamps it so an alt-tabbed tab does not fast-forward.
 */
function Ticker() {
    const advance = useGame((s) => s.advance);
    useFrame((_state, dt) => advance(dt));
    return null;
}

/**
 * Snaps the camera to the current scene's framing.
 *
 * The `camera` prop on <Canvas> only applies at mount, and we keep one Canvas
 * alive across scene changes, so the move has to be done by hand.
 */
function CameraRig({ view }: { view: View }) {
    const camera = useThree((s) => s.camera);
    useEffect(() => {
        camera.position.set(...view.position);
        camera.lookAt(...view.target);
        camera.updateProjectionMatrix();
    }, [camera, view]);
    return null;
}

/**
 * Sunset lighting.
 *
 * The key light sits low and behind the greenhouse, matching `SUN_DIRECTION` so
 * the visible sun disc and the shadows agree. That backlights the interior, so
 * the ambient and the cool fill from the camera side are doing real work here —
 * without them the plants read as silhouettes and you cannot tell them apart.
 */
function Lighting() {
    const sun = KEY_LIGHT_DIRECTION.clone().multiplyScalar(26);
    return (
        <>
            <hemisphereLight args={["#ffc79c", "#4a4530", 1.15]} />
            <ambientLight intensity={0.62} color="#ffdcbb" />
            <directionalLight
                castShadow
                position={[sun.x, sun.y, sun.z]}
                intensity={3.1}
                color="#ffb877"
                shadow-mapSize={[2048, 2048]}
                shadow-bias={-5e-4}
            >
                <orthographicCamera attach="shadow-camera" args={[-14, 14, 14, -14, 0.1, 60]} />
            </directionalLight>
            <directionalLight position={[10, 6, 14]} intensity={1.15} color="#a8bedd" />
        </>
    );
}

export function GameCanvas() {
    const location = useGame((s) => s.world.location);
    const tables = useGame((s) => s.world.tables);
    const view = useMemo(() => (location === "greenhouse" ? greenhouseView(tables) : MARKET_VIEW), [location, tables]);
    return (
        <Canvas
            shadows
            dpr={[1, 2]}
            camera={{ position: view.position, fov: 45, near: 0.1, far: 1000 }}
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, preserveDrawingBuffer: false }}
        >
            <color attach="background" args={[HORIZON_COLOR]} />
            <fog attach="fog" args={[HORIZON_COLOR, 25, 120]} />
            <Ticker />
            <Lighting />
            <Sky />
            <group key={location}>
                <CameraRig view={view} />
                {location === "greenhouse" ? <Greenhouse /> : <Market />}
                <OrbitControls
                    makeDefault
                    target={view.target}
                    enablePan={false}
                    minDistance={4}
                    maxDistance={Math.max(18, view.position[2] - view.target[2] + 8)}
                    minPolarAngle={0.15}
                    maxPolarAngle={Math.PI / 2 - 0.05}
                    enableDamping
                    dampingFactor={0.08}
                />
            </group>
        </Canvas>
    );
}
