"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { PadArea, RectArea } from "../types";
import { useGame } from "../game/store";
import { BENCH_DEPTH, BENCH_TOP_Y, BENCH_WIDTH, greenhouseBackZ, greenhouseFrontZ, tableZ } from "../game/species";
import { lerp, smoothstep } from "../util/math";
import { padCovering } from "./ground";
import { Terrain, GroundCover } from "./Terrain";
import { Trees } from "./Trees";
import { PotObject } from "./PotObject";
import { CoinBurst } from "./CoinBurst";

/**
 * The greenhouse shell and furniture. Purely decorative — the only interactive
 * objects in here are the pots.
 *
 * Its length is derived from how many tables the player owns, so buying an
 * expansion physically extends the building away from the camera.
 */

const WIDTH = 8;
const WALL_H = 2.6;
const RIDGE_H = 3.7;
const WOOD = "#7d6247";
const WOOD_DARK = "#5e4933";
const HALF_W = WIDTH / 2;
const ROOF_RUN = Math.hypot(HALF_W, 1.1);
const ROOF_ANGLE = Math.atan2(1.1, HALF_W);
/** Roughly how far apart to space glazing bars and rafters along the length. */
const BAR_SPACING = 2;

/** Evenly spaced positions between two ends, excluding the ends themselves. */
function interior(from: number, to: number, spacing: number): number[] {
    const lo = Math.min(from, to);
    const span = Math.abs(to - from);
    const count = Math.max(1, Math.round(span / spacing) - 1);
    const step = span / (count + 1);
    return Array.from({ length: count }, (_, i) => lo + step * (i + 1));
}

type FaceId = "front" | "back" | "left" | "right" | "roofL" | "roofR";

const FACE_IDS: FaceId[] = ["front", "back", "left", "right", "roofL", "roofR"];

interface Face {
    center: [number, number, number];
    normal: [number, number, number];
    roof: boolean;
}

function buildFaces(frontZ: number, backZ: number): Record<FaceId, Face> {
    const midZ = (frontZ + backZ) / 2;
    const roofY = 6.300000000000001 / 2;
    return {
        front: { center: [0, WALL_H / 2, frontZ], normal: [0, 0, 1], roof: false },
        back: { center: [0, WALL_H / 2, backZ], normal: [0, 0, -1], roof: false },
        left: { center: [-HALF_W, WALL_H / 2, midZ], normal: [-1, 0, 0], roof: false },
        right: { center: [HALF_W, WALL_H / 2, midZ], normal: [1, 0, 0], roof: false },
        roofL: { center: [-HALF_W / 2, roofY, midZ], normal: [-Math.sin(ROOF_ANGLE), Math.cos(ROOF_ANGLE), 0], roof: true },
        roofR: { center: [HALF_W / 2, roofY, midZ], normal: [Math.sin(ROOF_ANGLE), Math.cos(ROOF_ANGLE), 0], roof: true }
    };
}

const GLASS_BASE = 0.22;
const GLASS_CLEAR = 0.03;
/** Timber never goes fully clear — the greenhouse should keep its silhouette. */
const WOOD_BASE = 1;
const WOOD_CLEAR = 0.26;

interface FadeTag {
    faces: FaceId[];
    base: number;
    clear: number;
}

/** Builds the `userData` payload the fade pass looks for. */
function fades(faces: FaceId[], base = WOOD_BASE, clear = WOOD_CLEAR): { fade: FadeTag } {
    return { fade: { faces, base, clear } };
}
const glassFade = (faces: FaceId[]) => fades(faces, GLASS_BASE, GLASS_CLEAR);

interface FadeEntry {
    mesh: THREE.Mesh;
    material: THREE.Material & { opacity: number; transparent: boolean; depthWrite: boolean };
    tag: FadeTag;
}

/**
 * Fades whichever faces stand between the camera and the plants.
 *
 * Uses how squarely each face is turned towards the camera rather than raw
 * distance: two faces can be near-equidistant when orbiting past a corner, and a
 * nearest-wins rule would visibly flicker between them.
 */
