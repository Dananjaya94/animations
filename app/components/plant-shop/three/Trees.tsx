"use client";

import { useMemo } from "react";
import type { PadArea } from "../types";
import { surfaceHeight } from "./ground";

/**
 * A ring of low-poly trees around the greenhouse.
 *
 * Positions come from a seeded PRNG rather than `Math.random`, so the treeline
 * is identical on every load — a scene that reshuffles itself on refresh reads
 * as a bug.
 */

/** Deterministic 32-bit PRNG. Same seed, same forest, every time. */
function mulberry32(seed: number): () => number {
    let a = seed;
    return () => {
        a = (a + 1831565813) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const COUNT = 44;
/** How many small trees form the distant silhouette on the horizon. */
const DISTANT_COUNT = 60;
/** Keep-out box around the greenhouse and its approach. */
const CLEAR_X = 7.5;
const CLEAR_Z = 6.5;
/**
 * Open meadow behind the greenhouse.
 *
 * The default camera looks this way, and without a gap here the near trees fill
 * the entire upper frame — you would never see the sunset or the clouds. The
 * distant treeline still closes off the horizon, so it reads as a clearing at
 * the edge of a wood rather than a hole in the scenery.
 */
const MEADOW_Z = -4;
const MEADOW_HALF_X = 20;
const CANOPY = ["#3c5c41", "#48704a", "#33553b", "#527a4c"];
const CANOPY_WARM = ["#5d7040", "#6a7b46"];

interface TreeSpec {
    x: number;
    z: number;
    scale: number;
    spin: number;
    conifer: boolean;
    tone: number;
}

function buildForest(): TreeSpec[] {
    const rand = mulberry32(24301);
    const trees: TreeSpec[] = [];
    let guard = 0;
    while (trees.length < COUNT && guard++ < 2640) {
        const angle = rand() * Math.PI * 2;
        const radius = 12 + Math.sqrt(rand()) * 26;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        if (Math.abs(x) < CLEAR_X && Math.abs(z) < CLEAR_Z) continue;
        if (z < MEADOW_Z && Math.abs(x) < MEADOW_HALF_X) continue;
        trees.push({ x, z, scale: 0.75 + rand() * 0.9, spin: rand() * Math.PI * 2, conifer: rand() < 0.55, tone: rand() });
    }
    for (let i = 0; i < DISTANT_COUNT; i++) {
        const angle = rand() * Math.PI * 2;
        const radius = 60 + rand() * 35;
        trees.push({
            x: Math.cos(angle) * radius,
            z: Math.sin(angle) * radius,
            scale: 0.6 + rand() * 0.6,
            spin: rand() * Math.PI * 2,
            conifer: rand() < 0.55,
            tone: rand()
        });
    }
    return trees;
}

function Tree({ spec, pad }: { spec: TreeSpec; pad: PadArea | null }) {
    const palette = spec.tone > 0.78 ? CANOPY_WARM : CANOPY;
    const color = palette[Math.floor(spec.tone * palette.length) % palette.length] ?? CANOPY[0];
    return (
        <group position={[spec.x, surfaceHeight(spec.x, spec.z, pad) - 0.08, spec.z]} rotation={[0, spec.spin, 0]} scale={spec.scale}>
            <mesh position={[0, 1, 0]} castShadow>
                <cylinderGeometry args={[0.16, 0.24, 2, 6]} />
                <meshStandardMaterial color="#4a3728" flatShading roughness={1} />
            </mesh>
            {spec.conifer
                ? [0, 1, 2].map((i) => (
                      <mesh key={i} position={[0, 2 + i * 1.05, 0]} castShadow>
                          <coneGeometry args={[1.35 - i * 0.34, 1.7, 6]} />
                          <meshStandardMaterial color={color} flatShading roughness={1} />
                      </mesh>
                  ))
                : (
                      [
                          [0, 2.9, 0, 1.5],
                          [0.8, 2.4, 0.3, 1.05],
                          [-0.7, 2.5, -0.4, 1.15]
                      ] as [number, number, number, number][]
                  ).map(([dx, dy, dz, r], i) => (
                      <mesh key={i} position={[dx ?? 0, dy ?? 0, dz ?? 0]} castShadow>
                          <icosahedronGeometry args={[r ?? 1.2, 0]} />
                          <meshStandardMaterial color={color} flatShading roughness={1} />
                      </mesh>
                  ))}
        </group>
    );
}

export function Trees({ pad = null }: { pad?: PadArea | null }) {
    const forest = useMemo(() => buildForest(), []);
    return (
        <group>
            {forest.map((spec, i) => (
                <Tree key={i} spec={spec} pad={pad} />
            ))}
        </group>
    );
}
