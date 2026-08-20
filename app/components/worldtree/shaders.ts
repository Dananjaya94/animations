// --- SHADERS ---

export const commonNoise = `
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

// Branches are rendered as an InstancedMesh of tapered cylinder segments (real volume,
// instead of 1px wireframe lines). \`position\`/\`normal\` are the shared unit-cylinder's
// vertex/normal; \`instanceMatrix\` (auto-provided by three.js for InstancedMesh) carries
// each segment's placement, orientation and taper.
export const branchVertexShader = `
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

    vec3 pos = (instanceMatrix * vec4(position, 1.0)).xyz;

    // Adjust height normalization to better fit the visual range of the tree
    vHeight = smoothstep(-20.0, 60.0, pos.y);

    // Sway logic
    float canopyMask = smoothstep(0.0, 20.0, pos.y);
    // Wind gusts: a slow, large-scale noise field modulates the sway amplitude
    // over time instead of it being constant, so wind feels like it comes in waves.
    float gust = 0.6 + 0.4 * snoise(vec3(uTime * 0.06, branchOffset * 3.0, 0.0));
    float canopySway = pow(vLevel, 2.0) * 1.5 * canopyMask * gust;
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

    // Real surface normal (was a normalize(position) hack back when branches were lines).
    vNormal = normalize(mat3(instanceMatrix) * normal);
    vPos = pos; // ✅ Save position

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
}
`;

export const branchFragmentShader = `
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

    // 3. Lighting — key (sun) plus a soft sky/ground fill, so the shadowed side of a
    // real cylindrical branch doesn't read as a flat black silhouette.
    vec3 n = normalize(vNormal);
    float key = max(dot(n, normalize(uSunDirection)), 0.0);
    float fill = 0.4 + 0.15 * (n.y * 0.5 + 0.5);
    float light = key * 0.7 + fill;
    vec3 litColor = texturedColor * light;

    // 4. Pulse
    vec3 finalColor = mix(litColor, uPulseColor, vPulse * 0.8);
    finalColor *= 1.0 + (vPulse * 2.5);

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

export const leafVertexShader = `
${commonNoise}
attribute float size;
attribute float offset;
attribute float colorSeed;
uniform float uTime;
uniform float uSpeed;
varying float vOpacity;
varying vec3 vWorldPos;
varying float vColorSeed;

void main() {
    vec3 pos = position;
    float t = uTime * uSpeed * 0.5 + offset * 10.0;

    pos.x += sin(t * 0.5) * 1.0;
    pos.y += cos(t * 0.3) * 0.5;
    pos.z += sin(t * 0.7) * 1.0;

    float shimmer = snoise(vec3(pos * 0.2 + uTime * uSpeed));
    vOpacity = 0.6 + shimmer * 0.4;
    vColorSeed = colorSeed;

    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = size * (400.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
}
`;

export const leafFragmentShader = `
uniform vec3 uLeafColor;
uniform vec3 uSunDirection;
varying float vOpacity;
varying vec3 vWorldPos;
varying float vColorSeed;

void main() {
    vec2 c = gl_PointCoord - 0.5;
    // A slightly irregular, teardrop-ish silhouette instead of a perfect circle/dot,
    // so clusters read as clumps of foliage rather than uniform round sprites.
    float dist = length(c) + 0.12 * c.y - 0.06 * sin(vColorSeed * 30.0 + c.x * 8.0);
    if (dist > 0.5) discard;
    float glow = 1.0 - smoothstep(0.15, 0.5, dist);

    // Fake Leaf Lighting (Leaves higher up and facing sun are brighter)
    // Simple directional approximation since particles don't have normals
    float light = dot(normalize(vWorldPos), normalize(uSunDirection)) * 0.5 + 0.5;

    // Per-leaf hue variance: some leaves skew darker/olive, some lighter/yellow-green,
    // instead of every leaf being the exact same flat color.
    vec3 darkLeaf = uLeafColor * 0.55;
    vec3 lightLeaf = mix(uLeafColor, vec3(0.85, 0.8, 0.35), 0.35);
    vec3 leafColor = mix(darkLeaf, lightLeaf, vColorSeed);

    vec3 finalColor = leafColor * (0.55 + 0.45 * light);

    gl_FragColor = vec4(finalColor, glow * vOpacity * 0.75);
}
`;

// --- TERRAIN SHADERS ---