function useFaceFade(root: React.RefObject<THREE.Group | null>, faces: Record<FaceId, Face>, revision: number) {
    const camera = useThree((s) => s.camera);
    const entries = useRef<FadeEntry[]>([]);
    const targets = useRef<Record<FaceId, number>>({ front: 0, back: 0, left: 0, right: 0, roofL: 0, roofR: 0 });
    const toCamera = useMemo(() => new THREE.Vector3(), []);
    const center = useMemo(() => new THREE.Vector3(), []);
    const normal = useMemo(() => new THREE.Vector3(), []);

    useEffect(() => {
        const group = root.current;
        if (!group) return;
        const found: FadeEntry[] = [];
        group.traverse((object) => {
            const mesh = object as THREE.Mesh;
            const tag = mesh.userData.fade as FadeTag | undefined;
            if (!mesh.isMesh || !tag) return;
            const material = mesh.material as FadeEntry["material"];
            material.transparent = true;
            found.push({ mesh, material, tag });
        });
        entries.current = found;
        // `revision` (the table count) is a deliberate dependency: it forces a
        // re-scan whenever the geometry it drives is rebuilt, even though the
        // effect body never reads it directly.
    }, [root, revision]);

    useFrame(() => {
        for (const id of FACE_IDS) {
            const face = faces[id];
            center.set(...face.center);
            normal.set(...face.normal);
            toCamera.copy(camera.position).sub(center).normalize();
            const facing = toCamera.dot(normal);
            targets.current[id] = face.roof ? smoothstep(0, 0.35, facing) : smoothstep(0.1, 0.8, facing);
        }
        for (const entry of entries.current) {
            let t = 0;
            for (const id of entry.tag.faces) t = Math.max(t, targets.current[id]);
            const target = lerp(entry.tag.base, entry.tag.clear, t);
            const opacity = entry.material.opacity + (target - entry.material.opacity) * 0.15;
            // entry.material is a real Three.js material collected by the effect
            // above and mutated imperatively every frame, not React state — the
            // react-compiler-derived immutability rule doesn't model that pattern.
            // eslint-disable-next-line react-hooks/immutability
            entry.material.opacity = opacity;
            const solid = opacity > 0.95;
            entry.material.depthWrite = solid;
            entry.mesh.castShadow = opacity > 0.55;
        }
    });
}

function Beam({
    position,
    size,
    rotation,
    color = WOOD,
    faces
}: {
    position: [number, number, number];
    size: [number, number, number];
    rotation?: [number, number, number];
    color?: string;
    faces?: FaceId[];
}) {
    return (
        <mesh position={position} rotation={rotation ?? [0, 0, 0]} castShadow userData={faces ? fades(faces) : {}}>
            <boxGeometry args={size} />
            <meshStandardMaterial color={color} flatShading roughness={0.9} />
        </mesh>
    );
}

/** One bench: the physical table an expansion buys. */
function Bench({ z }: { z: number }) {
    const topY = BENCH_TOP_Y - 0.07;
    const legInset = BENCH_WIDTH / 2 - 0.35;
    return (
        <group position={[0, 0, z]}>
            <mesh position={[0, topY, 0]} castShadow receiveShadow>
                <boxGeometry args={[BENCH_WIDTH, 0.14, BENCH_DEPTH]} />
                <meshStandardMaterial color={WOOD} flatShading roughness={0.95} />
            </mesh>
            {[-legInset, legInset].map((x) =>
                [-0.4, 0.4].map((dz) => (
                    <mesh key={`${x}:${dz}`} position={[x, (BENCH_TOP_Y - 0.14) / 2, dz]} castShadow>
                        <boxGeometry args={[0.14, BENCH_TOP_Y - 0.14, 0.14]} />
                        <meshStandardMaterial color={WOOD_DARK} flatShading roughness={0.95} />
                    </mesh>
                ))
            )}
            <mesh position={[0, 0.22, 0]} receiveShadow>
                <boxGeometry args={[BENCH_WIDTH - 0.2, 0.06, BENCH_DEPTH - 0.35]} />
                <meshStandardMaterial color={WOOD_DARK} flatShading roughness={0.95} />
            </mesh>
        </group>
    );
}

