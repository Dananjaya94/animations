"use client";

import * as THREE from "three";
import type { PlantForm, Species } from "../types";
import { clamp, easeOut, lerp, smoothstep } from "../util/math";

const FORM: Record<PlantForm, { height: number; leaves: boolean; leafSize: number; crownScale: number }> = {
    flower: { height: 0.95, leaves: true, leafSize: 1, crownScale: 1 },
    herb: { height: 0.55, leaves: true, leafSize: 1.3, crownScale: 0.9 },
    fruit: { height: 0.85, leaves: true, leafSize: 1.1, crownScale: 1 },
    succulent: { height: 0.3, leaves: false, leafSize: 1, crownScale: 1.35 },
    vine: { height: 1.1, leaves: true, leafSize: 1.6, crownScale: 1.1 },
    fern: { height: 0.4, leaves: false, leafSize: 1, crownScale: 1.25 },
    bulb: { height: 0.85, leaves: true, leafSize: 1.5, crownScale: 1 },
    bonsai: { height: 0.42, leaves: false, leafSize: 1, crownScale: 1.5 },
    bird: { height: 1, leaves: true, leafSize: 1.7, crownScale: 1.2 }
};

/** Growth value at which each part starts fading in. */
const APPEAR = {
    stem: 0.05,
    leaf: [0.12, 0.38, 0.62],
    crown: 0.72
};

/** How much growth a part takes to fade fully in. */
const FADE = 0.1;

/** Height up the stem at which each leaf pair sits, as a fraction. */
const LEAF_HEIGHT = [0.32, 0.58, 0.82];

const NAMES = {
    stem: "stem",
    leaf: (i: number) => `leaf${i}`,
    crown: "crown"
};

function Crown({ form, color }: { form: PlantForm; color: string }) {
    const material = <meshStandardMaterial color={color} flatShading roughness={0.7} />;
    switch (form) {
        case "flower":
            return (
                <>
                    <mesh castShadow>
                        <icosahedronGeometry args={[0.1, 0]} />
                        {material}
                    </mesh>
                    {[0, 1, 2, 3, 4].map((i) => {
                        const a = (i / 5) * Math.PI * 2;
                        return (
                            <mesh key={i} castShadow position={[Math.cos(a) * 0.13, 0.01, Math.sin(a) * 0.13]} scale={[1, 0.5, 1]}>
                                <icosahedronGeometry args={[0.085, 0]} />
                                {material}
                            </mesh>
                        );
                    })}
                </>
            );
        case "herb":
            return (
                <>
                    {[0, 1, 2, 3, 4].map((i) => {
                        const a = (i / 5) * Math.PI * 2;
                        return (
                            <mesh
                                key={i}
                                castShadow
                                position={[Math.cos(a) * 0.1, 0.06, Math.sin(a) * 0.1]}
                                rotation={[Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4]}
                            >
                                <coneGeometry args={[0.08, 0.24, 5]} />
                                {material}
                            </mesh>
                        );
                    })}
                </>
            );
        case "fruit":
            return (
                <>
                    {(
                        [
                            [0.12, 0, 0.05],
                            [-0.1, -0.04, -0.08],
                            [0.01, 0.06, 0.12]
                        ] as [number, number, number][]
                    ).map((p, i) => (
                        <mesh key={i} castShadow position={p}>
                            <icosahedronGeometry args={[0.1, 0]} />
                            {material}
                        </mesh>
                    ))}
                </>
            );
        case "succulent":
            return (
                <>
                    {[0, 1, 2, 3, 4, 5].map((i) => {
                        const a = (i / 6) * Math.PI * 2;
                        return (
                            <mesh
                                key={i}
                                castShadow
                                position={[Math.cos(a) * 0.09, 0.14, Math.sin(a) * 0.09]}
                                rotation={[Math.cos(a) * 0.55, 0, -Math.sin(a) * 0.55]}
                            >
                                <coneGeometry args={[0.055, 0.42, 4]} />
                                {material}
                            </mesh>
                        );
                    })}
                </>
            );
        case "vine":
            return (
                <>
                    {[0, 1, 2].map((i) => {
                        const a = (i / 3) * Math.PI * 2;
                        return (
                            <mesh key={i} castShadow position={[Math.cos(a) * 0.16, i * 0.04, Math.sin(a) * 0.16]} rotation={[0.3, -a, 0]}>
                                <boxGeometry args={[0.34, 0.02, 0.26]} />
                                {material}
                            </mesh>
                        );
                    })}
                </>
            );
        case "fern":
            return (
                <>
                    {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                        const a = (i / 7) * Math.PI * 2;
                        return (
                            <mesh
                                key={i}
                                castShadow
                                position={[Math.cos(a) * 0.16, 0.12, Math.sin(a) * 0.16]}
                                rotation={[Math.cos(a) * 0.95, -a, -Math.sin(a) * 0.95]}
                                scale={[1, 1, 0.35]}
                            >
                                <coneGeometry args={[0.09, 0.62, 4]} />
                                {material}
                            </mesh>
                        );
                    })}
                </>
            );
        case "bulb":
            return (
                <>
                    {[0, 1, 2, 3, 4].map((i) => {
                        const a = (i / 5) * Math.PI * 2;
                        return (
                            <mesh
                                key={i}
                                castShadow
                                position={[Math.cos(a) * 0.075, 0.1, Math.sin(a) * 0.075]}
                                rotation={[Math.cos(a) * -0.35, -a, Math.sin(a) * 0.35]}
                                scale={[0.75, 1, 0.75]}
                            >
                                <coneGeometry args={[0.075, 0.26, 4]} />
                                {material}
                            </mesh>
                        );
                    })}
                </>
            );
        case "bonsai":
            return (
                <>
                    {(
                        [
                            [0, 0.1, 0, 0.22],
                            [0.21, -0.01, 0.06, 0.15],
                            [-0.19, 0.02, -0.07, 0.16],
                            [0.04, 0.18, -0.16, 0.13]
                        ] as [number, number, number, number][]
                    ).map(([dx, dy, dz, r], i) => (
                        <mesh key={i} castShadow position={[dx ?? 0, dy ?? 0, dz ?? 0]} scale={[1, 0.55, 1]}>
                            <icosahedronGeometry args={[r ?? 0.16, 0]} />
                            {material}
                        </mesh>
                    ))}
                </>
            );
        case "bird":
            return (
                <>
                    {[0, 1, 2].map((i) => {
                        const a = -0.5 + i * 0.5;
                        return (
                            <mesh
                                key={i}
                                castShadow
                                position={[Math.sin(a) * 0.1, 0.08 + i * 0.05, 0]}
                                rotation={[0, 0, 0.5 + a]}
                                scale={[1, 1, 0.3]}
                            >
                                <coneGeometry args={[0.1, 0.44, 3]} />
                                {material}
                            </mesh>
                        );
                    })}
                </>
            );
        default:
            return null;
    }
}

