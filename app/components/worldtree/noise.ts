// Direct TypeScript port of the classic Ashima Arts 3D simplex noise used by
// `commonNoise` in shaders.ts (same permutation/hash math, line-for-line),
// so the terrain heightmap can be baked once on the CPU (see terrain.ts)
// instead of being recomputed on the GPU for every vertex, every frame.

function gmod(x: number, m: number): number {
    return x - m * Math.floor(x / m);
}

function permute(x0: number, x1: number, x2: number, x3: number): [number, number, number, number] {
    const p = (v: number) => gmod(((v * 34.0) + 1.0) * v, 289.0);
    return [p(x0), p(x1), p(x2), p(x3)];
}

function taylorInvSqrt(r0: number, r1: number, r2: number, r3: number): [number, number, number, number] {
    const t = (r: number) => 1.79284291400159 - 0.85373472095314 * r;
    return [t(r0), t(r1), t(r2), t(r3)];
}

// GLSL step(edge, x): 0 if x < edge, else 1.
function step(edge: number, x: number): number {
    return x < edge ? 0.0 : 1.0;
}

function dot3(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
    return ax * bx + ay * by + az * bz;
}

export function snoise3(vx: number, vy: number, vz: number): number {
    const Cx = 1.0 / 6.0;
    const Cy = 1.0 / 3.0;
    const Dy = 0.5;

    const s = Cy * (vx + vy + vz);
    let ix = Math.floor(vx + s);
    let iy = Math.floor(vy + s);
    let iz = Math.floor(vz + s);

    const t = Cx * (ix + iy + iz);
    const x0x = vx - ix + t;
    const x0y = vy - iy + t;
    const x0z = vz - iz + t;

    const gx = step(x0y, x0x);
    const gy = step(x0z, x0y);
    const gz = step(x0x, x0z);
    const lx = 1.0 - gx;
    const ly = 1.0 - gy;
    const lz = 1.0 - gz;

    const i1x = Math.min(gx, lz), i1y = Math.min(gy, lx), i1z = Math.min(gz, ly);
    const i2x = Math.max(gx, lz), i2y = Math.max(gy, lx), i2z = Math.max(gz, ly);

    const x1x = x0x - i1x + Cx, x1y = x0y - i1y + Cx, x1z = x0z - i1z + Cx;
    const x2x = x0x - i2x + Cy, x2y = x0y - i2y + Cy, x2z = x0z - i2z + Cy;
    const x3x = x0x - Dy, x3y = x0y - Dy, x3z = x0z - Dy;

    ix = gmod(ix, 289.0);
    iy = gmod(iy, 289.0);
    iz = gmod(iz, 289.0);

    const p1 = permute(iz + 0.0, iz + i1z, iz + i2z, iz + 1.0);
    const p2 = permute(p1[0] + iy + 0.0, p1[1] + iy + i1y, p1[2] + iy + i2y, p1[3] + iy + 1.0);
    const p = permute(p2[0] + ix + 0.0, p2[1] + ix + i1x, p2[2] + ix + i2x, p2[3] + ix + 1.0);

    const n_ = 0.142857142857;
    const nsx = 2.0 * n_;
    const nsy = 0.5 * n_ - 1.0;
    const nsz = n_;

    const j: [number, number, number, number] = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) j[i] = p[i] - 49.0 * Math.floor(p[i] * nsz * nsz);

    const xu: [number, number, number, number] = [0, 0, 0, 0];
    const yu: [number, number, number, number] = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
        const xi = Math.floor(j[i] * nsz);
        const yi = Math.floor(j[i] - 7.0 * xi);
        xu[i] = xi * nsx + nsy;
        yu[i] = yi * nsx + nsy;
    }

    const h: [number, number, number, number] = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) h[i] = 1.0 - Math.abs(xu[i]) - Math.abs(yu[i]);

    const b0x = xu[0], b0y = xu[1], b0z = yu[0], b0w = yu[1];
    const b1x = xu[2], b1y = xu[3], b1z = yu[2], b1w = yu[3];

    const s0x = Math.floor(b0x) * 2.0 + 1.0;
    const s0y = Math.floor(b0y) * 2.0 + 1.0;
    const s0z = Math.floor(b0z) * 2.0 + 1.0;
    const s0w = Math.floor(b0w) * 2.0 + 1.0;
    const s1x = Math.floor(b1x) * 2.0 + 1.0;
    const s1y = Math.floor(b1y) * 2.0 + 1.0;
    const s1z = Math.floor(b1z) * 2.0 + 1.0;
    const s1w = Math.floor(b1w) * 2.0 + 1.0;

    const shx = -step(h[0], 0.0);
    const shy = -step(h[1], 0.0);
    const shz = -step(h[2], 0.0);
    const shw = -step(h[3], 0.0);

    const a0x = b0x + s0x * shx;
    const a0y = b0z + s0z * shx;
    const a0z = b0y + s0y * shy;
    const a0w = b0w + s0w * shy;

    const a1x = b1x + s1x * shz;
    const a1y = b1z + s1z * shz;
    const a1z = b1y + s1y * shw;
    const a1w = b1w + s1w * shw;

    let p0x = a0x, p0y = a0y, p0z = h[0];
    let p1x = a0z, p1y = a0w, p1z = h[1];
    let p2x = a1x, p2y = a1y, p2z = h[2];
    let p3x = a1z, p3y = a1w, p3z = h[3];

    const norm = taylorInvSqrt(
        dot3(p0x, p0y, p0z, p0x, p0y, p0z),
        dot3(p1x, p1y, p1z, p1x, p1y, p1z),
        dot3(p2x, p2y, p2z, p2x, p2y, p2z),
        dot3(p3x, p3y, p3z, p3x, p3y, p3z),
    );
    p0x *= norm[0]; p0y *= norm[0]; p0z *= norm[0];
    p1x *= norm[1]; p1y *= norm[1]; p1z *= norm[1];
    p2x *= norm[2]; p2y *= norm[2]; p2z *= norm[2];
    p3x *= norm[3]; p3y *= norm[3]; p3z *= norm[3];

    let m0 = Math.max(0.6 - dot3(x0x, x0y, x0z, x0x, x0y, x0z), 0.0);
    let m1 = Math.max(0.6 - dot3(x1x, x1y, x1z, x1x, x1y, x1z), 0.0);
    let m2 = Math.max(0.6 - dot3(x2x, x2y, x2z, x2x, x2y, x2z), 0.0);
    let m3 = Math.max(0.6 - dot3(x3x, x3y, x3z, x3x, x3y, x3z), 0.0);
    m0 *= m0; m1 *= m1; m2 *= m2; m3 *= m3;

    return 42.0 * (
        m0 * m0 * dot3(p0x, p0y, p0z, x0x, x0y, x0z) +
        m1 * m1 * dot3(p1x, p1y, p1z, x1x, x1y, x1z) +
        m2 * m2 * dot3(p2x, p2y, p2z, x2x, x2y, x2z) +
        m3 * m3 * dot3(p3x, p3y, p3z, x3x, x3y, x3z)
    );
}

// Matches `fbm` in shaders.ts's commonNoise chunk exactly (including the
// unused `frequency` variable there, which has no effect and is simply
// omitted here).
export function fbm3(px: number, py: number, pz: number): number {
    let value = 0.0;
    let amplitude = 0.5;
    let x = px, y = py, z = pz;
    for (let i = 0; i < 4; i++) {
        value += amplitude * snoise3(x, y, z);
        x *= 2.0; y *= 2.0; z *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}