function WateringCan({ position }: { position: [number, number, number] }) {
    return (
        <group position={position} rotation={[0, 0.6, 0]}>
            <mesh castShadow>
                <cylinderGeometry args={[0.13, 0.15, 0.24, 8]} />
                <meshStandardMaterial color="#7fa8b5" flatShading roughness={0.6} metalness={0.3} />
            </mesh>
            <mesh castShadow position={[0.2, 0.06, 0]} rotation={[0, 0, -0.5]}>
                <cylinderGeometry args={[0.03, 0.05, 0.32, 6]} />
                <meshStandardMaterial color="#7fa8b5" flatShading roughness={0.6} metalness={0.3} />
            </mesh>
            <mesh castShadow position={[-0.14, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.09, 0.02, 5, 8, Math.PI]} />
                <meshStandardMaterial color="#7fa8b5" flatShading roughness={0.6} metalness={0.3} />
            </mesh>
        </group>
    );
}

function SoilSack({ position }: { position: [number, number, number] }) {
    return (
        <mesh position={position} rotation={[0, 0.4, 0.1]} castShadow receiveShadow>
            <boxGeometry args={[0.5, 0.34, 0.32]} />
            <meshStandardMaterial color="#6b5a48" flatShading roughness={1} />
        </mesh>
    );
}

