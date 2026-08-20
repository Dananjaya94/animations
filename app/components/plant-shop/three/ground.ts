import type { PadArea, RectArea } from "../types";
import { clamp, lerp, smoothstep } from "../util/math";

/** Deterministic integer hash. Same coordinates, same ground, every load. */
function hash(ix: number, iz: number): number {
    let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smoothly interpolated value noise in 0..1. */
export function valueNoise(x: number, z: number): number {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const fx = x - x0;
    const fz = z - z0;
    const sx = fx * fx * (3 - 2 * fx);
    const sz = fz * fz * (3 - 2 * fz);
    const n00 = hash(x0, z0);
    const n10 = hash(x0 + 1, z0);
    const n01 = hash(x0, z0 + 1);
    const n11 = hash(x0 + 1, z0 + 1);
    return lerp(lerp(n00, n10, sx), lerp(n01, n11, sx), sz);
}

/** Three octaves: broad rolls, a mid ripple, and a little roughness on top. */
function fbm(x: number, z: number): number {
    return valueNoise(x * 0.021, z * 0.021) * 2.4 + valueNoise(x * 0.058 + 17.3, z * 0.058 - 9.1) * 0.9 + valueNoise(x * 0.15 - 5.2, z * 0.15 + 31.7) * 0.28 - 3.58 / 2;
}

/** 0 inside the pad, easing to 1 once clear of it. */
function padFactor(x: number, z: number, pad: PadArea): number {
    const dx = Math.max(pad.minX - x, 0, x - pad.maxX);
    const dz = Math.max(pad.minZ - z, 0, z - pad.maxZ);
    return smoothstep(0, pad.falloff, Math.hypot(dx, dz));
}

export function groundHeight(x: number, z: number, pad: PadArea | null): number {
    const h = fbm(x, z);
    return pad ? h * padFactor(x, z, pad) : h;
}

/**
 * Height of the *rendered* ground at a point — the value anything standing on
 * the terrain must use.
 *
 * `groundHeight` is the smooth underlying curve, and the mesh only samples it at
 * grid corners; between them the surface is a flat triangle. On a rise that
 * chord sits well below the curve, so anything placed with `groundHeight` floats
 * above the visible ground — with 4-unit facets, by enough to see daylight under
 * it. This reproduces the same triangulation Three's PlaneGeometry builds and
 * interpolates across the actual face.
 */
export function surfaceHeight(x: number, z: number, pad: PadArea | null): number {
    const step = 340 / 84;
    const half = 170;
    const gx = (x + half) / step;
    const gz = (z + half) / step;
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const fx = gx - ix;
    const fz = gz - iz;
    const corner = (i: number, j: number) => groundHeight(i * step - half, j * step - half, pad);
    if (fx + fz <= 1) {
        const a = corner(ix, iz);
        const b = corner(ix, iz + 1);
        return a + (corner(ix + 1, iz) - a) * fx + (b - a) * fz;
    }
    const b = corner(ix, iz + 1);
    const c = corner(ix + 1, iz + 1);
    const d = corner(ix + 1, iz);
    return c + (b - c) * (1 - fx) + (d - c) * (1 - fz);
}

/**
 * A pad that leaves the rendered ground genuinely flat across all of `area`.
 *
 * A mesh cell is only flat when *every* one of its corners is, and those corners
 * sit up to one grid step outside the area they cover. A pad sized to the
 * building itself therefore leaves the ground tilting under its own edges, where
 * the floor slab can clip through it. Build pads with this rather than by hand.
 */
export function padCovering(area: RectArea, falloff: number, margin = 0.5): PadArea {
    const overhang = 340 / 84 + margin;
    return {
        minX: area.minX - overhang,
        maxX: area.maxX + overhang,
        minZ: area.minZ - overhang,
        maxZ: area.maxZ + overhang,
        falloff
    };
}

/** True if the point sits inside the rectangle, with an optional margin. */
export function within(x: number, z: number, rect: RectArea, margin = 0): boolean {
    return x > rect.minX - margin && x < rect.maxX + margin && z > rect.minZ - margin && z < rect.maxZ + margin;
}

/** The two ends of the meadow palette. Every facet lands somewhere between. */
export const GRASS_DARK = "#5c7a42";
export const GRASS_LIGHT = "#97ac66";

/**
 * How light a facet's grass is, 0..1.
 *
 * Two octaves blended *continuously*. Quantising noise into a handful of named
 * tones instead produces large flat patches with hard, oddly rectangular
 * borders — the ground ends up looking quilted rather than grassy.
 */
export function grassBlend(x: number, z: number): number {
    return valueNoise(x * 0.045 + 11.3, z * 0.045 - 4.7) * 0.62 + valueNoise(x * 0.13 - 7.1, z * 0.13 + 3.9) * 0.38;
}

/**
 * Small per-facet variation, -1..1.
 *
 * Breaks up the smooth noise so neighbouring triangles differ slightly, which
 * is what sells the hand-faceted look at close range.
 */
export function facetJitter(x: number, z: number): number {
    return hash(Math.round(x * 3.7), Math.round(z * 3.7)) * 2 - 1;
}

/** Hollows read damper and darker; rises catch more of the low sun. */
export function slopeShade(height: number): number {
    return 1 + clamp(height * 0.06, -0.14, 0.14);
}
