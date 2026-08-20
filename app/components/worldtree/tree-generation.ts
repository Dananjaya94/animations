import * as THREE from 'three';

export interface BranchSegment {
    start: THREE.Vector3;
    end: THREE.Vector3;
    /** 0 = trunk, 1 = maxLevel = normalized depth, used for color gradient + sway strength */
    level: number;
    /** Random per-segment phase, reused for sway noise and bark variation */
    offset: number;
    /** Tube radius at this segment, tapering from trunk to twig */
    radius: number;
}

export interface LeafGeometryData {
    positions: number[];
    sizes: number[];
    offsets: number[];
    colorSeeds: number[];
}

export interface WorldTreeGeometryData {
    segments: BranchSegment[];
    leafGeo: LeafGeometryData;
}

const TRUNK_RADIUS_BASE = 10;
const TRUNK_RADIUS_TOP = 4;
/** How quickly branch radius shrinks per recursion level, relative to the trunk tip. */
const BRANCH_TAPER = 0.62;
const MIN_BRANCH_RADIUS = 0.05;
const LEAVES_PER_CLUSTER = 8;

export function generateWorldTree(recursionDepth: number): WorldTreeGeometryData {
    const segments: BranchSegment[] = [];
    const leafPositions: number[] = [];
    const leafSizes: number[] = [];
    const leafOffsets: number[] = [];
    const leafColorSeeds: number[] = [];

    const trunkHeight = 45;
    const numRootCables = 48;
    const segmentsPerCable = 60;
    const twistFactor = 3.0;

    // Recursive Branch Logic
    function growBranch(startPos: THREE.Vector3, direction: THREE.Vector3, length: number, level: number, maxLevel: number) {
        if (level > maxLevel) return;
        const endPos = new THREE.Vector3().copy(startPos).add(direction.clone().multiplyScalar(length));
        const normLevel = level / maxLevel;
        const radius = Math.max(MIN_BRANCH_RADIUS, TRUNK_RADIUS_TOP * Math.pow(BRANCH_TAPER, level));
        segments.push({ start: startPos.clone(), end: endPos, level: normLevel, offset: Math.random(), radius });

        if (level >= maxLevel - 1) {
            // Center the cluster a little beyond the tip (along the branch's own
            // direction) rather than right on top of it, so leaves don't end up
            // hidden inside the now-solid tapered branch geometry.
            const clusterCenter = endPos.clone().add(direction.clone().multiplyScalar(2.0));
            for (let k = 0; k < LEAVES_PER_CLUSTER; k++) {
                const spread = 7.0;
                leafPositions.push(
                    clusterCenter.x + (Math.random() - 0.5) * spread,
                    clusterCenter.y + (Math.random() - 0.5) * (spread * 0.5),
                    clusterCenter.z + (Math.random() - 0.5) * spread
                );
                leafSizes.push(Math.random() * 3.0 + 1.5);
                leafOffsets.push(Math.random());
                leafColorSeeds.push(Math.random());
            }
            if (level === maxLevel) return;
        }

        const numBranches = Math.floor(Math.random() * 2) + 2;
        for (let i = 0; i < numBranches; i++) {
            const spreadFactor = 1.5;
            const upwardBias = 0.6;
            const offsetV = new THREE.Vector3(
                (Math.random() - 0.5) * spreadFactor,
                (Math.random() - 0.5) * spreadFactor + upwardBias,
                (Math.random() - 0.5) * spreadFactor
            ).normalize();
            const nextDir = direction.clone().add(offsetV).normalize();
            const nextLength = length * 0.8;
            growBranch(endPos, nextDir, nextLength, level + 1, maxLevel);
        }
    }

    // Trunk
    for (let i = 0; i < numRootCables; i++) {
        const angleOffset = (i / numRootCables) * Math.PI * 2;
        let prevPos = new THREE.Vector3(
            Math.cos(angleOffset) * TRUNK_RADIUS_BASE,
            -5,
            Math.sin(angleOffset) * TRUNK_RADIUS_BASE
        );

        for (let j = 0; j <= segmentsPerCable; j++) {
            const progress = j / segmentsPerCable;
            const currentY = -5 + progress * trunkHeight;
            const currentRadius = THREE.MathUtils.lerp(TRUNK_RADIUS_BASE, TRUNK_RADIUS_TOP, Math.pow(progress, 0.7));
            const currentAngle = angleOffset + progress * Math.PI * twistFactor;

            const newPos = new THREE.Vector3(
                Math.cos(currentAngle) * currentRadius,
                currentY,
                Math.sin(currentAngle) * currentRadius
            );

            if (j > 0) {
                // Trunk cables taper gently and are much thinner than the solid trunk radius
                // would suggest (they're individually twisted strands, not a solid cone).
                const cableRadius = THREE.MathUtils.lerp(1.1, 0.35, progress);
                segments.push({ start: prevPos.clone(), end: newPos.clone(), level: 0, offset: i / numRootCables, radius: cableRadius });
            }
            prevPos = newPos;

            if (progress > 0.6 && Math.random() < 0.25) {
                const outward = new THREE.Vector3(newPos.x, 0, newPos.z).normalize();
                outward.y = 0.4;
                outward.normalize();
                const startLength = 18.0 * (1.0 - progress) + 10.0;
                growBranch(newPos, outward, startLength, 1, recursionDepth);
            }
        }
    }

    return {
        segments,
        leafGeo: { positions: leafPositions, sizes: leafSizes, offsets: leafOffsets, colorSeeds: leafColorSeeds }
    };
}
