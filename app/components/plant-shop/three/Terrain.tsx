"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { PadArea, RectArea } from "../types";
import { GRASS_DARK, GRASS_LIGHT, facetJitter, grassBlend, groundHeight, slopeShade, surfaceHeight, valueNoise, within } from "./ground";

/**
 * Low-poly ground.
 *
 * Built as one displaced plane, converted to **non-indexed** geometry so each
 * triangle owns its three vertices and can be given a single flat colour. That
 * faceting is the whole point: an indexed mesh would smear the palette across
 * shared vertices and the ground would read as a smooth gradient instead of a
 * field of facets, which is the look everything else in the scene uses.
 */
function buildTerrain(pad: PadArea | null): THREE.BufferGeometry {
    const plane = new THREE.PlaneGeometry(340, 340, 84, 84);
    plane.rotateX(-Math.PI / 2);
    const position = plane.attributes.position;
    for (let i = 0; i < position.count; i++) position.setY(i, groundHeight(position.getX(i), position.getZ(i), pad));
    const geometry = plane.toNonIndexed();
    plane.dispose();
    geometry.computeVertexNormals();
    const points = geometry.attributes.position;
    const colors = new Float32Array(points.count * 3);
    const colour = new THREE.Color();
    const dark = new THREE.Color(GRASS_DARK);
    const light = new THREE.Color(GRASS_LIGHT);
    for (let v = 0; v < points.count; v += 3) {
        const cx = (points.getX(v) + points.getX(v + 1) + points.getX(v + 2)) / 3;
        const cy = (points.getY(v) + points.getY(v + 1) + points.getY(v + 2)) / 3;
        const cz = (points.getZ(v) + points.getZ(v + 1) + points.getZ(v + 2)) / 3;
        colour.copy(dark).lerp(light, grassBlend(cx, cz)).multiplyScalar(slopeShade(cy) + facetJitter(cx, cz) * 0.045);
        for (let k = 0; k < 3; k++) {
            colors[(v + k) * 3] = colour.r;
            colors[(v + k) * 3 + 1] = colour.g;
            colors[(v + k) * 3 + 2] = colour.b;
        }
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
}

export function Terrain({ pad = null }: { pad?: PadArea | null }) {
    const geometry = useMemo(() => buildTerrain(pad), [pad]);
    useEffect(() => () => geometry.dispose(), [geometry]);
    return (
        <mesh geometry={geometry} receiveShadow>
            <meshStandardMaterial vertexColors flatShading roughness={1} />
        </mesh>
    );
}

const TUFT_TONES = ["#7fa055", "#8cae5f", "#6f9049", "#98b768"];
const FLOWER_TONES = ["#f2e6a0", "#f6f2e6", "#e8a0c0", "#f0c05a"];
/** How tall a wildflower's stem is at scale 1. */
const FLOWER_STEM = 0.28;

/**
 * Scattered grass tufts and wildflowers, close in where the camera can see
 * them. Three InstancedMeshes — blades, stems, blooms — so all of it costs
 * three draw calls.
 *
 * Everything sits on `surfaceHeight`, and skips `exclude` so nothing sprouts
 * through the greenhouse floor.
 */
export function GroundCover({
    pad = null,
    exclude,
    radius = 34,
    tufts = 2400,
    flowers = 220
}: {
    pad?: PadArea | null;
    exclude?: RectArea;
    radius?: number;
    tufts?: number;
    flowers?: number;
}) {
    const { tuftMesh, stemMesh, flowerMesh } = useMemo(() => {
        const matrix = new THREE.Matrix4();
        const colour = new THREE.Color();
        const offset = new THREE.Vector3();
        const rotation = new THREE.Quaternion();
        const euler = new THREE.Euler();
        const size = new THREE.Vector3();

        /**
         * Places `count` instances in clumps, returning how many actually landed.
         *
         * Clumped rather than evenly scattered because grass grows that way — an
         * even spread reads as a regular field of identical spikes.
         *
         * Every mesh in `meshes` receives the same transform, so a plant built from
         * separate parts (a stem and a bloom that need different colours) stays
         * assembled. Only `tinted` gets per-instance colour.
         */
        function scatter(
            meshes: THREE.InstancedMesh[],
            tinted: THREE.InstancedMesh,
            count: number,
            seed: number,
            tones: string[],
            lift: number,
            scaleRange: [number, number],
            perClump: number,
            spread: number
        ) {
            let placed = 0;
            for (let i = 0; placed < count && i < count * 6; i++) {
                const a = valueNoise(i * 0.37 + seed, i * 0.11 - seed) * Math.PI * 2;
                const r = Math.sqrt(valueNoise(i * 0.19 - seed, i * 0.53 + seed)) * radius;
                const cx = Math.cos(a) * r;
                const cz = Math.sin(a) * r;
                for (let k = 0; k < perClump && placed < count; k++) {
                    const j = valueNoise(cx * 6.1 + k * 3.7 + seed, cz * 6.1 - k * 1.9);
                    const angle = j * Math.PI * 2 + k * 2.399;
                    const x = cx + Math.cos(angle) * (0.1 + j * spread);
                    const z = cz + Math.sin(angle) * (0.1 + j * spread);
                    if (exclude && within(x, z, exclude, 0.4)) continue;
                    const scale = scaleRange[0] + j * (scaleRange[1] - scaleRange[0]);
                    euler.set((j - 0.5) * 0.5, angle * 2, (0.5 - j) * 0.5);
                    matrix.compose(offset.set(x, surfaceHeight(x, z, pad) + lift * scale, z), rotation.setFromEuler(euler), size.set(scale, scale, scale));
                    for (const mesh of meshes) mesh.setMatrixAt(placed, matrix);
                    const tone = tones[Math.floor(j * tones.length) % tones.length] ?? tones[0];
                    tinted.setColorAt(placed, colour.set(tone));
                    placed++;
                }
            }
            for (const mesh of meshes) {
                mesh.count = placed;
                mesh.instanceMatrix.needsUpdate = true;
                if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
            }
        }

        const blade = new THREE.ConeGeometry(0.055, 0.34, 3);
        const tuftMesh = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 }), tufts);
        tuftMesh.castShadow = true;
        scatter([tuftMesh], tuftMesh, tufts, 3.7, TUFT_TONES, 0.15, [0.6, 1.25], 6, 0.55);

        const stem = new THREE.CylinderGeometry(0.012, 0.016, FLOWER_STEM, 4);
        stem.translate(0, FLOWER_STEM / 2, 0);
        const stemMesh = new THREE.InstancedMesh(stem, new THREE.MeshStandardMaterial({ color: "#6b8f4a", flatShading: true, roughness: 1 }), flowers);

        const bloom = new THREE.IcosahedronGeometry(0.065, 0);
        bloom.translate(0, 0.31000000000000005, 0);
        const flowerMesh = new THREE.InstancedMesh(bloom, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), flowers);
        scatter([stemMesh, flowerMesh], flowerMesh, flowers, 11.3, FLOWER_TONES, 0, [0.8, 1.3], 2, 0.9);

        return { tuftMesh, stemMesh, flowerMesh };
    }, [pad, exclude, radius, tufts, flowers]);

    useEffect(
        () => () => {
            for (const mesh of [tuftMesh, stemMesh, flowerMesh]) {
                mesh.geometry.dispose();
                (mesh.material as THREE.Material).dispose();
            }
        },
        [tuftMesh, stemMesh, flowerMesh]
    );

    return (
        <>
            <primitive object={tuftMesh} />
            <primitive object={stemMesh} />
            <primitive object={flowerMesh} />
        </>
    );
}
