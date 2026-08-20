'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import './worldtree.css';

// --- SHADERS ---

const commonNoise = `
// 3D Simplex Noise
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){ 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod(i, 289.0 );
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
}

// Fractal Brownian Motion (FBM)
float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 0.0;
    for (int i = 0; i < 4; i++) {
        value += amplitude * snoise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}
`;

const branchVertexShader = `
${commonNoise}
attribute float level;
attribute float branchOffset;
varying float vLevel;
varying float vHeight;
varying float vPulse;
varying vec3 vNormal; 
varying vec3 vPos; // ✅ NEW: Pass local position for texture generation
uniform float uTime;
uniform float uSpeed;
uniform float uPulseTime;

void main() {
    vLevel = level;
    // Adjust height normalization to better fit the visual range of the tree
    vHeight = smoothstep(-20.0, 60.0, position.y);

    vec3 pos = position;
    
    // Sway logic
    float canopyMask = smoothstep(0.0, 20.0, pos.y);
    float canopySway = pow(vLevel, 2.0) * 1.5 * canopyMask;
    float rootMask = 1.0 - smoothstep(-10.0, 0.0, pos.y);
    float rootSway = rootMask * 0.1;
    float noiseCommon = snoise(vec3(pos.x * 0.05, pos.y * 0.05 + uTime * uSpeed * 0.2, branchOffset));
    
    pos.x += noiseCommon * (canopySway + rootSway);
    pos.z += noiseCommon * (canopySway + rootSway);

    // Pulse logic
    float timeSincePulse = uTime - uPulseTime;
    float pulseSpeed = 30.0;
    float pulsePos = -20.0 + timeSincePulse * pulseSpeed;
    float pulseWidth = 20.0;
    float pulseWave = smoothstep(pulsePos - pulseWidth, pulsePos, pos.y) - smoothstep(pulsePos, pulsePos + pulseWidth, pos.y);
    vPulse = pulseWave * smoothstep(5.0, 0.0, timeSincePulse);

    vNormal = normalize(position); 
    vPos = pos; // ✅ Save position

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const branchFragmentShader = `
${commonNoise} // ✅ Needed for bark noise
uniform float uTime;
uniform vec3 uBaseColor;
uniform vec3 uTipColor;
uniform vec3 uPulseColor;
uniform vec3 uSunDirection;
varying float vLevel;
varying float vHeight;
varying float vPulse;
varying vec3 vNormal;
varying vec3 vPos; // ✅ Receive position