// The rolling-hill displacement, per-vertex normal, and vNoiseHeight are baked once
// on the CPU (see terrain.ts) instead of being recomputed here every vertex, every
// frame — this shader just passes the baked attributes through.
export const terrainVertexShader = `
attribute float aNoiseHeight;
attribute vec3 aBakedNormal;
varying float vNoiseHeight;
varying vec3 vWorldPos;
varying vec3 vNormal;

void main() {
    vNoiseHeight = aNoiseHeight;
    vNormal = normalize(mat3(modelMatrix) * aBakedNormal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const terrainFragmentShader = `
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
    // Valleys stay gently shaded rather than dropping to near-black mud.
    float creviceShadow = smoothstep(-15.0, 15.0, vNoiseHeight);
    vec3 finalGroundColor = soilBase * (0.75 + 0.25 * creviceShadow);

    vec3 up = vec3(0.0, 1.0, 0.0);
    float slope = dot(vNormal, up);

    // 2. Exposed rock on steep slopes (near-vertical faces have a low dot with "up")
    float rockExposure = 1.0 - smoothstep(0.35, 0.65, slope);
    vec3 rockColor = uRockColor * (0.85 + 0.15 * patchNoiseSmall);
    finalGroundColor = mix(finalGroundColor, rockColor, rockExposure);

    // 3. Grass — a large-scale field decides where meadow vs. bare ground/patchy dirt
    // shows through, with fine-grained blade clumping layered on top, so it reads as
    // a grove floor rather than a flat green wash or bare dune.
    float grassField = fbm(vWorldPos * 0.02 + vec3(50.0));
    float grassClump = snoise(vec3(vWorldPos.x * 0.9, 0.0, vWorldPos.z * 0.9));
    float grassPattern = smoothstep(-0.25, 0.25, grassField) * (0.65 + 0.35 * smoothstep(-0.3, 0.4, grassClump));
    float slopeFactor = smoothstep(0.4, 0.7, slope);
    float grassCoverage = clamp(grassPattern * slopeFactor, 0.0, 1.0);

    // Dry/lit patches skew yellow-green instead of every blade being one flat green.
    vec3 grassDry = mix(uGrassColor, vec3(0.75, 0.72, 0.32), 0.4);
    vec3 grassColor = mix(uGrassColor, grassDry, smoothstep(0.2, 0.8, patchNoiseSmall * 0.5 + 0.5));
    finalGroundColor = mix(finalGroundColor, grassColor, grassCoverage);

    // 4. SUN LIGHTING
    float light = max(dot(vNormal, normalize(uSunDirection)), 0.0);
    // Ambient light
    float ambient = 0.2;
    // Shadow color (bluish tint in shadows)
    vec3 shadowTint = vec3(0.1, 0.1, 0.3);

    vec3 litColor = finalGroundColor * (light + ambient);
    // Add shadow tint to dark areas
    litColor = mix(litColor, litColor * shadowTint, 1.0 - (light + ambient));

    // 5. Fog
    float dist = length(vWorldPos.xz);
    float fogFactor = smoothstep(200.0, 900.0, dist);
    vec3 finalColor = mix(litColor, uFogColor, fogFactor);

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

// --- CLOUD SHADER ---
export const cloudVertexShader = `
varying vec3 vWorldPos;
varying vec2 vUv;
void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

// uScale/uThreshold/uOpacity let the same shader drive multiple differently-configured
// cloud layers (see worldtree.tsx: a low, denser puffy layer + a high, sparser wispy one).
export const cloudFragmentShader = `
${commonNoise}
uniform float uTime;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform float uScale;
uniform vec2 uThreshold;
uniform float uOpacity;
uniform float uWindSpeed;
varying vec3 vWorldPos;

void main() {
    // Scroll noise over time
    vec3 pos = vWorldPos * uScale; // Large scale
    pos.x += uTime * uWindSpeed; // Wind

    float n1 = fbm(pos);
    float n2 = fbm(pos * 2.0 + vec3(2.0)); // Detail

    float cloudDensity = n1 * 0.7 + n2 * 0.3;

    // Cutoff to make separate clouds.
    float alpha = smoothstep(uThreshold.x, uThreshold.y, cloudDensity);

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

    gl_FragColor = vec4(cloudColor, alpha * uOpacity);
}
`;

// --- SKY SHADER ---
export const skyVertexShader = `
varying vec3 vWorldPos;
void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

export const skyFragmentShader = `
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
