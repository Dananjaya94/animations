"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../game/store";
import { potSlot } from "../game/species";

/**
 * Gold coins that erupt from a pot when its plant is sold.
 *
 * One InstancedMesh holds every coin in flight, so a busy greenhouse costs a
 * single draw call and zero React renders. The system watches `world.sales`
 * from inside `useFrame` and remembers which sale ids it has already fired.
 *
 * Motion runs on *sim* time, not wall time: coins freeze mid-air when the game
 * is paused and rain down faster at 4x, which keeps the effect part of the world
 * rather than an overlay on top of it.
 */

const MAX_COINS = 320;
/** Coins per sale, scaled by takings so an orchid feels better than a marigold. */
const MIN_PER_SALE = 10;
const MAX_PER_SALE = 34;
const GRAVITY = -7.5;
const LIFETIME = 1.9;
/** Coins vanish once they fall this far below where they spawned. */
const FLOOR_DROP = -1.5;

interface Coin {
    active: boolean;
    age: number;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    spin: number;
    spinSpeed: number;
    tilt: number;
    originY: number;
}

function makeCoin(): Coin {
    return {
        active: false,
        age: 0,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        spin: 0,
        spinSpeed: 0,
        tilt: 0,
        originY: 0
    };
}

function coinCount(amount: number): number {
    return Math.max(MIN_PER_SALE, Math.min(MAX_PER_SALE, Math.round(MIN_PER_SALE + amount / 7)));
}

export function CoinBurst() {
    const mesh = useRef<THREE.InstancedMesh>(null);
    const coins = useMemo(() => Array.from({ length: MAX_COINS }, makeCoin), []);
    const fired = useRef<Set<number>>(new Set());
    const cursor = useRef(0);
    /** Previous `world.elapsed`, for deriving a paused-aware delta. */
    const lastElapsed = useRef<number | null>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    function spawn(potId: number, amount: number) {
        const slot = potSlot(potId);
        const originY = slot.y + 0.5;
        const n = coinCount(amount);
        for (let i = 0; i < n; i++) {
            const coin = coins[cursor.current % MAX_COINS];
            cursor.current++;
            if (!coin) continue;
            const angle = Math.random() * Math.PI * 2;
            const spread = 0.5 + Math.random() * 1.5;
            // Coins are plain mutable objects driven imperatively every frame, not
            // React state — the react-compiler-derived immutability rule doesn't
            // model that pattern.
            // eslint-disable-next-line react-hooks/immutability
            coin.active = true;
            coin.age = 0;
            coin.x = slot.x + Math.cos(angle) * 0.08;
            coin.y = originY;
            coin.z = slot.z + Math.sin(angle) * 0.08;
            coin.originY = originY;
            coin.vx = Math.cos(angle) * spread;
            coin.vz = Math.sin(angle) * spread;
            coin.vy = 2.6 + Math.random() * 2.2;
            coin.spin = Math.random() * Math.PI * 2;
            coin.spinSpeed = (Math.random() - 0.5) * 18;
            coin.tilt = Math.random() * Math.PI;
        }
    }

    useFrame(() => {
        const instanced = mesh.current;
        if (!instanced) return;
        const world = useGame.getState().world;
        const previous = lastElapsed.current;
        lastElapsed.current = world.elapsed;
        const dt = previous === null ? 0 : Math.max(0, Math.min(0.1, world.elapsed - previous));
        for (const sale of world.sales) {
            if (fired.current.has(sale.id)) continue;
            fired.current.add(sale.id);
            spawn(sale.potId, sale.amount);
        }
        if (fired.current.size > 64) {
            const live = new Set(world.sales.map((s) => s.id));
            for (const id of fired.current) if (!live.has(id)) fired.current.delete(id);
        }
        let anyActive = false;
        for (let i = 0; i < MAX_COINS; i++) {
            const coin = coins[i];
            if (!coin) continue;
            if (!coin.active) {
                dummy.scale.setScalar(0);
                dummy.updateMatrix();
                instanced.setMatrixAt(i, dummy.matrix);
                continue;
            }
            anyActive = true;
            // eslint-disable-next-line react-hooks/immutability -- see spawn() above
            coin.age += dt;
            coin.vy += GRAVITY * dt;
            coin.x += coin.vx * dt;
            coin.y += coin.vy * dt;
            coin.z += coin.vz * dt;
            coin.spin += coin.spinSpeed * dt;
            coin.vx *= 1 - 1.5 * dt;
            coin.vz *= 1 - 1.5 * dt;
            if (coin.age > LIFETIME || coin.y - coin.originY < FLOOR_DROP) {
                coin.active = false;
                dummy.scale.setScalar(0);
                dummy.updateMatrix();
                instanced.setMatrixAt(i, dummy.matrix);
                continue;
            }
            const fade = Math.min(1, ((LIFETIME - coin.age) / (LIFETIME * 0.35)) ** 0.6);
            dummy.position.set(coin.x, coin.y, coin.z);
            dummy.rotation.set(coin.tilt, coin.spin, coin.spin * 0.4);
            dummy.scale.setScalar(fade);
            dummy.updateMatrix();
            instanced.setMatrixAt(i, dummy.matrix);
        }
        instanced.instanceMatrix.needsUpdate = true;
        instanced.visible = anyActive;
    });

    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, MAX_COINS]} frustumCulled={false} visible={false}>
            <cylinderGeometry args={[0.075, 0.075, 0.022, 10]} />
            <meshStandardMaterial color="#ffcf47" emissive="#a86f0d" emissiveIntensity={0.55} metalness={0.65} roughness={0.28} flatShading />
        </instancedMesh>
    );
}