export function Greenhouse() {
    const root = useRef<THREE.Group>(null);
    const tables = useGame((s) => s.world.tables);
    const frontZ = greenhouseFrontZ();
    const backZ = greenhouseBackZ(tables);
    const depth = frontZ - backZ;
    const midZ = (frontZ + backZ) / 2;
    useFaceFade(root, useMemo(() => buildFaces(frontZ, backZ), [frontZ, backZ]), tables);

    const footprint: RectArea = useMemo(
        () => ({ minX: -(WIDTH + 1) / 2, maxX: (WIDTH + 1) / 2, minZ: backZ - 0.5, maxZ: frontZ + 0.5 }),
        [backZ, frontZ]
    );
    const pad: PadArea = useMemo(() => padCovering(footprint, 5), [footprint]);
    const gable = useMemo(() => {
        const shape = new THREE.Shape();
        shape.moveTo(-HALF_W, WALL_H);
        shape.lineTo(HALF_W, WALL_H);
        shape.lineTo(0, RIDGE_H);
        shape.closePath();
        return new THREE.ShapeGeometry(shape);
    }, []);

    const glass = (
        <meshStandardMaterial color="#c8e6ee" transparent opacity={GLASS_BASE} roughness={0.08} metalness={0} side={THREE.DoubleSide} depthWrite={false} />
    );

    const wallBars = interior(-HALF_W, HALF_W, BAR_SPACING);
    const lengthBars = interior(backZ, frontZ, BAR_SPACING);
    const rafters = interior(backZ, frontZ, 2.4);

    return (
        <group ref={root}>
            <Terrain pad={pad} />
            <GroundCover pad={pad} exclude={footprint} />
            <Trees pad={pad} />

            <mesh position={[0, -0.06, midZ]} receiveShadow>
                <boxGeometry args={[WIDTH + 1, 0.2, depth + 1]} />
                <meshStandardMaterial color="#9c9081" flatShading roughness={1} />
            </mesh>
            {[-3.5, 3.5].map((x) => (
                <mesh key={x} position={[x, 0.05, midZ]} receiveShadow>
                    <boxGeometry args={[1.1, 0.02, depth]} />
                    <meshStandardMaterial color="#b3a795" flatShading roughness={1} />
                </mesh>
            ))}

            <mesh position={[0, WALL_H / 2, frontZ]} userData={glassFade(["front"])}>
                <planeGeometry args={[WIDTH, WALL_H]} />
                {glass}
            </mesh>
            <mesh position={[0, WALL_H / 2, backZ]} userData={glassFade(["back"])}>
                <planeGeometry args={[WIDTH, WALL_H]} />
                {glass}
            </mesh>
            <mesh position={[-HALF_W, WALL_H / 2, midZ]} rotation={[0, Math.PI / 2, 0]} userData={glassFade(["left"])}>
                <planeGeometry args={[depth, WALL_H]} />
                {glass}
            </mesh>
            <mesh position={[HALF_W, WALL_H / 2, midZ]} rotation={[0, Math.PI / 2, 0]} userData={glassFade(["right"])}>
                <planeGeometry args={[depth, WALL_H]} />
                {glass}
            </mesh>
            <mesh geometry={gable} position={[0, 0, backZ]} userData={glassFade(["back"])}>
                {glass}
            </mesh>
            <mesh geometry={gable} position={[0, 0, frontZ]} userData={glassFade(["front"])}>
                {glass}
            </mesh>
            <mesh position={[-HALF_W / 2, 6.300000000000001 / 2, midZ]} rotation={[0, 0, ROOF_ANGLE]} userData={glassFade(["roofL"])}>
                <boxGeometry args={[ROOF_RUN, 0.03, depth]} />
                {glass}
            </mesh>
            <mesh position={[HALF_W / 2, 6.300000000000001 / 2, midZ]} rotation={[0, 0, -ROOF_ANGLE]} userData={glassFade(["roofR"])}>
                <boxGeometry args={[ROOF_RUN, 0.03, depth]} />
                {glass}
            </mesh>

            {[-HALF_W, HALF_W].map((x) =>
                [backZ, frontZ].map((z) => (
                    <Beam
                        key={`${x}:${z}`}
                        position={[x, WALL_H / 2, z]}
                        size={[0.12, WALL_H, 0.12]}
                        faces={[x < 0 ? "left" : "right", z < midZ ? "back" : "front"]}
                    />
                ))
            )}
            {[backZ, frontZ].map((z) => {
                const face: FaceId = z < midZ ? "back" : "front";
                return (
                    <group key={z}>
                        <Beam position={[0, WALL_H, z]} size={[WIDTH + 0.12, 0.12, 0.12]} faces={[face]} />
                        <Beam position={[0, 0.06, z]} size={[WIDTH + 0.12, 0.12, 0.12]} faces={[face]} />
                    </group>
                );
            })}
            {[-HALF_W, HALF_W].map((x) => {
                const face: FaceId = x < 0 ? "left" : "right";
                return (
                    <group key={x}>
                        <Beam position={[x, WALL_H, midZ]} size={[0.12, 0.12, depth]} faces={[face]} />
                        <Beam position={[x, 0.06, midZ]} size={[0.12, 0.12, depth]} faces={[face]} />
                    </group>
                );
            })}
            {wallBars.map((x) =>
                [backZ, frontZ].map((z) => (
                    <Beam key={`mz${x}:${z}`} position={[x, WALL_H / 2, z]} size={[0.07, WALL_H, 0.07]} faces={[z < midZ ? "back" : "front"]} />
                ))
            )}
            {lengthBars.map((z) =>
                [-HALF_W, HALF_W].map((x) => (
                    <Beam key={`mx${x}:${z}`} position={[x, WALL_H / 2, z]} size={[0.07, WALL_H, 0.07]} faces={[x < 0 ? "left" : "right"]} />
                ))
            )}
            <Beam position={[0, RIDGE_H, midZ]} size={[0.14, 0.14, depth + 0.12]} color={WOOD_DARK} faces={["roofL", "roofR"]} />
            {[backZ + 0.4, ...rafters, frontZ - 0.4].map((z) =>
                [-1, 1].map((side) => (
                    <Beam
                        key={`${z}:${side}`}
                        position={[(side * HALF_W) / 2, 6.300000000000001 / 2, z]}
                        size={[ROOF_RUN, 0.08, 0.08]}
                        rotation={[0, 0, -side * ROOF_ANGLE]}
                        faces={[side < 0 ? "roofL" : "roofR"]}
                    />
                ))
            )}

            {Array.from({ length: tables }, (_, i) => (
                <Bench key={i} z={tableZ(i)} />
            ))}
            <WateringCan position={[3.4, 0.12, frontZ - 0.9]} />
            <SoilSack position={[-3.3, 0.17, frontZ - 0.8]} />
            <SoilSack position={[-3.2, 0.17, frontZ - 1.3]} />
            {Array.from({ length: 40 }, (_, i) => (i < tables * 5 ? <PotObject key={i} potId={i} /> : null))}
            <CoinBurst />
        </group>
    );
}
