import * as THREE from 'three';
import { fbm3 } from './noise';

function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
}

// pos*0.008 + (0, 10, 0), then fbm*45 — matches terrainVertexShader's `height` term exactly.
function heightAt(x: number, y: number, z: number): number {
    return fbm3(x * 0.008, y * 0.008 + 10.0, z * 0.008) * 45.0;
}

/**
 * Builds the ground plane with the rolling-hill displacement, per-vertex
 * normal, and crevice-shadow height baked in once on the CPU — the same
 * math the terrain vertex shader used to redo for every vertex, every
 * frame. The shader now just passes these through (see shaders.ts).
 */
export function bakeTerrainGeometry(): THREE.BufferGeometry {
    const geo = new THREE.PlaneGeometry(2000, 2000, 128, 128);
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const count = posAttr.count;

    const noiseHeights = new Float32Array(count);
    const bakedNormals = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        const localX = posAttr.getX(i);
        const localY = posAttr.getY(i);

        const height = heightAt(localX, localY, 0);
        const centerDist = Math.sqrt(localX * localX + localY * localY);
        const flatten = smoothstep(10, 80, centerDist);
        const displacedZ = height * flatten;

        posAttr.setZ(i, displacedZ);
        noiseHeights[i] = height;

        const hL = heightAt(localX - 1, localY, displacedZ) * flatten;
        const hR = heightAt(localX + 1, localY, displacedZ) * flatten;
        const hD = heightAt(localX, localY - 1, displacedZ) * flatten;
        const hU = heightAt(localX, localY + 1, displacedZ) * flatten;

        let nx = hL - hR;
        const ny = 2.0;
        let nz = hD - hU;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        nx /= len; nz /= len;

        bakedNormals[i * 3] = nx;
        bakedNormals[i * 3 + 1] = ny / len;
        bakedNormals[i * 3 + 2] = nz;
    }

    posAttr.needsUpdate = true;
    geo.setAttribute('aNoiseHeight', new THREE.Float32BufferAttribute(noiseHeights, 1));
    geo.setAttribute('aBakedNormal', new THREE.Float32BufferAttribute(bakedNormals, 3));
    return geo;
}
