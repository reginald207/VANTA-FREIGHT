// The night yard: a shader floor, headlight beams and the light rig.
// Everything is analytic (no textures, no shadow maps).
import {
  AdditiveBlending,
  ConeGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector4,
} from 'three';
import { FOG_DENSITY, PALETTE } from './palette.js';

const floorVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const floorFragment = /* glsl */ `
  uniform float uOffset;
  uniform float uHeadlights;
  uniform float uStrip;
  uniform float uFogDensity;
  uniform vec3 uBg;
  uniform vec3 uLime;
  uniform vec3 uIce;
  uniform vec3 uSteel;
  uniform vec4 uFootprint; // minX, maxX, halfWidth, frontX
  varying vec3 vWorld;

  float gridLine(float coord, float size) {
    float c = coord / size;
    float d = abs(fract(c - 0.5) - 0.5) / fwidth(c);
    return 1.0 - min(d, 1.0);
  }

  float stripe(float coord, float centre, float halfWidth) {
    float d = abs(coord - centre) - halfWidth;
    return 1.0 - smoothstep(0.0, fwidth(coord) * 1.5, d);
  }

  float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  }

  void main() {
    vec2 p = vWorld.xz;
    float sx = p.x + uOffset; // road coordinate, scrolls as the truck drives
    vec3 col = uBg * 1.35;

    // Faint survey grid
    float g = max(gridLine(sx, 2.0), gridLine(p.y, 2.0));
    col += uSteel * g * 0.03;

    // Lane edges (solid) and dashed dividers
    float az = abs(p.y);
    col += uSteel * stripe(az, 1.95, 0.025) * 0.2;
    float dash = step(fract(sx / 9.0), 0.36);
    col += uIce * stripe(az, 5.7, 0.07) * dash * 0.14;

    // Contact shadow and lime under-glow around the truck footprint
    vec2 centre = vec2((uFootprint.x + uFootprint.y) * 0.5, 0.0);
    vec2 halfSize = vec2((uFootprint.y - uFootprint.x) * 0.5, uFootprint.z);
    float sd = sdBox(p - centre, halfSize);
    col *= 1.0 - (1.0 - smoothstep(-0.5, 0.9, sd)) * 0.85;
    float glow = exp(-max(sd, 0.0) * 2.4) * smoothstep(-0.3, 0.1, sd);
    col += uLime * glow * 0.09 * uStrip;

    // Headlight pools ahead of the cab
    float fx = p.x - uFootprint.w;
    if (fx > 0.0) {
      float along = exp(-fx * 0.11) * smoothstep(0.0, 1.8, fx);
      for (int i = 0; i < 2; i++) {
        float side = i == 0 ? -0.92 : 0.92;
        float spread = 0.35 + fx * 0.2;
        float lateral = (p.y - side * (1.0 + fx * 0.06)) / spread;
        col += uIce * exp(-lateral * lateral) * along * 0.16 * uHeadlights;
      }
    }

    // Exponential fog, matched to the scene's FogExp2 and clear colour
    float dist = length(vWorld - cameraPosition);
    float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    col = mix(col, uBg, fog);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createFloor(footprint) {
  const material = new ShaderMaterial({
    vertexShader: floorVertex,
    fragmentShader: floorFragment,
    toneMapped: false,
    uniforms: {
      uOffset: { value: 0 },
      uHeadlights: { value: 0 },
      uStrip: { value: 0 },
      uFogDensity: { value: FOG_DENSITY },
      uBg: { value: PALETTE.obsidian },
      uLime: { value: PALETTE.lime },
      uIce: { value: PALETTE.ice },
      uSteel: { value: PALETTE.steel },
      uFootprint: {
        value: new Vector4(footprint.minX, footprint.maxX, footprint.halfWidth, footprint.frontX),
      },
    },
  });

  const geometry = new PlaneGeometry(260, 260);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geometry, material);
  mesh.name = 'floor';

  return {
    mesh,
    setOffset(value) {
      // Wrap to keep float precision; the pattern repeats every 18 m.
      material.uniforms.uOffset.value = value % 18;
    },
    setLights(headlights, strip) {
      material.uniforms.uHeadlights.value = headlights;
      material.uniforms.uStrip.value = strip;
    },
  };
}

const beamVertex = /* glsl */ `
  varying float vAlong;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vAlong = 1.0 - uv.y;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const beamFragment = /* glsl */ `
  uniform float uIntensity;
  uniform vec3 uColor;
  varying float vAlong;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float edge = pow(abs(dot(normalize(vNormal), vView)), 1.4);
    float falloff = pow(1.0 - vAlong, 1.8) * smoothstep(0.0, 0.06, vAlong);
    float alpha = uIntensity * 0.055 * falloff * edge;
    gl_FragColor = vec4(uColor * alpha, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createHeadlightBeams(positions) {
  const material = new ShaderMaterial({
    vertexShader: beamVertex,
    fragmentShader: beamFragment,
    uniforms: { uIntensity: { value: 0 }, uColor: { value: PALETTE.ice } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
  });

  const group = new Group();
  group.name = 'headlight-beams';
  positions.forEach((position) => {
    // Cone with its tip at the lamp, opening forward (+X), tilted slightly down.
    const geometry = new ConeGeometry(1.9, 11, 32, 1, true);
    geometry.translate(0, -5.5, 0);
    geometry.rotateZ(Math.PI / 2 - 0.05);
    geometry.translate(position.x + 0.02, position.y, position.z);
    group.add(new Mesh(geometry, material));
  });

  return {
    group,
    setIntensity(value) {
      material.uniforms.uIntensity.value = value;
      group.visible = value > 0.01;
    },
  };
}

export function createLights() {
  const group = new Group();
  group.name = 'lights';

  group.add(new HemisphereLight(PALETTE.ice, PALETTE.obsidian, 0.35));

  const key = new DirectionalLight(PALETTE.ice, 2.8);
  key.position.set(9, 11, 7);
  group.add(key);

  // Lime rim from behind and to the left: the signature edge light.
  const rim = new DirectionalLight(PALETTE.lime, 3.2);
  rim.position.set(-12, 5, -8);
  group.add(rim);

  const fill = new DirectionalLight('#9fb4c8', 0.7);
  fill.position.set(4, 1.5, 12);
  group.add(fill);

  // Soft lime kicker from above and behind: picks out roof and top edges.
  const kicker = new DirectionalLight(PALETTE.lime, 1.2);
  kicker.position.set(-6, 12, 4);
  group.add(kicker);

  return group;
}