void main() {
    // 1. Natural Color Gradient
    // Instead of linear mix, keep it brown (base color) for the bottom 70%, 
    // then transition to green (tip color) in the top 30%.
    float colorMixFactor = smoothstep(0.7, 1.0, vHeight);
    vec3 baseTrunkColor = mix(uBaseColor, uTipColor, colorMixFactor);

    // 2. Bark Texture Noise
    // Stretch noise vertically (vPos.y * 0.1) for bark-like patterns
    float barkNoise = snoise(vec3(vPos.x * 0.4, vPos.y * 0.08, vPos.z * 0.4));
    // Map noise from [-1, 1] to a subtle darkening factor, e.g., [0.7, 1.0]
    float barkDetail = 0.85 + 0.15 * barkNoise;

    // Apply texture to the base color
    vec3 texturedColor = baseTrunkColor * barkDetail;

    // 3. Lighting
    float light = max(dot(normalize(vNormal), normalize(uSunDirection)), 0.2); // 0.2 Ambient
    vec3 litColor = texturedColor * light;

    // 4. Pulse
    vec3 finalColor = mix(litColor, uPulseColor, vPulse * 0.8);
    finalColor *= 1.0 + (vPulse * 2.5);

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

const leafVertexShader = `
${commonNoise}
attribute float size;
attribute float offset;
uniform float uTime;
uniform float uSpeed;
varying float vOpacity;
varying vec3 vWorldPos;

void main() {
    vec3 pos = position;
    float t = uTime * uSpeed * 0.5 + offset * 10.0;
    
    pos.x += sin(t * 0.5) * 1.0; 
    pos.y += cos(t * 0.3) * 0.5;
    pos.z += sin(t * 0.7) * 1.0;

    float shimmer = snoise(vec3(pos * 0.2 + uTime * uSpeed));
    vOpacity = 0.6 + shimmer * 0.4;

    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = size * (400.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const leafFragmentShader = `
uniform vec3 uLeafColor;
uniform vec3 uSunDirection;
varying float vOpacity;
varying vec3 vWorldPos;

void main() {
    float dist = length(gl_PointCoord - 0.5);
    if (dist > 0.5) discard;
    float glow = 1.0 - smoothstep(0.0, 0.5, dist);
    
    // Fake Leaf Lighting (Leaves higher up and facing sun are brighter)
    // Simple directional approximation since particles don't have normals
    float light = dot(normalize(vWorldPos), normalize(uSunDirection)) * 0.5 + 0.5;
    
    vec3 finalColor = uLeafColor * (0.5 + 0.5 * light); 
    finalColor += vec3(0.1) * glow; // Specular highlight

    gl_FragColor = vec4(finalColor, glow * vOpacity * 0.5); 
}
`;

// --- TERRAIN SHADERS ---

const terrainVertexShader = `
${commonNoise}
varying float vNoiseHeight;
varying vec3 vWorldPos;
varying vec3 vNormal;

void main() {
    vec3 pos = position;
    
    // Rolling hills
    float height = fbm(pos * 0.008 + vec3(0.0, 10.0, 0.0)) * 45.0; 
    float centerDist = length(pos.xy); 
    float flatten = smoothstep(10.0, 80.0, centerDist);
    pos.z += height * flatten; 

    vNoiseHeight = height;
    
    // Calculate Normal from height map derivative (approximate)
    vec3 off = vec3(1.0, 0.0, 0.0);
    float hL = fbm((pos - off).xyz * 0.008 + vec3(0.0, 10.0, 0.0)) * 45.0 * flatten;
    float hR = fbm((pos + off).xyz * 0.008 + vec3(0.0, 10.0, 0.0)) * 45.0 * flatten;
    float hD = fbm((pos - off.yxz).xyz * 0.008 + vec3(0.0, 10.0, 0.0)) * 45.0 * flatten;
    float hU = fbm((pos + off.yxz).xyz * 0.008 + vec3(0.0, 10.0, 0.0)) * 45.0 * flatten;
    
    // Compute Normal
    vec3 N;
    N.x = hL - hR;
    N.z = hD - hU; // Z is Y in this noise space
    N.y = 2.0; // Scale vertical
    vNormal = normalize(mat3(modelMatrix) * normalize(N));

    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const terrainFragmentShader = `
${commonNoise}
uniform vec3 uRockColor;
uniform vec3 uGrassColor;
uniform vec3 uDarkSoilColor;
uniform vec3 uLightSoilColor;
uniform vec3 uFogColor;
uniform vec3 uSunDirection; // Lighting
varying float vNoiseHeight;
varying vec3 vWorldPos;
varying vec3 vNormal;

void main() {
    // 1. Textures
    float patchNoiseMedium = fbm(vWorldPos * 0.05);
    float patchNoiseSmall = snoise(vWorldPos * 0.2);
    vec3 soilBase = mix(uLightSoilColor, uDarkSoilColor, smoothstep(0.3, 0.7, patchNoiseMedium));
    soilBase *= (0.9 + patchNoiseSmall * 0.2);
    float creviceShadow = smoothstep(-15.0, 15.0, vNoiseHeight);
    vec3 finalGroundColor = soilBase * (0.6 + 0.4 * creviceShadow);

    // 2. Grass
    vec3 up = vec3(0.0, 1.0, 0.0);
    float slope = dot(vNormal, up); 
    float grassPattern = snoise(vec3(vWorldPos.x * 0.8, 0.0, vWorldPos.z * 0.8)); 
    grassPattern = smoothstep(0.1, 0.6, grassPattern);
    float slopeFactor = smoothstep(0.5, 0.8, slope);
    float grassCoverage = grassPattern * slopeFactor;
    finalGroundColor = mix(finalGroundColor, uGrassColor, grassCoverage);

    // 3. SUN LIGHTING
    float light = max(dot(vNormal, normalize(uSunDirection)), 0.0);
    // Ambient light
    float ambient = 0.2;
    // Shadow color (bluish tint in shadows)
    vec3 shadowTint = vec3(0.1, 0.1, 0.3);
    
    vec3 litColor = finalGroundColor * (light + ambient);
    // Add shadow tint to dark areas
    litColor = mix(litColor, litColor * shadowTint, 1.0 - (light + ambient));

    // 4. Fog
    float dist = length(vWorldPos.xz);
    float fogFactor = smoothstep(200.0, 900.0, dist); 
    vec3 finalColor = mix(litColor, uFogColor, fogFactor);

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

// --- CLOUD SHADER ---
const cloudVertexShader = `
varying vec3 vWorldPos;
varying vec2 vUv;
void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const cloudFragmentShader = `
${commonNoise}
uniform float uTime;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
varying vec3 vWorldPos;

void main() {
    // Scroll noise over time
    vec3 pos = vWorldPos * 0.002; // Large scale
    pos.x += uTime * 0.01; // Wind

    float n1 = fbm(pos);
    float n2 = fbm(pos * 2.0 + vec3(2.0)); // Detail
    
    float cloudDensity = n1 * 0.7 + n2 * 0.3;
    
    // Cutoff to make separate clouds. Lowered threshold for more clouds.
    float alpha = smoothstep(0.2, 0.7, cloudDensity);
    
    // Lighting on clouds
    // Clouds near the sun are brighter
    float sunAngle = dot(normalize(vWorldPos), normalize(uSunDirection));
    float sunGlow = smoothstep(0.8, 1.0, sunAngle);
    
    vec3 cloudColor = vec3(0.9, 0.95, 1.0); // Base white/blue
    // Add sun color to edges near sun
    cloudColor = mix(cloudColor, uSunColor, sunGlow * 0.8);
    
    // Darker underside (fake)
    cloudColor *= 0.8 + 0.2 * n2;

    if (alpha < 0.05) discard;

    gl_FragColor = vec4(cloudColor, alpha * 0.6);
}
`;

// --- SKY SHADER ---
const skyVertexShader = `
varying vec3 vWorldPos;
void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const skyFragmentShader = `
${commonNoise}
uniform vec3 uTopColor;
uniform vec3 uHorizonColor;
uniform vec3 uBottomColor;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
varying vec3 vWorldPos;

void main() {
    vec3 dir = normalize(vWorldPos);
    float h = dir.y; 

    vec3 sky = mix(uHorizonColor, uTopColor, smoothstep(0.0, 0.8, h));
    vec3 ground = mix(uHorizonColor, uBottomColor, smoothstep(0.0, 0.8, -h));
    
    vec3 finalColor = mix(ground, sky, step(0.0, h));
    float horizonMix = 1.0 - smoothstep(0.0, 0.05, abs(h));
    finalColor = mix(finalColor, uHorizonColor, horizonMix);

    // Sun Glare
    float sunDist = dot(dir, normalize(uSunDirection));
    float sunDisk = smoothstep(0.998, 0.999, sunDist);
    float sunHalo = smoothstep(0.9, 1.0, sunDist) * 0.3;
    
    finalColor += uSunColor * sunDisk * 5.0; // The bright sun itself
    finalColor += uSunColor * sunHalo; // The glow around it

    // Stars (masked by sun brightness so stars don't appear near sun)
    if (h > 0.1) {
        float starThreshold = 0.98;
        float stars = snoise(vWorldPos * 0.05); 
        if (stars > starThreshold) {
            float brightness = (stars - starThreshold) / (1.0 - starThreshold);
            finalColor += vec3(brightness) * (1.0 - sunHalo); // Hide stars in sun halo
        }
    }

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

const themes = [
    {
        name: "Pheonix",
        base: 0x4a3324, // ✅ Darker brown base
        tip: 0x335522,  // ✅ Darker green tip
        leaf: 0x44cc44, pulse: 0xaaffff,
        darkSoil: 0x3b2e25, lightSoil: 0x5c4433, grass: 0x226611, rock: 0x554433,
        skyTop: 0x004488, skyHorizon: 0x66ccff, skyBottom: 0x000510, fog: 0x66ccff,
        sunColor: 0xffffee
    },
    {
        name: "Autumn",
        base: 0x332211, tip: 0xcc5500, leaf: 0xffaa00, pulse: 0xffdd88,
        darkSoil: 0x2a1d15, lightSoil: 0x443322, grass: 0x885522, rock: 0x5a4a3a,
        skyTop: 0x441100, skyHorizon: 0xff8844, skyBottom: 0x110500, fog: 0xff8844,
        sunColor: 0xffaa00
    },
    {
        name: "Mystic",
        base: 0x110022, tip: 0x8800ff, leaf: 0xcc88ff, pulse: 0xff00ff,
        darkSoil: 0x100a18, lightSoil: 0x221133, grass: 0x440066, rock: 0x2a1a3a,
        skyTop: 0x110033, skyHorizon: 0x00ffff, skyBottom: 0x000000, fog: 0x00ffff,
        sunColor: 0x00ffff
    },
];

export default function WorldTreeEngine() {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [activeTheme, setActiveTheme] = useState(0);
    const [growthLevel, setGrowthLevel] = useState(6);
    const [flowSpeed, setFlowSpeed] = useState(1.0);

    const sceneRef = useRef<THREE.Scene | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const treeMeshRef = useRef<THREE.LineSegments | null>(null);
    const leavesMeshRef = useRef<THREE.Points | null>(null);
    const groundMeshRef = useRef<THREE.Mesh | null>(null);
    const skyMeshRef = useRef<THREE.Mesh | null>(null);
    const cloudMeshRef = useRef<THREE.Mesh | null>(null);
    const rebuildTreeRef = useRef<(() => void) | null>(null);
    const updateTreeThemeRef = useRef<((themeIdx: number) => void) | null>(null);

    const configRef = useRef({
        growth: 6,
        speed: 1.0,
        themeIndex: 0,
        pulseTime: -100.0,
        // Sun Position Configuration
        sunPosition: new THREE.Vector3(100, 50, -100).normalize()
    });

    useEffect(() => {
        if (!containerRef.current || !canvasRef.current) return;

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x112233, 0.0015);
        sceneRef.current = scene;

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 2500);
        camera.position.set(0, 20, 140);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.current,
            antialias: false,
            powerPreference: "high-performance"
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x051020);
        rendererRef.current = renderer;

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.2;
        controls.maxPolarAngle = Math.PI / 2 - 0.05;
        controls.target.set(0, 10, 0);
        controlsRef.current = controls;

        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.4, 0.3, 0.85);
        composer.addPass(bloomPass);
        composer.addPass(new OutputPass());

        // --- SKY DOME ---
        const skyGeo = new THREE.SphereGeometry(1200, 32, 32);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: {
                uTopColor: { value: new THREE.Color(themes[0].skyTop) },
                uHorizonColor: { value: new THREE.Color(themes[0].skyHorizon) },
                uBottomColor: { value: new THREE.Color(themes[0].skyBottom) },
                uSunDirection: { value: configRef.current.sunPosition },
                uSunColor: { value: new THREE.Color(themes[0].sunColor) }
            },
            vertexShader: skyVertexShader,
            fragmentShader: skyFragmentShader,
            side: THREE.BackSide
        });
        const skyMesh = new THREE.Mesh(skyGeo, skyMat);
        scene.add(skyMesh);
        skyMeshRef.current = skyMesh;

        // --- CLOUDS ---
        const cloudGeo = new THREE.SphereGeometry(1100, 32, 32);
        const cloudMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uSunDirection: { value: configRef.current.sunPosition },
                uSunColor: { value: new THREE.Color(themes[0].sunColor) }
            },
            vertexShader: cloudVertexShader,
            fragmentShader: cloudFragmentShader,
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: false
        });
        const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
        scene.add(cloudMesh);
        cloudMeshRef.current = cloudMesh;

        // --- GEOMETRY ---
        const generateWorldTree = (recursionDepth: number) => {
            const branchPositions: number[] = [];
            const branchLevels: number[] = [];
            const branchOffsets: number[] = [];
            const leafPositions: number[] = [];
            const leafSizes: number[] = [];
            const leafOffsets: number[] = [];

            const trunkHeight = 45;
            const trunkRadiusBase = 10;
            const trunkRadiusTop = 4;
            const numRootCables = 48;
            const segmentsPerCable = 60;
            const twistFactor = 3.0;

            // Trunk
            for (let i = 0; i < numRootCables; i++) {
                const angleOffset = (i / numRootCables) * Math.PI * 2;
                let prevPos = new THREE.Vector3(
                    Math.cos(angleOffset) * trunkRadiusBase,
                    -5,
                    Math.sin(angleOffset) * trunkRadiusBase
                );

                for (let j = 0; j <= segmentsPerCable; j++) {
                    const progress = j / segmentsPerCable;
                    const currentY = -5 + progress * trunkHeight;
                    const currentRadius = THREE.MathUtils.lerp(trunkRadiusBase, trunkRadiusTop, Math.pow(progress, 0.7));
                    const currentAngle = angleOffset + progress * Math.PI * twistFactor;

                    const newPos = new THREE.Vector3(
                        Math.cos(currentAngle) * currentRadius,
                        currentY,
                        Math.sin(currentAngle) * currentRadius
                    );

                    if (j > 0) {
                        branchPositions.push(prevPos.x, prevPos.y, prevPos.z);
                        branchPositions.push(newPos.x, newPos.y, newPos.z);
                        branchLevels.push(0, 0);
                        branchOffsets.push(i / numRootCables, i / numRootCables);
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

            // Recursive Branch Logic
            function growBranch(startPos: THREE.Vector3, direction: THREE.Vector3, length: number, level: number, maxLevel: number) {
                if (level > maxLevel) return;
                const endPos = new THREE.Vector3().copy(startPos).add(direction.clone().multiplyScalar(length));
                branchPositions.push(startPos.x, startPos.y, startPos.z);
                branchPositions.push(endPos.x, endPos.y, endPos.z);
                const normLevel = level / maxLevel;
                branchLevels.push(normLevel, normLevel);
                branchOffsets.push(Math.random(), Math.random());

                if (level >= maxLevel - 1) {
                    for (let k = 0; k < 4; k++) {
                        const spread = 6.0;
                        leafPositions.push(
                            endPos.x + (Math.random() - 0.5) * spread,
                            endPos.y + (Math.random() - 0.5) * (spread * 0.5),
                            endPos.z + (Math.random() - 0.5) * spread
                        );
                        leafSizes.push(Math.random() * 2.5 + 1.0);
                        leafOffsets.push(Math.random());
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

            return {
                branchGeo: { positions: branchPositions, levels: branchLevels, offsets: branchOffsets },
                leafGeo: { positions: leafPositions, sizes: leafSizes, offsets: leafOffsets }
            };
        };

        const treeUniforms = {
            uTime: { value: 0 },
            uSpeed: { value: configRef.current.speed },
            uPulseTime: { value: configRef.current.pulseTime },
            uBaseColor: { value: new THREE.Color(themes[0].base) },
            uTipColor: { value: new THREE.Color(themes[0].tip) },
            uPulseColor: { value: new THREE.Color(themes[0].pulse) },
            uSunDirection: { value: configRef.current.sunPosition },
        };

        const leafUniforms = {
            uTime: { value: 0 },
            uSpeed: { value: configRef.current.speed },
            uLeafColor: { value: new THREE.Color(themes[0].leaf) },
            uSunDirection: { value: configRef.current.sunPosition },
        };

        const rebuildTree = () => {
            if (treeMeshRef.current) { scene.remove(treeMeshRef.current); treeMeshRef.current.geometry.dispose(); }
            if (leavesMeshRef.current) { scene.remove(leavesMeshRef.current); leavesMeshRef.current.geometry.dispose(); }
            if (groundMeshRef.current) { scene.remove(groundMeshRef.current); groundMeshRef.current.geometry.dispose(); }

            const data = generateWorldTree(configRef.current.growth);

            // Tree
            const branchGeo = new THREE.BufferGeometry();
            branchGeo.setAttribute('position', new THREE.Float32BufferAttribute(data.branchGeo.positions, 3));
            branchGeo.setAttribute('level', new THREE.Float32BufferAttribute(data.branchGeo.levels, 1));
            branchGeo.setAttribute('branchOffset', new THREE.Float32BufferAttribute(data.branchGeo.offsets, 1));
            const branchMat = new THREE.ShaderMaterial({
                uniforms: treeUniforms,
                vertexShader: branchVertexShader,
                fragmentShader: branchFragmentShader,
                transparent: true,
                depthWrite: true,
                blending: THREE.NormalBlending,
                linewidth: 2,
            });
            const treeMesh = new THREE.LineSegments(branchGeo, branchMat);
            scene.add(treeMesh);
            treeMeshRef.current = treeMesh;

            // Leaves
            const leafGeo = new THREE.BufferGeometry();
            leafGeo.setAttribute('position', new THREE.Float32BufferAttribute(data.leafGeo.positions, 3));
            leafGeo.setAttribute('size', new THREE.Float32BufferAttribute(data.leafGeo.sizes, 1));
            leafGeo.setAttribute('offset', new THREE.Float32BufferAttribute(data.leafGeo.offsets, 1));
            const leafMat = new THREE.ShaderMaterial({
                uniforms: leafUniforms,
                vertexShader: leafVertexShader,
                fragmentShader: leafFragmentShader,
                transparent: true,
                depthWrite: false,
                blending: THREE.NormalBlending,
            });
            const leafMesh = new THREE.Points(leafGeo, leafMat);
            scene.add(leafMesh);
            leavesMeshRef.current = leafMesh;

            // --- INFINITE TERRAIN ---
            const groundGeo = new THREE.PlaneGeometry(2000, 2000, 128, 128);
            const groundMat = new THREE.ShaderMaterial({
                uniforms: {
                    uRockColor: { value: new THREE.Color(themes[0].rock) },
                    uGrassColor: { value: new THREE.Color(themes[0].grass) },
                    uDarkSoilColor: { value: new THREE.Color(themes[0].darkSoil) },
                    uLightSoilColor: { value: new THREE.Color(themes[0].lightSoil) },
                    uFogColor: { value: new THREE.Color(themes[0].fog) },
                    uSunDirection: { value: configRef.current.sunPosition },
                },
                vertexShader: terrainVertexShader,
                fragmentShader: terrainFragmentShader,
                side: THREE.DoubleSide
            });
            const groundMesh = new THREE.Mesh(groundGeo, groundMat);
            groundMesh.rotation.x = -Math.PI / 2;
            groundMesh.position.y = -5;
            scene.add(groundMesh);
            groundMeshRef.current = groundMesh;
        };

        rebuildTree();

        const raycaster = new THREE.Raycaster();
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 10);

        const handleInput = (x: number, y: number) => {
            const coords = new THREE.Vector2(
                (x / window.innerWidth) * 2 - 1,
                -(y / window.innerHeight) * 2 + 1
            );
            raycaster.setFromCamera(coords, camera);
            const intersect = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(plane, intersect)) {
                if (intersect.length() < 50) {
                    configRef.current.pulseTime = performance.now() / 1000;
                    treeUniforms.uPulseTime.value = configRef.current.pulseTime;
                }
            }
        };
        const onClick = (e: MouseEvent) => handleInput(e.clientX, e.clientY);
        window.addEventListener('click', onClick);

        const clock = new THREE.Clock();
        let reqId: number;
        const animate = () => {
            reqId = requestAnimationFrame(animate);
            const elapsed = clock.getElapsedTime();
            controls.update();

            treeUniforms.uTime.value = elapsed;
            treeUniforms.uSpeed.value = configRef.current.speed;
            leafUniforms.uTime.value = elapsed;
            leafUniforms.uSpeed.value = configRef.current.speed;

            if (cloudMeshRef.current) {
                (cloudMeshRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed;
                cloudMeshRef.current.rotation.y = elapsed * 0.01;
            }

            composer.render();
        };
        animate();

        const handleResize = () => {
            if (!containerRef.current) return;
            const newWidth = containerRef.current.clientWidth;
            const newHeight = containerRef.current.clientHeight;
            camera.aspect = newWidth / newHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(newWidth, newHeight);
            composer.setSize(newWidth, newHeight);
            bloomPass.resolution.set(newWidth, newHeight);
        };
        window.addEventListener('resize', handleResize);

        rebuildTreeRef.current = rebuildTree;
        updateTreeThemeRef.current = (themeIdx: number) => {
            const t = themes[themeIdx];
            treeUniforms.uBaseColor.value.setHex(t.base);
            treeUniforms.uTipColor.value.setHex(t.tip);
            treeUniforms.uPulseColor.value.setHex(t.pulse);
            leafUniforms.uLeafColor.value.setHex(t.leaf);

            if (groundMeshRef.current) {
                const gm = groundMeshRef.current.material as THREE.ShaderMaterial;
                gm.uniforms.uDarkSoilColor.value.setHex(t.darkSoil);
                gm.uniforms.uLightSoilColor.value.setHex(t.lightSoil);
                gm.uniforms.uGrassColor.value.setHex(t.grass);
                gm.uniforms.uRockColor.value.setHex(t.rock);
                gm.uniforms.uFogColor.value.setHex(t.fog);
            }
            if (skyMeshRef.current) {
                const sm = skyMeshRef.current.material as THREE.ShaderMaterial;
                sm.uniforms.uTopColor.value.setHex(t.skyTop);
                sm.uniforms.uHorizonColor.value.setHex(t.skyHorizon);
                sm.uniforms.uBottomColor.value.setHex(t.skyBottom);
                sm.uniforms.uSunColor.value.setHex(t.sunColor);
            }
            if (cloudMeshRef.current) {
                (cloudMeshRef.current.material as THREE.ShaderMaterial).uniforms.uSunColor.value.setHex(t.sunColor);
            }
            if (sceneRef.current?.fog) {
                (sceneRef.current.fog as THREE.FogExp2).color.setHex(t.fog);
            }
        };

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('click', onClick);
            cancelAnimationFrame(reqId);
            renderer.dispose();
            composer.dispose();
        };
    }, []);

    useEffect(() => {
        const prevGrowth = configRef.current.growth;
        configRef.current.growth = growthLevel;
        configRef.current.speed = flowSpeed;
        if (prevGrowth !== growthLevel) {
            rebuildTreeRef.current?.();
        }
    }, [growthLevel, flowSpeed]);

    useEffect(() => {
        configRef.current.themeIndex = activeTheme;
        updateTreeThemeRef.current?.(activeTheme);
    }, [activeTheme]);

    return (
        <div className="wt-container" ref={containerRef}>
            <div className="glass-panel" style={{ top: 32, left: 32, padding: 24 }}>
                <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 8, background: 'linear-gradient(135deg, #fff 30%, #a5b4fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Peonix Engine
                </div>
                <div style={{ fontSize: 14, opacity: 0.7 }}>
                    Click the ground to channel energy.
                </div>
            </div>

            <div className="glass-panel" style={{ top: 32, right: 32, padding: 24, width: 240 }}>
                <div style={{ fontSize: 12, letterSpacing: 2, opacity: 0.7, marginBottom: 12, textTransform: 'uppercase' }}>
                    Essence Type
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                    {themes.map((theme, idx) => (
                        <div
                            key={idx}
                            className={`theme-button ${activeTheme === idx ? 'active' : ''}`}
                            style={{ background: `linear-gradient(135deg, ${new THREE.Color(theme.base).getStyle()}, ${new THREE.Color(theme.tip).getStyle()})` }}
                            onClick={() => setActiveTheme(idx)}
                            title={theme.name}
                        />
                    ))}
                </div>

                <div style={{ fontSize: 12, letterSpacing: 2, opacity: 0.7, marginBottom: 8, textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Canopy Density</span> <span>{growthLevel}</span>
                </div>
                <input type="range" min="3" max="7" step="1" value={growthLevel}
                    onChange={(e) => setGrowthLevel(Number(e.target.value))} className="control-slider" />

                <div style={{ fontSize: 12, letterSpacing: 2, opacity: 0.7, marginTop: 16, marginBottom: 8, textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Flow Rate</span> <span>{flowSpeed.toFixed(1)}x</span>
                </div>
                <input type="range" min="0.1" max="3.0" step="0.1" value={flowSpeed}
                    onChange={(e) => setFlowSpeed(Number(e.target.value))} className="control-slider" />
            </div>

            <canvas ref={canvasRef} className="wt-canvas" />
        </div>
    );
}