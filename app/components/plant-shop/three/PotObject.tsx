"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../game/store";
import { potCapacity, WILT_THRESHOLD } from "../game/progression";
import { getSpecies, potSlot } from "../game/species";
import { clamp, lerp } from "../util/math";
import { collectParts, PlantMesh, updatePlant, type PlantParts } from "./plant";

/**
 * One pot slot in the greenhouse.
 *
 * Reactive subscriptions are deliberately limited to values that change on
 * discrete events (which species is planted, whether the slot is unlocked).
 * Growth and moisture are polled imperatively in `useFrame`, so a maturing
 * greenhouse costs zero React renders.
 */

const SOIL_DRY = new THREE.Color("#9a8264");
const SOIL_WET = new THREE.Color("#4a3527");
const CLAY = new THREE.Color("#c1714a");
const CLAY_HOVER = new THREE.Color("#e0916a");
const GLOW = new THREE.Color("#ffd166");

/**
 * Pot proportions.
 *
 * The soil is a solid plug filling the shell from just above the base up to
 * `SOIL_SURFACE_Y`, leaving a shallow indent below the rim. It has to be solid:
 * a thin disc floating mid-pot leaves a visible hollow underneath it.
 */
const RIM_Y = 0.34;
const SOIL_SURFACE_Y = 0.28;
const SOIL_HEIGHT = 0.24000000000000002;
/** How high above the plant's crown the ready-to-sell ring floats. */
const RING_LIFT = 0.55;

export function PotObject({ potId }: { potId: number }) {
    const slot = potSlot(potId);
    const speciesId = useGame((s) => s.world.pots[potId]?.plant?.speciesId ?? null);
    const unlocked = useGame((s) => potId < potCapacity(s.world.tables));
    const clickPot = useGame((s) => s.clickPot);
    const [hovered, setHovered] = useState(false);
    const plantRoot = useRef<THREE.Group>(null);
    const parts = useRef<PlantParts | null>(null);
    const soilMat = useRef<THREE.MeshStandardMaterial>(null);
    const droplet = useRef<THREE.Group>(null);
    const readyRing = useRef<THREE.Group>(null);
    const potGroup = useRef<THREE.Group>(null);

    const clayMat = useMemo(
        () =>
            new THREE.MeshStandardMaterial({
                color: CLAY.clone(),
                flatShading: true,
                roughness: 0.9,
                side: THREE.DoubleSide
            }),
        []
    );
    useEffect(() => () => clayMat.dispose(), [clayMat]);

    useEffect(() => {
        parts.current = plantRoot.current ? collectParts(plantRoot.current) : null;
    }, [speciesId]);

    useEffect(() => {
        if (!hovered) return;
        document.body.style.cursor = "pointer";
        return () => {
            document.body.style.cursor = "auto";
        };
    }, [hovered]);

    useFrame(() => {
        const world = useGame.getState().world;
        const plant = world.pots[potId]?.plant ?? null;
        const time = world.elapsed;
        const phase = potId * 1.7;
        if (soilMat.current) soilMat.current.color.lerpColors(SOIL_DRY, SOIL_WET, plant ? plant.moisture : 0.15);
        const glow = clamp(1 - (plant ? time - plant.plantedAt : Infinity) / 2, 0, 1);
        const eased = glow * glow;
        clayMat.color.lerpColors(hovered ? CLAY_HOVER : CLAY, GLOW, eased * 0.75);
        clayMat.emissive.copy(GLOW);
        // clayMat is a real Three.js material mutated imperatively every frame,
        // not React state — the react-compiler-derived immutability rule doesn't
        // model that pattern.
        // eslint-disable-next-line react-hooks/immutability
        clayMat.emissiveIntensity = eased * 1.2;
        if (plant && parts.current && speciesId) updatePlant(parts.current, getSpecies(speciesId).form, plant.growth, plant.moisture, time, phase);
        if (droplet.current) {
            const show = !!plant && plant.moisture < 0.25;
            droplet.current.visible = show;
            if (show && plant) {
                droplet.current.position.y = 0.95 + Math.sin(time * 3 + phase) * 0.05;
                const urgency = 1 - plant.moisture / WILT_THRESHOLD;
                droplet.current.scale.setScalar(lerp(0.85, 1.2, urgency));
            }
        }
        if (readyRing.current) {
            const show = !!plant && plant.growth >= 1;
            readyRing.current.visible = show;
            if (show) {
                const top = parts.current?.crown?.position.y ?? 0.8;
                readyRing.current.position.y = top + RING_LIFT + Math.sin(time * 2 + phase) * 0.04;
                readyRing.current.rotation.y = time * 1.2;
            }
        }
        if (potGroup.current) {
            const target = hovered ? 0.04 : 0;
            potGroup.current.position.y += (target - potGroup.current.position.y) * 0.2;
        }
    });

    if (!unlocked) {
        return (
            <mesh position={[slot.x, slot.y + 0.01, slot.z]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.16, 0.24, 12]} />
                <meshBasicMaterial color="#9fb0a0" transparent opacity={0.35} side={THREE.DoubleSide} />
            </mesh>
        );
    }

    return (
        <group
            position={[slot.x, slot.y, slot.z]}
            onClick={(e) => {
                e.stopPropagation();
                clickPot(potId);
            }}
            onPointerOver={(e) => {
                e.stopPropagation();
                setHovered(true);
            }}
            onPointerOut={() => setHovered(false)}
        >
            <group ref={potGroup}>
                <mesh castShadow receiveShadow position={[0, RIM_Y / 2, 0]} material={clayMat}>
                    <cylinderGeometry args={[0.25, 0.19, RIM_Y, 10, 1, true]} />
                </mesh>
                <mesh castShadow position={[0, 0.03, 0]}>
                    <cylinderGeometry args={[0.2, 0.19, 0.06, 10]} />
                    <meshStandardMaterial color="#a85c3a" flatShading roughness={0.9} />
                </mesh>
                <mesh castShadow position={[0, RIM_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} material={clayMat}>
                    <torusGeometry args={[0.245, 0.028, 6, 12]} />
                </mesh>
                <mesh receiveShadow position={[0, 0.16, 0]}>
                    <cylinderGeometry args={[0.225, 0.19, SOIL_HEIGHT, 10]} />
                    <meshStandardMaterial ref={soilMat} flatShading roughness={1} />
                </mesh>
                <group ref={plantRoot} position={[0, SOIL_SURFACE_Y, 0]}>
                    {speciesId && <PlantMesh species={getSpecies(speciesId)} />}
                </group>
                <group ref={droplet} visible={false} position={[0.3, 0.95, 0]}>
                    <mesh rotation={[Math.PI, 0, 0]}>
                        <coneGeometry args={[0.07, 0.13, 6]} />
                        <meshStandardMaterial color="#4aa3e0" flatShading emissive="#1d5f8f" />
                    </mesh>
                    <mesh position={[0, -0.07, 0]}>
                        <sphereGeometry args={[0.07, 8, 6]} />
                        <meshStandardMaterial color="#4aa3e0" flatShading emissive="#1d5f8f" />
                    </mesh>
                </group>
                <group ref={readyRing} visible={false}>
                    <mesh rotation={[-Math.PI / 2, 0, 0]}>
                        <torusGeometry args={[0.17, 0.03, 6, 12]} />
                        <meshStandardMaterial color="#f6c445" flatShading emissive="#8a6a10" emissiveIntensity={0.6} />
                    </mesh>
                </group>
            </group>
        </group>
    );
}