function LeafPair({ size, color, twist }: { size: number; color: string; twist: number }) {
    return (
        <group rotation={[0, twist, 0]}>
            {[-1, 1].map((side) => (
                <mesh key={side} castShadow position={[side * 0.11 * size, 0, 0]} rotation={[0, 0, side * -0.45]} scale={[size, size * 0.35, size]}>
                    <icosahedronGeometry args={[0.11, 0]} />
                    <meshStandardMaterial color={color} flatShading roughness={0.8} />
                </mesh>
            ))}
        </group>
    );
}

/**
 * A plant's full scene graph, at rest. Position it so its origin sits on the
 * soil surface; `updatePlant` handles everything from there.
 */
export function PlantMesh({ species }: { species: Species }) {
    const profile = FORM[species.form];
    return (
        <group>
            <group name={NAMES.stem}>
                <mesh castShadow position={[0, 0.5, 0]}>
                    <cylinderGeometry args={[0.028, 0.05, 1, 6]} />
                    <meshStandardMaterial color={species.palette.stem} flatShading roughness={0.85} />
                </mesh>
            </group>
            {profile.leaves &&
                LEAF_HEIGHT.map((_, i) => (
                    <group key={i} name={NAMES.leaf(i)}>
                        <LeafPair size={profile.leafSize} color={species.palette.leaf} twist={i * 1.9} />
                    </group>
                ))}
            <group name={NAMES.crown}>
                <Crown form={species.form} color={species.palette.crown} />
            </group>
        </group>
    );
}

export interface PlantParts {
    stem: THREE.Object3D | null;
    leaves: (THREE.Object3D | null)[];
    crown: THREE.Object3D | null;
}

/** Resolves the named parts once, so the frame loop is not doing name lookups. */
export function collectParts(root: THREE.Object3D): PlantParts {
    return {
        stem: root.getObjectByName(NAMES.stem) ?? null,
        leaves: LEAF_HEIGHT.map((_, i) => root.getObjectByName(NAMES.leaf(i)) ?? null),
        crown: root.getObjectByName(NAMES.crown) ?? null
    };
}

/**
 * Drives a plant's visuals from its simulation state.
 *
 * @param growth   0..1 from the simulation.
 * @param moisture 0..1; a parched plant droops and desaturates.
 * @param time     Seconds, for the idle sway. Pass a paused-aware clock so the
 *                 world visibly stops when the player pauses.
 */
export function updatePlant(parts: PlantParts, form: PlantForm, growth: number, moisture: number, time: number, phase: number): void {
    const profile = FORM[form];
    const height = lerp(0.1, profile.height, easeOut(clamp(growth, 0, 1)));
    const droop = (1 - smoothstep(0, 0.35, moisture)) * 0.28;
    const sway = Math.sin(time * 1.1 + phase) * 0.025;
    if (parts.stem) {
        const t = smoothstep(APPEAR.stem, APPEAR.stem + FADE, growth);
        parts.stem.visible = t > 0;
        parts.stem.scale.set(1, height * t, 1);
        parts.stem.rotation.z = sway + droop * 0.5;
    }
    for (let i = 0; i < parts.leaves.length; i++) {
        const leaf = parts.leaves[i];
        if (!leaf) continue;
        const appearAt = APPEAR.leaf[i] ?? 1;
        const t = smoothstep(appearAt, appearAt + FADE, growth);
        leaf.visible = t > 0;
        if (t <= 0) continue;
        leaf.position.y = height * (LEAF_HEIGHT[i] ?? 0.5);
        leaf.position.x = leaf.position.y * (sway + droop * 0.5);
        leaf.scale.setScalar(t);
        leaf.rotation.z = -droop;
    }
    if (parts.crown) {
        const t = smoothstep(APPEAR.crown, APPEAR.crown + FADE, growth);
        parts.crown.visible = t > 0;
        if (t > 0) {
            const ready = growth >= 1 ? 1 : 0;
            const bob = ready * Math.sin(time * 2 + phase) * 0.02;
            parts.crown.position.y = height + 0.06 + bob;
            parts.crown.position.x = height * (sway + droop * 0.5);
            parts.crown.scale.setScalar(t * profile.crownScale);
            parts.crown.rotation.y = time * 0.25 * ready + phase;
            parts.crown.rotation.z = -droop;
        }
    }
}
