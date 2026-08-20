export function clamp(v: number, min: number, max: number): number {
    return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/** Maps `v` from the range [a, b] onto [0, 1], clamped at both ends. */
export function invLerp(a: number, b: number, v: number): number {
    if (a === b) return 0;
    return clamp((v - a) / (b - a), 0, 1);
}

/** Smooth 0..1 ramp with zero slope at both ends. Used to fade parts in without popping. */
export function smoothstep(a: number, b: number, v: number): number {
    const t = invLerp(a, b, v);
    return t * t * (3 - 2 * t);
}

/** Decelerating ease, so plants shoot up early then settle into their final height. */
export function easeOut(t: number): number {
    return 1 - (1 - t) * (1 - t);
}
