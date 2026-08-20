"use client";

import { useEffect, useState } from "react";
import type { RectArea, Species } from "../types";
import { useGame } from "../game/store";
import { SPECIES } from "../game/species";
import { padCovering } from "./ground";
import { Terrain, GroundCover } from "./Terrain";

/**
 * The farmer's market. One crate per species along the stall; clicking a crate
 * buys a single seed. The same purchases are available from the side panel in
 * `ui/MarketPanel.tsx` — the crates are the diegetic version of it.
 */

const STALL_WIDTH = 7.4;
const TABLE_DEPTH = 1.8;
const TABLE_Y = 0.95;
/** Crates are laid out in two rows; one row of 13 would be unreadably tight. */
const CRATE_ROW_Z = [0.45, -0.45];
/** The back row stands on a riser so it is not hidden behind the front one. */
const CRATE_ROW_Y = [0, 0.22];
const RISER_Y = 0.11;
/** Kept high, and the canopy shallow, so the crates below stay clearly in frame. */
const AWNING_Y = 3;
const AWNING_DEPTH = 2.3;
const STRIPE_A = "#e8ded0";
const STRIPE_B = "#c0503f";

/**
 * The paved square, and the levelled ground it sits on.
 *
 * Stops short of the camera (`maxZ`) on purpose: paving that ran to the bottom
 * of the frame left the whole foreground a flat empty tan slab, so the grass is
 * brought forward to meet the viewer instead.
 */
const SQUARE: RectArea = { minX: -13, maxX: 13, minZ: -14, maxZ: 5 };
const SQUARE_PAD = padCovering(SQUARE, 8);
const SQUARE_SIZE: [number, number] = [SQUARE.maxX - SQUARE.minX, SQUARE.maxZ - SQUARE.minZ];
const SQUARE_MID_Z = (SQUARE.minZ + SQUARE.maxZ) / 2;

function crateX(index: number, count: number): number {
    if (count <= 1) return 0;
    return -6.300000000000001 / 2 + (6.300000000000001 / (count - 1)) * index;
}

/**
 * Splits the catalogue into a front and back row, front row first so the
 * earliest (cheapest) seeds are the ones nearest the player.
 */
function crateRows(items: Species[]): Species[][] {
    const perRow = Math.ceil(items.length / CRATE_ROW_Z.length);
    return CRATE_ROW_Z.map((_, row) => items.slice(row * perRow, (row + 1) * perRow));
}

