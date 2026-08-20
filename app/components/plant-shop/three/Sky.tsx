"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../game/store";
import { Billboard } from "./controls-shim";

/**
 * Sunset sky: a gradient dome, a low sun, and drifting low-poly clouds.
 *
 * Shared by both scenes so the greenhouse and the market are the same time of
 * day. The gradient is a generated CanvasTexture rather than a custom shader,
 * which keeps colour-space and tone-mapping handling on Three's normal path.
 */

/**
 * Where the sun *appears*, kept low and only ~20° off straight-back so it sits
 * inside the strip of sky visible above the greenhouse.
 */
export const SUN_DIRECTION = new THREE.Vector3(-0.34, 0.08, -0.93).normalize();
/**
 * Where the sun *lights from*. Same azimuth as the disc, so shadows point the
 * way you'd expect, but raised — a light this low would leave the greenhouse
 * interior unreadably dark.
 */
export const KEY_LIGHT_DIRECTION = new THREE.Vector3(-0.34, 0.44, -0.83).normalize();
/** Horizon colour. Fog and the canvas clear colour should both use this. */
export const HORIZON_COLOR = "#e9a874";
const SKY_RADIUS = 300;

/**
 * Vertical gradient stops, as fractions of the dome from top to bottom.
 * 0.5 is the horizon, because a sphere's V coordinate is 0.5 at its equator.
 */
const STOPS: [number, string][] = [
    [0, "#231d4d"],
    [0.22, "#3d2f63"],
    [0.36, "#7d4668"],
    [0.44, "#c2635f"],
    [0.48, "#ef9256"],
    [0.5, "#ffd199"],
    [0.54, "#b07f5f"],
    [0.72, "#5d4634"],
    [1, "#3a2c24"]
];

function useSkyTexture() {
    return useMemo(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 4;
        canvas.height = 512;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
            for (const [at, color] of STOPS) grad.addColorStop(at, color);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        return tex;
    }, []);
}

function SkyDome() {
    const texture = useSkyTexture();
    useEffect(() => () => texture.dispose(), [texture]);
    return (
        <mesh renderOrder={-1}>
            <sphereGeometry args={[SKY_RADIUS, 32, 24]} />
            <meshBasicMaterial map={texture} side={THREE.BackSide} fog={false} toneMapped={false} depthWrite={false} />
        </mesh>
    );
}

function Sun() {
    const position = useMemo(() => SUN_DIRECTION.clone().multiplyScalar(SKY_RADIUS * 0.75), []);
    return (
        <Billboard position={position}>
            <mesh>
                <circleGeometry args={[22, 32]} />
                <meshBasicMaterial color="#ff9d52" transparent opacity={0.28} fog={false} toneMapped={false} depthWrite={false} />
            </mesh>
            <mesh position={[0, 0, 0.1]}>
                <circleGeometry args={[8, 32]} />
                <meshBasicMaterial color="#fff0cf" fog={false} toneMapped={false} depthWrite={false} />
            </mesh>
        </Billboard>
    );
}

interface Puff {
    x: number;
    y: number;
    z: number;
    r: number;
    tint: string;
}

/**
 * Chunky flat-shaded clouds. Each cloud is a few overlapping icosahedra, tinted
 * from warm on the sun side to cool away from it.
 */
function Clouds() {
    const group = useRef<THREE.Group>(null);
    const puffs = useMemo<Puff[]>(() => {
        const clouds = [
            { x: -88, y: 15, z: -115, scale: 1.5, warm: true },
            { x: -150, y: 12, z: -95, scale: 1.3, warm: true },
            { x: 22, y: 14, z: -130, scale: 1.2, warm: false },
            { x: 68, y: 16, z: -120, scale: 1.7, warm: false },
            { x: 125, y: 19, z: -140, scale: 1.4, warm: false },
            { x: 40, y: 24, z: -195, scale: 2.2, warm: true }
        ];
        const lobes: [number, number, number, number, number][] = [
            [0, 0, 0, 9, 1],
            [11, -2.5, 2, 7, 0.86],
            [-10, -2, -2, 6.5, 0.91],
            [4, 4, -1, 6, 1.14]
        ];
        const out: Puff[] = [];
        const color = new THREE.Color();
        for (const c of clouds)
            for (const [dx, dy, dz, r, shade] of lobes) {
                color.set(c.warm ? "#ffcfa2" : "#d9b3c2").multiplyScalar(shade);
                out.push({
                    x: c.x + dx * c.scale,
                    y: c.y + dy * c.scale,
                    z: c.z + dz * c.scale,
                    r: r * c.scale,
                    tint: `#${color.getHexString()}`
                });
            }
        return out;
    }, []);
    useFrame(() => {
        if (!group.current) return;
        const t = useGame.getState().world.elapsed;
        group.current.position.x = ((t * 0.6) % 400) - 200;
    });
    return (
        <group ref={group}>
            {puffs.map((p, i) => (
                <mesh key={i} position={[p.x, p.y, p.z]}>
                    <icosahedronGeometry args={[p.r, 0]} />
                    <meshBasicMaterial color={p.tint} fog={false} toneMapped={false} />
                </mesh>
            ))}
        </group>
    );
}

export function Sky() {
    return (
        <group>
            <SkyDome />
            <Sun />
            <Clouds />
        </group>
    );
}
