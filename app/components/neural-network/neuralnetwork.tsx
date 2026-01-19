'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import './neuralnetwork.css';

// --- Shaders (Standard Dark Mode Logic) ---
const noiseFunctions = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}`;

const nodeVertexShader = `${noiseFunctions}
attribute float nodeSize;
attribute float nodeType;
attribute vec3 nodeColor;
attribute float distanceFromRoot;
uniform float uTime;
uniform vec3 uPulsePositions[3];
uniform float uPulseTimes[3];
uniform float uPulseSpeed;
uniform float uBaseNodeSize;
varying vec3 vColor;
varying float vNodeType;
varying vec3 vPosition;
varying float vPulseIntensity;
varying float vDistanceFromRoot;
varying float vGlow;

float getPulseIntensity(vec3 worldPos, vec3 pulsePos, float pulseTime) {
    if (pulseTime < 0.0) return 0.0;
    float timeSinceClick = uTime - pulseTime;
    if (timeSinceClick < 0.0 || timeSinceClick > 4.0) return 0.0;
    float pulseRadius = timeSinceClick * uPulseSpeed;
    float distToClick = distance(worldPos, pulsePos);
    float pulseThickness = 3.0;
    float waveProximity = abs(distToClick - pulseRadius);
    return smoothstep(pulseThickness, 0.0, waveProximity) * smoothstep(4.0, 0.0, timeSinceClick);
}

