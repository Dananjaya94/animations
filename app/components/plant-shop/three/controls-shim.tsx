"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeElement } from "@react-three/fiber";
import { OrbitControls as OrbitControlsImpl } from "three/examples/jsm/controls/OrbitControls.js";
import * as THREE from "three";

/**
 * Minimal stand-in for `@react-three/drei`'s `OrbitControls` and `Billboard`.
 * The game only needs these two, so it is not worth the dependency.
 */

type OrbitControlsProps = {
    makeDefault?: boolean;
    target?: [number, number, number];
} & Partial<
    Pick<
        OrbitControlsImpl,
        "enablePan" | "enableDamping" | "dampingFactor" | "autoRotate" | "autoRotateSpeed" | "minDistance" | "maxDistance" | "minPolarAngle" | "maxPolarAngle"
    >
>;

export function OrbitControls({ makeDefault, target, ...options }: OrbitControlsProps) {
    const camera = useThree((s) => s.camera);
    const domElement = useThree((s) => s.gl.domElement);
    const set = useThree((s) => s.set);
    const get = useThree((s) => s.get);
    const controls = useMemo(() => new OrbitControlsImpl(camera, domElement), [camera, domElement]);
    useEffect(() => () => controls.dispose(), [controls]);
    useEffect(() => {
        Object.assign(controls, options);
        if (target) controls.target.set(target[0], target[1], target[2]);
        controls.update();
    });
    useEffect(() => {
        if (!makeDefault) return;
        const previous = get().controls;
        set({ controls });
        return () => set({ controls: previous });
    }, [makeDefault, controls, get, set]);
    useFrame(() => {
        controls.update();
    }, -1);
    return null;
}

/** A group that keeps facing the camera. */
export function Billboard({ children, ...props }: ThreeElement<typeof THREE.Group>) {
    const ref = useRef<THREE.Group>(null);
    useFrame((state) => {
        ref.current?.quaternion.copy(state.camera.quaternion);
    });
    return (
        <group ref={ref} {...props}>
            {children}
        </group>
    );
}