function SeedCrate({
    species,
    x,
    y,
    z,
    locked,
    affordable
}: {
    species: Species;
    x: number;
    y: number;
    z: number;
    locked: boolean;
    affordable: boolean;
}) {
    const buySeed = useGame((s) => s.buySeed);
    const [hovered, setHovered] = useState(false);
    const interactive = !locked && affordable;
    useEffect(() => {
        if (!hovered || !interactive) return;
        document.body.style.cursor = "pointer";
        return () => {
            document.body.style.cursor = "auto";
        };
    }, [hovered, interactive]);
    const lift = hovered && interactive ? 0.06 : 0;
    const tint = locked ? "#6d6a63" : hovered && interactive ? "#a9825a" : "#8d6b47";
    return (
        <group
            position={[x, 1.15 + y + lift, z]}
            onClick={(e) => {
                e.stopPropagation();
                if (interactive) buySeed(species.id);
            }}
            onPointerOver={(e) => {
                e.stopPropagation();
                setHovered(true);
            }}
            onPointerOut={() => setHovered(false)}
        >
            <mesh castShadow receiveShadow>
                <boxGeometry args={[0.62, 0.4, 0.62]} />
                <meshStandardMaterial color={tint} flatShading roughness={0.95} />
            </mesh>
            <mesh position={[0, 0, 0.32]}>
                <boxGeometry args={[0.64, 0.08, 0.02]} />
                <meshStandardMaterial color="#6b5236" flatShading roughness={1} />
            </mesh>
            <mesh position={[0, 0.22, 0]} castShadow>
                <icosahedronGeometry args={[0.22, 0]} />
                <meshStandardMaterial color={locked ? "#57534d" : species.palette.crown} flatShading roughness={0.8} />
            </mesh>
            {locked && (
                <group position={[0, 0.55, 0]}>
                    <mesh>
                        <boxGeometry args={[0.16, 0.14, 0.1]} />
                        <meshStandardMaterial color="#3f3d38" flatShading />
                    </mesh>
                    <mesh position={[0, 0.11, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <torusGeometry args={[0.06, 0.018, 5, 8, Math.PI]} />
                        <meshStandardMaterial color="#3f3d38" flatShading />
                    </mesh>
                </group>
            )}
        </group>
    );
}

function Stall() {
    const stripes = Array.from({ length: 8 }, (_, i) => i);
    const stripeW = 8.200000000000001 / stripes.length;
    return (
        <group>
            <mesh position={[0, TABLE_Y, 0]} castShadow receiveShadow>
                <boxGeometry args={[STALL_WIDTH, 0.14, TABLE_DEPTH]} />
                <meshStandardMaterial color="#8a6d4d" flatShading roughness={0.95} />
            </mesh>
            <mesh position={[0, 1.06, CRATE_ROW_Z[1] ?? -0.45]} castShadow receiveShadow>
                <boxGeometry args={[7.1000000000000005, RISER_Y * 2, 0.75]} />
                <meshStandardMaterial color="#7a5f42" flatShading roughness={0.95} />
            </mesh>
            <mesh position={[0, TABLE_Y / 2 - 0.06, TABLE_DEPTH / 2 - 0.03]} receiveShadow>
                <boxGeometry args={[7.2, 0.83, 0.06]} />
                <meshStandardMaterial color="#5c7350" flatShading roughness={1} />
            </mesh>
            {[-1, 1].map((sx) =>
                [-1, 1].map((sz) => (
                    <mesh key={`${sx}:${sz}`} position={[(sx * 7.800000000000001) / 2, AWNING_Y / 2, sz * 0.9]} castShadow>
                        <cylinderGeometry args={[0.06, 0.06, AWNING_Y, 6]} />
                        <meshStandardMaterial color="#6b5236" flatShading roughness={0.95} />
                    </mesh>
                ))
            )}
            <group position={[0, AWNING_Y, -0.35]} rotation={[0.24, 0, 0]}>
                {stripes.map((i) => (
                    <mesh key={i} position={[-8.200000000000001 / 2 + stripeW * (i + 0.5), 0, 0]} castShadow>
                        <boxGeometry args={[stripeW, 0.07, AWNING_DEPTH]} />
                        <meshStandardMaterial color={i % 2 === 0 ? STRIPE_A : STRIPE_B} flatShading roughness={0.95} />
                    </mesh>
                ))}
            </group>
        </group>
    );
}

/** Low-detail stalls behind the player's, purely to give the square some depth. */
function BackdropStalls() {
    const stalls = [
        { x: -9, z: -7.5, color: "#b4634f" },
        { x: -1, z: -10, color: "#5f7f8c" },
        { x: 8, z: -8, color: "#8a7a4f" }
    ];
    return (
        <group>
            {stalls.map((s, i) => (
                <group key={i} position={[s.x, 0, s.z]}>
                    <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
                        <boxGeometry args={[3.4, 0.12, 1.2]} />
                        <meshStandardMaterial color="#8a6d4d" flatShading roughness={1} />
                    </mesh>
                    <mesh position={[0, 2.1, 0]} rotation={[-0.15, 0, 0]} castShadow>
                        <boxGeometry args={[3.8, 0.08, 1.8]} />
                        <meshStandardMaterial color={s.color} flatShading roughness={1} />
                    </mesh>
                    {[-1.6, 1.6].map((x) => (
                        <mesh key={x} position={[x, 1.05, 0]} castShadow>
                            <cylinderGeometry args={[0.05, 0.05, 2.1, 5]} />
                            <meshStandardMaterial color="#6b5236" flatShading roughness={1} />
                        </mesh>
                    ))}
                </group>
            ))}
        </group>
    );
}

/** Barrels and sacks around the stall, so the square doesn't read as an empty plain. */
function GroundClutter() {
    const barrels: [number, number][] = [
        [-5.2, 0.6],
        [-4.8, 1.4],
        [5.6, 0.9]
    ];
    const crates: [number, number, number][] = [
        [-4.3, 2.2, 0.5],
        [5, 2, -0.3]
    ];
    return (
        <group>
            {barrels.map(([x, z], i) => (
                <mesh key={`b${i}`} position={[x ?? 0, 0.32, z ?? 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.32, 0.28, 0.64, 8]} />
                    <meshStandardMaterial color="#7d5f3f" flatShading roughness={1} />
                </mesh>
            ))}
            {crates.map(([x, z, r], i) => (
                <mesh key={`s${i}`} position={[x ?? 0, 0.22, z ?? 0]} rotation={[0, r ?? 0, 0.08]} castShadow receiveShadow>
                    <boxGeometry args={[0.55, 0.44, 0.4]} />
                    <meshStandardMaterial color="#a8946f" flatShading roughness={1} />
                </mesh>
            ))}
        </group>
    );
}

export function Market() {
    const level = useGame((s) => s.world.level);
    const money = useGame((s) => s.world.money);
    return (
        <group>
            <Terrain pad={SQUARE_PAD} />
            <GroundCover pad={SQUARE_PAD} exclude={SQUARE} radius={44} tufts={1400} flowers={160} />
            <mesh position={[0, -0.06, SQUARE_MID_Z]} receiveShadow>
                <boxGeometry args={[SQUARE_SIZE[0], 0.2, SQUARE_SIZE[1]]} />
                <meshStandardMaterial color="#b3a894" flatShading roughness={1} />
            </mesh>
            <Stall />
            <GroundClutter />
            <BackdropStalls />
            {crateRows(SPECIES).map((row, rowIndex) =>
                row.map((species, i) => (
                    <SeedCrate
                        key={species.id}
                        species={species}
                        x={crateX(i, row.length)}
                        y={CRATE_ROW_Y[rowIndex] ?? 0}
                        z={CRATE_ROW_Z[rowIndex] ?? 0}
                        locked={species.unlockLevel > level}
                        affordable={species.seedCost <= money}
                    />
                ))
            )}
        </group>
    );
}