void main() {
    vNodeType = nodeType;
    vColor = nodeColor;
    vDistanceFromRoot = distanceFromRoot;
    vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vPosition = worldPos;
    float totalPulseIntensity = 0.0;
    for (int i = 0; i < 3; i++) {
        totalPulseIntensity += getPulseIntensity(worldPos, uPulsePositions[i], uPulseTimes[i]);
    }
    vPulseIntensity = min(totalPulseIntensity, 1.0);
    float breathe = sin(uTime * 0.7 + distanceFromRoot * 0.15) * 0.15 + 0.85;
    float baseSize = nodeSize * breathe;
    float pulseSize = baseSize * (1.0 + vPulseIntensity * 2.5);
    vGlow = 0.5 + 0.5 * sin(uTime * 0.5 + distanceFromRoot * 0.2);
    vec3 modifiedPosition = position;
    if (nodeType > 0.5) {
        float noise = snoise(position * 0.08 + uTime * 0.08);
        modifiedPosition += normal * noise * 0.15;
    }
    vec4 mvPosition = modelViewMatrix * vec4(modifiedPosition, 1.0);
    gl_PointSize = pulseSize * uBaseNodeSize * (1000.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
}`;

const nodeFragmentShader = `
uniform float uTime;
uniform vec3 uPulseColors[3];
varying vec3 vColor;
varying float vNodeType;
varying vec3 vPosition;
varying float vPulseIntensity;
varying float vDistanceFromRoot;
varying float vGlow;
void main() {
    vec2 center = 2.0 * gl_PointCoord - 1.0;
    float dist = length(center);
    if (dist > 1.0) discard;
    float glow1 = 1.0 - smoothstep(0.0, 0.5, dist);
    float glow2 = 1.0 - smoothstep(0.0, 1.0, dist);
    float glowStrength = pow(glow1, 1.2) + glow2 * 0.3;
    float breatheColor = 0.9 + 0.1 * sin(uTime * 0.6 + vDistanceFromRoot * 0.25);
    vec3 baseColor = vColor * breatheColor;
    vec3 finalColor = baseColor;
    if (vPulseIntensity > 0.0) {
        vec3 pulseColor = mix(vec3(1.0), uPulseColors[0], 0.4);
        finalColor = mix(baseColor, pulseColor, vPulseIntensity * 0.8);
        finalColor *= (1.0 + vPulseIntensity * 1.2);
        glowStrength *= (1.0 + vPulseIntensity);
    }
    float coreBrightness = smoothstep(0.4, 0.0, dist);
    finalColor += vec3(1.0) * coreBrightness * 0.3;
    float alpha = glowStrength * (0.95 - 0.3 * dist);
    if (vNodeType > 0.5) {
        finalColor *= 1.1;
        alpha *= 0.9;
    }
    finalColor *= (1.0 + vGlow * 0.1);
    gl_FragColor = vec4(finalColor, alpha);
}`;

const connVertexShader = `${noiseFunctions}
attribute vec3 startPoint;
attribute vec3 endPoint;
attribute float connectionStrength;
attribute float pathIndex;
attribute vec3 connectionColor;
uniform float uTime;
uniform vec3 uPulsePositions[3];
uniform float uPulseTimes[3];
uniform float uPulseSpeed;
varying vec3 vColor;
varying float vConnectionStrength;
varying float vPulseIntensity;
varying float vPathPosition;
varying float vDistanceFromCamera;

float getPulseIntensity(vec3 worldPos, vec3 pulsePos, float pulseTime) {
    if (pulseTime < 0.0) return 0.0;
    float timeSinceClick = uTime - pulseTime;
    if (timeSinceClick < 0.0 || timeSinceClick > 4.0) return 0.0;
    float pulseRadius = timeSinceClick * uPulseSpeed;
    float distToClick = distance(worldPos, pulsePos);
    float pulseThickness = 3.0;
    float waveProximity = abs(distToClick - pulseRadius);
    return smoothstep(pulseThickness, 0.0, waveProximity) * smoothstep(4.0, 0.0, timeSinceClick);
}

void main() {
    float t = position.x;
    vPathPosition = t;
    vec3 midPoint = mix(startPoint, endPoint, 0.5);
    float pathOffset = sin(t * 3.14159) * 0.15;
    vec3 perpendicular = normalize(cross(normalize(endPoint - startPoint), vec3(0.0, 1.0, 0.0)));
    if (length(perpendicular) < 0.1) perpendicular = vec3(1.0, 0.0, 0.0);
    midPoint += perpendicular * pathOffset;
    vec3 p0 = mix(startPoint, midPoint, t);
    vec3 p1 = mix(midPoint, endPoint, t);
    vec3 finalPos = mix(p0, p1, t);
    float noiseTime = uTime * 0.15;
    float noise = snoise(vec3(pathIndex * 0.08, t * 0.6, noiseTime));
    finalPos += perpendicular * noise * 0.12;
    vec3 worldPos = (modelMatrix * vec4(finalPos, 1.0)).xyz;
    float totalPulseIntensity = 0.0;
    for (int i = 0; i < 3; i++) {
        totalPulseIntensity += getPulseIntensity(worldPos, uPulsePositions[i], uPulseTimes[i]);
    }
    vPulseIntensity = min(totalPulseIntensity, 1.0);
    vColor = connectionColor;
    vConnectionStrength = connectionStrength;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
}`;

const connFragmentShader = `
uniform float uTime;
uniform vec3 uPulseColors[3];
varying vec3 vColor;
varying float vConnectionStrength;
varying float vPulseIntensity;
varying float vPathPosition;
varying float vDistanceFromCamera;
void main() {
    float flowPattern1 = sin(vPathPosition * 25.0 - uTime * 4.0) * 0.5 + 0.5;
    float flowPattern2 = sin(vPathPosition * 15.0 - uTime * 2.5 + 1.57) * 0.5 + 0.5;
    float combinedFlow = (flowPattern1 + flowPattern2 * 0.5) / 1.5;
    vec3 baseColor = vColor * (0.8 + 0.2 * sin(uTime * 0.6 + vPathPosition * 12.0));
    float flowIntensity = 0.4 * combinedFlow * vConnectionStrength;
    vec3 finalColor = baseColor;
    if (vPulseIntensity > 0.0) {
        vec3 pulseColor = mix(vec3(1.0), uPulseColors[0], 0.3);
        finalColor = mix(baseColor, pulseColor * 1.2, vPulseIntensity * 0.7);
        flowIntensity += vPulseIntensity * 0.8;
    }
    finalColor *= (0.7 + flowIntensity + vConnectionStrength * 0.5);
    float baseAlpha = 0.7 * vConnectionStrength;
    float flowAlpha = combinedFlow * 0.3;
    float alpha = baseAlpha + flowAlpha;
    alpha = mix(alpha, min(1.0, alpha * 2.5), vPulseIntensity);
    gl_FragColor = vec4(finalColor, alpha);
}`;

export default function NeuralNetwork() {
    // We do NOT use the theme here anymore for colors.
    // The animation will stay DARK regardless of the Sidebar/App theme.

    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [activeTheme, setActiveTheme] = useState(0);
    const [density, setDensity] = useState(100);
    const [paused, setPaused] = useState(false);

    // Refs
    const sceneRef = useRef<THREE.Scene | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const nodesMeshRef = useRef<THREE.Points | null>(null);
    const connectionsMeshRef = useRef<THREE.LineSegments | null>(null);
    const configRef = useRef({ paused: false, activePaletteIndex: 0, currentFormation: 0, densityFactor: 1 });

    class Node {
        position: THREE.Vector3;
        connections: any[];
        level: number;
        type: number;
        size: number;
        distanceFromRoot: number;
        helixIndex?: number;
        helixT?: number;

        constructor(position: THREE.Vector3, level = 0, type = 0) {
            this.position = position;
            this.connections = [];
            this.level = level;
            this.type = type;
            this.size = type === 0 ? THREE.MathUtils.randFloat(0.8, 1.4) : THREE.MathUtils.randFloat(0.5, 1.0);
            this.distanceFromRoot = 0;
        }
        addConnection(node: Node, strength = 1.0) {
            if (!this.isConnectedTo(node)) {
                this.connections.push({ node, strength });
                node.connections.push({ node: this, strength });
            }
        }
        isConnectedTo(node: Node) {
            return this.connections.some(conn => conn.node === node);
        }
    }

    // Effect to initialize Three.js
    useEffect(() => {
        if (!containerRef.current || !canvasRef.current) return;

        const colorPalettes = [
            [new THREE.Color(0x667eea), new THREE.Color(0x764ba2), new THREE.Color(0xf093fb), new THREE.Color(0x9d50bb), new THREE.Color(0x6e48aa)],
            [new THREE.Color(0xf857a6), new THREE.Color(0xff5858), new THREE.Color(0xfeca57), new THREE.Color(0xff6348), new THREE.Color(0xff9068)],
            [new THREE.Color(0x4facfe), new THREE.Color(0x00f2fe), new THREE.Color(0x43e97b), new THREE.Color(0x38f9d7), new THREE.Color(0x4484ce)]
        ];

        // ✅ FORCE DARK MODE VISUALS ALWAYS
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x050508, 0.002); // Always black background
        sceneRef.current = scene;

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 1000);
        camera.position.set(0, 8, 28);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.current,
            antialias: true,
            powerPreference: "high-performance"
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x050508); // Always black background
        rendererRef.current = renderer;

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.2;
        controls.enablePan = false;
        controlsRef.current = controls;

        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 1.8, 0.6, 0.7); // Always strong bloom
        composer.addPass(bloomPass);
        composer.addPass(new OutputPass());

        const createStarfield = () => {
            const count = 4000;
            const positions = [];
            const colors = [];
            const sizes = [];
            for (let i = 0; i < count; i++) {
                const r = THREE.MathUtils.randFloat(50, 150);
                const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
                const theta = THREE.MathUtils.randFloat(0, Math.PI * 2);
                positions.push(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
                colors.push(0.8, 0.9, 1); // Always white/blue stars
                sizes.push(THREE.MathUtils.randFloat(0.1, 0.3));
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            geo.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
            const mat = new THREE.ShaderMaterial({
                uniforms: { uTime: { value: 0 } },
                vertexShader: `
            attribute float size; attribute vec3 color; varying vec3 vColor; uniform float uTime;
            void main() { vColor = color; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            float twinkle = sin(uTime * 2.0 + position.x * 100.0) * 0.3 + 0.7;
            gl_PointSize = size * twinkle * (300.0 / -mvPosition.z); gl_Position = projectionMatrix * mvPosition; }`,
                fragmentShader: `varying vec3 vColor; void main() {
            if (length(gl_PointCoord - 0.5) > 0.5) discard; gl_FragColor = vec4(vColor, 0.8); }`,
                transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
            });
            return new THREE.Points(geo, mat);
        }
        const starField = createStarfield();
        scene.add(starField);

        const pulseUniforms = {
            uTime: { value: 0.0 },
            uPulsePositions: { value: [new THREE.Vector3(1e3, 1e3, 1e3), new THREE.Vector3(1e3, 1e3, 1e3), new THREE.Vector3(1e3, 1e3, 1e3)] },
            uPulseTimes: { value: [-1e3, -1e3, -1e3] },
            uPulseColors: { value: [new THREE.Color(1, 1, 1), new THREE.Color(1, 1, 1), new THREE.Color(1, 1, 1)] },
            uPulseSpeed: { value: 18.0 },
            uBaseNodeSize: { value: 0.6 }
        };

        const generateNetwork = (formationIndex: number, densityFactor: number) => {
            let nodes: Node[] = [];
            let rootNode = new Node(new THREE.Vector3(0, 0, 0), 0, 0);

            const generateCrystallineSphere = () => {
                rootNode.size = 2.0;
                nodes.push(rootNode);
                const layers = 5;
                const goldenRatio = (1 + Math.sqrt(5)) / 2;
                for (let layer = 1; layer <= layers; layer++) {
                    const radius = layer * 4;
                    const numPoints = Math.floor(layer * 12 * densityFactor);
                    for (let i = 0; i < numPoints; i++) {
                        const phi = Math.acos(1 - 2 * (i + 0.5) / numPoints);
                        const theta = 2 * Math.PI * i / goldenRatio;
                        const pos = new THREE.Vector3(
                            radius * Math.sin(phi) * Math.cos(theta),
                            radius * Math.sin(phi) * Math.sin(theta),
                            radius * Math.cos(phi)
                        );
                        const isLeaf = layer === layers || Math.random() < 0.3;
                        const node = new Node(pos, layer, isLeaf ? 1 : 0);
                        node.distanceFromRoot = radius;
                        nodes.push(node);
                        if (layer > 1) {
                            const prevLayerNodes = nodes.filter(n => n.level === layer - 1 && n !== rootNode);
                            prevLayerNodes.sort((a, b) => pos.distanceTo(a.position) - pos.distanceTo(b.position));
                            for (let j = 0; j < Math.min(3, prevLayerNodes.length); j++) {
                                const dist = pos.distanceTo(prevLayerNodes[j].position);
                                const strength = 1.0 - (dist / (radius * 2));
                                node.addConnection(prevLayerNodes[j], Math.max(0.3, strength));
                            }
                        } else {
                            rootNode.addConnection(node, 0.9);
                        }
                    }
                    const layerNodes = nodes.filter(n => n.level === layer && n !== rootNode);
                    for (let i = 0; i < layerNodes.length; i++) {
                        const node = layerNodes[i];
                        const nearby = layerNodes.filter(n => n !== node)
                            .sort((a, b) => node.position.distanceTo(a.position) - node.position.distanceTo(b.position))
                            .slice(0, 5);
                        for (const nearNode of nearby) {
                            const dist = node.position.distanceTo(nearNode.position);
                            if (dist < radius * 0.8 && !node.isConnectedTo(nearNode)) {
                                node.addConnection(nearNode, 0.6);
                            }
                        }
                    }
                }
            };

            const generateHelixLattice = () => {
                rootNode.size = 1.8;
                nodes.push(rootNode);
                const numHelices = 4;
                const height = 30;
                const maxRadius = 12;
                const nodesPerHelix = Math.floor(50 * densityFactor);
                const helixArrays = [];
                for (let h = 0; h < numHelices; h++) {
                    const helixPhase = (h / numHelices) * Math.PI * 2;
                    const helixNodes = [];
                    for (let i = 0; i < nodesPerHelix; i++) {
                        const t = i / (nodesPerHelix - 1);
                        const y = (t - 0.5) * height;
                        const radiusScale = Math.sin(t * Math.PI) * 0.7 + 0.3;
                        const radius = maxRadius * radiusScale;
                        const angle = helixPhase + t * Math.PI * 6;
                        const pos = new THREE.Vector3(radius * Math.cos(angle), y, radius * Math.sin(angle));
                        const level = Math.ceil(t * 5);
                        const isLeaf = i > nodesPerHelix - 5 || Math.random() < 0.25;
                        const node = new Node(pos, level, isLeaf ? 1 : 0);
                        node.distanceFromRoot = Math.sqrt(radius * radius + y * y);
                        node.helixIndex = h;
                        node.helixT = t;
                        nodes.push(node);
                        helixNodes.push(node);
                    }
                    helixArrays.push(helixNodes);
                    rootNode.addConnection(helixNodes[0], 1.0);
                    for (let i = 0; i < helixNodes.length - 1; i++) {
                        helixNodes[i].addConnection(helixNodes[i + 1], 0.85);
                    }
                }
                for (let h = 0; h < numHelices; h++) {
                    const currentHelix = helixArrays[h];
                    const nextHelix = helixArrays[(h + 1) % numHelices];
                    for (let i = 0; i < currentHelix.length; i += 5) {
                        const t = currentHelix[i].helixT || 0;
                        const targetIdx = Math.round(t * (nextHelix.length - 1));
                        if (targetIdx < nextHelix.length) {
                            currentHelix[i].addConnection(nextHelix[targetIdx], 0.7);
                        }
                    }
                }
            };

            const generateFractalWeb = () => {
                rootNode.size = 1.6;
                nodes.push(rootNode);
                const branches = 6;
                const maxDepth = 4;
                const createBranch = (startNode: Node, direction: THREE.Vector3, depth: number, strength: number, scale: number) => {
                    if (depth > maxDepth) return;
                    const branchLength = 5 * scale;
                    const endPos = new THREE.Vector3().copy(startNode.position).add(direction.clone().multiplyScalar(branchLength));
                    const isLeaf = depth === maxDepth || Math.random() < 0.3;
                    const newNode = new Node(endPos, depth, isLeaf ? 1 : 0);
                    newNode.distanceFromRoot = rootNode.position.distanceTo(endPos);
                    nodes.push(newNode);
                    startNode.addConnection(newNode, strength);
                    if (depth < maxDepth) {
                        const subBranches = 3;
                        for (let i = 0; i < subBranches; i++) {
                            const angle = (i / subBranches) * Math.PI * 2;
                            const perpDir1 = new THREE.Vector3(-direction.y, direction.x, 0).normalize();
                            const perpDir2 = direction.clone().cross(perpDir1).normalize();
                            const newDir = new THREE.Vector3().copy(direction)
                                .add(perpDir1.clone().multiplyScalar(Math.cos(angle) * 0.7))
                                .add(perpDir2.clone().multiplyScalar(Math.sin(angle) * 0.7))
                                .normalize();
                            createBranch(newNode, newDir, depth + 1, strength * 0.7, scale * 0.75);
                        }
                    }
                };
                for (let i = 0; i < branches; i++) {
                    const phi = Math.acos(1 - 2 * (i + 0.5) / branches);
                    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
                    const direction = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi)).normalize();
                    createBranch(rootNode, direction, 1, 0.9, 1.0);
                }
            };

            switch (formationIndex % 3) {
                case 0: generateCrystallineSphere(); break;
                case 1: generateHelixLattice(); break;
                case 2: generateFractalWeb(); break;
            }

            if (densityFactor < 1.0) {
                const targetCount = Math.ceil(nodes.length * Math.max(0.3, densityFactor));
                const toKeep = new Set([rootNode]);
                const sortedNodes = nodes.filter(n => n !== rootNode)
                    .sort((a, b) => (b.connections.length / (b.distanceFromRoot + 1)) - (a.connections.length / (a.distanceFromRoot + 1)));
                for (let i = 0; i < Math.min(targetCount - 1, sortedNodes.length); i++) toKeep.add(sortedNodes[i]);
                nodes = nodes.filter(n => toKeep.has(n));
                nodes.forEach(node => {
                    node.connections = node.connections.filter(conn => toKeep.has(conn.node));
                });
            }

            return { nodes, rootNode };
        };

        const createVisualization = () => {
            if (nodesMeshRef.current) {
                scene.remove(nodesMeshRef.current);
                nodesMeshRef.current.geometry.dispose();
                (nodesMeshRef.current.material as THREE.Material).dispose();
            }
            if (connectionsMeshRef.current) {
                scene.remove(connectionsMeshRef.current);
                connectionsMeshRef.current.geometry.dispose();
                (connectionsMeshRef.current.material as THREE.Material).dispose();
            }

            const network = generateNetwork(configRef.current.currentFormation, configRef.current.densityFactor);
            const palette = colorPalettes[configRef.current.activePaletteIndex];

            const nodesGeo = new THREE.BufferGeometry();
            const positions: number[] = [];
            const colors: number[] = [];
            const sizes: number[] = [];
            const types: number[] = [];
            const dists: number[] = [];

            network.nodes.forEach(node => {
                positions.push(node.position.x, node.position.y, node.position.z);
                sizes.push(node.size);
                types.push(node.type);
                dists.push(node.distanceFromRoot);
                const baseColor = palette[Math.min(node.level, palette.length - 1) % palette.length];
                colors.push(baseColor.r, baseColor.g, baseColor.b);
            });

            nodesGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            nodesGeo.setAttribute('nodeColor', new THREE.Float32BufferAttribute(colors, 3));
            nodesGeo.setAttribute('nodeSize', new THREE.Float32BufferAttribute(sizes, 1));
            nodesGeo.setAttribute('nodeType', new THREE.Float32BufferAttribute(types, 1));
            nodesGeo.setAttribute('distanceFromRoot', new THREE.Float32BufferAttribute(dists, 1));

            const nodesMat = new THREE.ShaderMaterial({
                uniforms: THREE.UniformsUtils.clone(pulseUniforms),
                vertexShader: nodeVertexShader,
                fragmentShader: nodeFragmentShader,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending // Always additive
            });
            const nodesMesh = new THREE.Points(nodesGeo, nodesMat);
            scene.add(nodesMesh);
            nodesMeshRef.current = nodesMesh;

            const connGeo = new THREE.BufferGeometry();
            const connPos: number[] = [];
            const connStart: number[] = [];
            const connEnd: number[] = [];
            const connColors: number[] = [];
            const connStrength: number[] = [];
            const pathIndices: number[] = [];
            let pIdx = 0;
            const processed = new Set();

            network.nodes.forEach((node, idx) => {
                node.connections.forEach((c: any) => {
                    const other = c.node;
                    const otherIdx = network.nodes.indexOf(other);
                    const key = [Math.min(idx, otherIdx), Math.max(idx, otherIdx)].join('-');
                    if (!processed.has(key)) {
                        processed.add(key);
                        const segments = 20;
                        const baseColor = palette[Math.min(node.level, palette.length - 1)];
                        for (let i = 0; i < segments; i++) {
                            connPos.push(i / (segments - 1), 0, 0);
                            connStart.push(node.position.x, node.position.y, node.position.z);
                            connEnd.push(other.position.x, other.position.y, other.position.z);
                            connColors.push(baseColor.r, baseColor.g, baseColor.b);
                            connStrength.push(c.strength);
                            pathIndices.push(pIdx);
                        }
                        pIdx++;
                    }
                });
            });

            connGeo.setAttribute('position', new THREE.Float32BufferAttribute(connPos, 3));
            connGeo.setAttribute('startPoint', new THREE.Float32BufferAttribute(connStart, 3));
            connGeo.setAttribute('endPoint', new THREE.Float32BufferAttribute(connEnd, 3));
            connGeo.setAttribute('connectionColor', new THREE.Float32BufferAttribute(connColors, 3));
            connGeo.setAttribute('connectionStrength', new THREE.Float32BufferAttribute(connStrength, 1));
            connGeo.setAttribute('pathIndex', new THREE.Float32BufferAttribute(pathIndices, 1));

            const connMat = new THREE.ShaderMaterial({
                uniforms: THREE.UniformsUtils.clone(pulseUniforms),
                vertexShader: connVertexShader,
                fragmentShader: connFragmentShader,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending // Always additive
            });
            const connMesh = new THREE.LineSegments(connGeo, connMat);
            scene.add(connMesh);
            connectionsMeshRef.current = connMesh;

            palette.forEach((col, i) => {
                if (i < 3) {
                    nodesMat.uniforms.uPulseColors.value[i].copy(col);
                    connMat.uniforms.uPulseColors.value[i].copy(col);
                }
            });
        };

        createVisualization();

        const raycaster = new THREE.Raycaster();
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const target = new THREE.Vector3();
        let pulseIdx = 0;

        const handleInput = (x: number, y: number) => {
            if (configRef.current.paused || !nodesMeshRef.current) return;
            const coords = new THREE.Vector2(
                (x / window.innerWidth) * 2 - 1,
                -(y / window.innerHeight) * 2 + 1
            );
            raycaster.setFromCamera(coords, camera);
            plane.normal.copy(camera.position).normalize();
            plane.constant = -plane.normal.dot(camera.position) + camera.position.length() * 0.5;

            if (raycaster.ray.intersectPlane(plane, target)) {
                const t = performance.now() / 1000;
                pulseIdx = (pulseIdx + 1) % 3;
                const nm = nodesMeshRef.current.material as THREE.ShaderMaterial;
                const cm = connectionsMeshRef.current!.material as THREE.ShaderMaterial;
                nm.uniforms.uPulsePositions.value[pulseIdx].copy(target);
                nm.uniforms.uPulseTimes.value[pulseIdx] = t;
                cm.uniforms.uPulsePositions.value[pulseIdx].copy(target);
                cm.uniforms.uPulseTimes.value[pulseIdx] = t;
            }
        };

        const onClick = (e: MouseEvent) => handleInput(e.clientX, e.clientY);
        window.addEventListener('click', onClick);

        const clock = new THREE.Clock();
        let reqId: number;
        const animate = () => {
            reqId = requestAnimationFrame(animate);
            const t = clock.getElapsedTime();
            if (!configRef.current.paused) {
                controls.update();
                if (nodesMeshRef.current) {
                    (nodesMeshRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
                    nodesMeshRef.current.rotation.y = Math.sin(t * 0.04) * 0.05;
                }
                if (connectionsMeshRef.current) {
                    (connectionsMeshRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
                    connectionsMeshRef.current.rotation.y = Math.sin(t * 0.04) * 0.05;
                }
            }
            (starField.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
            starField.rotation.y += 0.0002;
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

        (window as any).recreateNN = createVisualization;

        (window as any).resetCamera = () => {
            controls.reset();
            controls.autoRotate = false;
            setTimeout(() => { controls.autoRotate = true; }, 2000);
        };

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('click', onClick);
            cancelAnimationFrame(reqId);
            renderer.dispose();
        };
    }, []);

    useEffect(() => {
        configRef.current.activePaletteIndex = activeTheme;
        configRef.current.densityFactor = density / 100;
        configRef.current.paused = paused;
        if ((window as any).recreateNN) (window as any).recreateNN();
    }, [activeTheme, density]);

    useEffect(() => { configRef.current.paused = paused; }, [paused]);

    const handleMorph = () => {
        configRef.current.currentFormation = (configRef.current.currentFormation + 1) % 3;
        if ((window as any).recreateNN) (window as any).recreateNN();
    };

    const handleReset = () => {
        if ((window as any).resetCamera) (window as any).resetCamera();
    };

    return (
        <div className="nn-container" ref={containerRef}>

            {/* Hardcoded Control Styles to match Dark Mode regardless of Theme */}
            <div className="glass-panel" style={{ top: 32, left: 32, width: 280, padding: 24 }}>
                <div style={{ fontWeight: 500, fontSize: 18, marginBottom: 8, background: 'linear-gradient(135deg, #fff 30%, #a5b4fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Quantum Neural Network
                </div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
                    Click anywhere to send energy pulses.
                </div>
            </div>

            <div className="glass-panel" style={{ top: 32, right: 32, padding: 24, width: 220 }}>
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>
                    Crystal Theme
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 20 }}>
                    {[0, 1, 2].map(idx => (
                        <button
                            key={idx}
                            className={`theme-button ${activeTheme === idx ? 'active' : ''}`}
                            style={{ background: idx === 0 ? 'linear-gradient(45deg, #667eea, #764ba2)' : idx === 1 ? 'linear-gradient(45deg, #fb7185, #9f1239)' : 'linear-gradient(45deg, #38bdf8, #0c4a6e)' }}
                            onClick={() => setActiveTheme(idx)}
                        />
                    ))}
                </div>

                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
                    Density: {density}%
                </div>
                <input
                    type="range"
                    min="30" max="100"
                    value={density}
                    onChange={(e) => setDensity(Number(e.target.value))}
                    className="density-slider"
                />
            </div>

            <div style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 16, zIndex: 20 }}>
                <button className="control-button" onClick={handleMorph}>Morph</button>
                <button className="control-button" onClick={() => setPaused(!paused)}>
                    {paused ? 'Resume' : 'Freeze'}
                </button>
                <button className="control-button" onClick={handleReset}>Reset</button>
            </div>

            <canvas ref={canvasRef} className="nn-canvas" />
        </div>
    );
}