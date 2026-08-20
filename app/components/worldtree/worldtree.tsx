'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import {
    branchVertexShader, branchFragmentShader,
    leafVertexShader, leafFragmentShader,
    terrainVertexShader, terrainFragmentShader,
    cloudVertexShader, cloudFragmentShader,
    skyVertexShader, skyFragmentShader,
} from './shaders';
import { themes } from './themes';
import { generateWorldTree } from './tree-generation';
import { bakeTerrainGeometry } from './terrain';
import './worldtree.css';

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
    const treeMeshRef = useRef<THREE.InstancedMesh | null>(null);
    const leavesMeshRef = useRef<THREE.Points | null>(null);
    const groundMeshRef = useRef<THREE.Mesh | null>(null);
    const skyMeshRef = useRef<THREE.Mesh | null>(null);
    const cloudMeshRef = useRef<THREE.Mesh | null>(null);
    const cloudMesh2Ref = useRef<THREE.Mesh | null>(null);
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
        const canvasEl = canvasRef.current;

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        if (width === 0 || height === 0) return;

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x112233, 0.0015);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 2500);
        camera.position.set(0, 20, 140);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({
            canvas: canvasEl,
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
        // Two layers for depth: a lower, denser puffy layer and a higher, sparser wispy
        // layer that drifts at a different speed, so the sky doesn't read as a single flat shell.
        const cloudGeo = new THREE.SphereGeometry(1100, 32, 32);
        const cloudMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uSunDirection: { value: configRef.current.sunPosition },
                uSunColor: { value: new THREE.Color(themes[0].sunColor) },
                uScale: { value: 0.0022 },
                uThreshold: { value: new THREE.Vector2(-0.2, 0.4) },
                uOpacity: { value: 0.7 },
                uWindSpeed: { value: 0.01 },
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

        // Must stay inside the opaque sky dome's radius (1200) or the depth test discards it.
        const cloudGeo2 = new THREE.SphereGeometry(1150, 32, 32);
        const cloudMat2 = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uSunDirection: { value: configRef.current.sunPosition },
                uSunColor: { value: new THREE.Color(themes[0].sunColor) },
                uScale: { value: 0.0012 },
                uThreshold: { value: new THREE.Vector2(-0.05, 0.45) },
                uOpacity: { value: 0.45 },
                uWindSpeed: { value: 0.004 },
            },
            vertexShader: cloudVertexShader,
            fragmentShader: cloudFragmentShader,
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: false
        });
        const cloudMesh2 = new THREE.Mesh(cloudGeo2, cloudMat2);
        scene.add(cloudMesh2);
        cloudMesh2Ref.current = cloudMesh2;

        // --- INFINITE TERRAIN (baked once — doesn't depend on growth level) ---
        const groundGeo = bakeTerrainGeometry();
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

        const segmentDummy = new THREE.Object3D();
        const segmentYAxis = new THREE.Vector3(0, 1, 0);
        const segmentDir = new THREE.Vector3();
        const segmentMid = new THREE.Vector3();

        const rebuildTree = () => {
            if (treeMeshRef.current) {
                scene.remove(treeMeshRef.current);
                treeMeshRef.current.geometry.dispose();
                (treeMeshRef.current.material as THREE.Material).dispose();
                treeMeshRef.current.dispose(); // releases the instanceMatrix GPU buffer
            }
            if (leavesMeshRef.current) {
                scene.remove(leavesMeshRef.current);
                leavesMeshRef.current.geometry.dispose();
                (leavesMeshRef.current.material as THREE.Material).dispose();
            }

            const data = generateWorldTree(configRef.current.growth);

            // Tree — real tapered tube geometry (InstancedMesh of a shared unit cylinder)
            // instead of 1px wireframe lines.
            const count = data.segments.length;
            const branchGeo = new THREE.CylinderGeometry(0.72, 1, 1, 7, 1, false);
            const branchMat = new THREE.ShaderMaterial({
                uniforms: treeUniforms,
                vertexShader: branchVertexShader,
                fragmentShader: branchFragmentShader,
                transparent: true,
                depthWrite: true,
                blending: THREE.NormalBlending,
            });
            const treeMesh = new THREE.InstancedMesh(branchGeo, branchMat, count);

            const levels = new Float32Array(count);
            const branchOffsets = new Float32Array(count);
            for (let i = 0; i < count; i++) {
                const seg = data.segments[i];
                segmentDir.subVectors(seg.end, seg.start);
                const length = segmentDir.length();
                if (length > 1e-6) {
                    segmentDir.divideScalar(length);
                    segmentMid.addVectors(seg.start, seg.end).multiplyScalar(0.5);
                    segmentDummy.position.copy(segmentMid);
                    segmentDummy.quaternion.setFromUnitVectors(segmentYAxis, segmentDir);
                    segmentDummy.scale.set(seg.radius, length, seg.radius);
                    segmentDummy.updateMatrix();
                    treeMesh.setMatrixAt(i, segmentDummy.matrix);
                }
                levels[i] = seg.level;
                branchOffsets[i] = seg.offset;
            }
            treeMesh.instanceMatrix.needsUpdate = true;
            branchGeo.setAttribute('level', new THREE.InstancedBufferAttribute(levels, 1));
            branchGeo.setAttribute('branchOffset', new THREE.InstancedBufferAttribute(branchOffsets, 1));

            scene.add(treeMesh);
            treeMeshRef.current = treeMesh;

            // Leaves
            const leafGeo = new THREE.BufferGeometry();
            leafGeo.setAttribute('position', new THREE.Float32BufferAttribute(data.leafGeo.positions, 3));
            leafGeo.setAttribute('size', new THREE.Float32BufferAttribute(data.leafGeo.sizes, 1));
            leafGeo.setAttribute('offset', new THREE.Float32BufferAttribute(data.leafGeo.offsets, 1));
            leafGeo.setAttribute('colorSeed', new THREE.Float32BufferAttribute(data.leafGeo.colorSeeds, 1));
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
        };

        rebuildTree();

        const raycaster = new THREE.Raycaster();
        // Matches the flattened ground height near the tree base (see terrain.ts's
        // `flatten` falloff), which is the area the `intersect.length() < 50` check accepts.
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 5);

        const handleInput = (clientX: number, clientY: number) => {
            const rect = canvasEl.getBoundingClientRect();
            const coords = new THREE.Vector2(
                ((clientX - rect.left) / rect.width) * 2 - 1,
                -((clientY - rect.top) / rect.height) * 2 + 1
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
        canvasEl.addEventListener('click', onClick);

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
            if (cloudMesh2Ref.current) {
                (cloudMesh2Ref.current.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed;
                cloudMesh2Ref.current.rotation.y = elapsed * -0.006;
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
            if (cloudMesh2Ref.current) {
                (cloudMesh2Ref.current.material as THREE.ShaderMaterial).uniforms.uSunColor.value.setHex(t.sunColor);
            }
            if (sceneRef.current?.fog) {
                (sceneRef.current.fog as THREE.FogExp2).color.setHex(t.fog);
            }
        };

        return () => {
            window.removeEventListener('resize', handleResize);
            canvasEl.removeEventListener('click', onClick);
            cancelAnimationFrame(reqId);

            treeMeshRef.current?.geometry.dispose();
            (treeMeshRef.current?.material as THREE.Material | undefined)?.dispose();
            treeMeshRef.current?.dispose(); // releases the instanceMatrix GPU buffer
            leavesMeshRef.current?.geometry.dispose();
            (leavesMeshRef.current?.material as THREE.Material | undefined)?.dispose();
            groundGeo.dispose();
            groundMat.dispose();
            skyGeo.dispose();
            skyMat.dispose();
            cloudGeo.dispose();
            cloudMat.dispose();
            cloudGeo2.dispose();
            cloudMat2.dispose();

            controls.dispose();
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
            <div className="glass-panel wt-panel-title">
                <div className="wt-title">Peonix Engine</div>
                <div className="wt-hint">Click the ground to channel energy.</div>
            </div>

            <div className="glass-panel wt-panel-controls">
                <div className="wt-label">Essence Type</div>
                <div className="wt-theme-row" role="group" aria-label="Essence type">
                    {themes.map((theme, idx) => (
                        <button
                            key={theme.name}
                            type="button"
                            className={`theme-button ${activeTheme === idx ? 'active' : ''}`}
                            style={{ background: `linear-gradient(135deg, ${new THREE.Color(theme.base).getStyle()}, ${new THREE.Color(theme.tip).getStyle()})` }}
                            onClick={() => setActiveTheme(idx)}
                            aria-label={`${theme.name} essence`}
                            aria-pressed={activeTheme === idx}
                            title={theme.name}
                        />
                    ))}
                </div>

                <div className="wt-label wt-label-row">
                    <label htmlFor="wt-growth">Canopy Density</label> <span>{growthLevel}</span>
                </div>
                <input
                    id="wt-growth"
                    type="range" min="3" max="7" step="1" value={growthLevel}
                    onChange={(e) => setGrowthLevel(Number(e.target.value))}
                    className="control-slider"
                    aria-valuetext={`${growthLevel}`}
                />

                <div className="wt-label wt-label-row wt-label-spaced">
                    <label htmlFor="wt-speed">Flow Rate</label> <span>{flowSpeed.toFixed(1)}x</span>
                </div>
                <input
                    id="wt-speed"
                    type="range" min="0.1" max="3.0" step="0.1" value={flowSpeed}
                    onChange={(e) => setFlowSpeed(Number(e.target.value))}
                    className="control-slider"
                    aria-valuetext={`${flowSpeed.toFixed(1)}x`}
                />
            </div>

            <canvas ref={canvasRef} className="wt-canvas" />
        </div>
    );
}
