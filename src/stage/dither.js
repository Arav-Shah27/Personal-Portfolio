/* ==========================================================================
   The dither pass: the last step for every frame on the stage.

   Scenes draw into a small render target (one texel per art pixel). This pass
   turns each texel into a gold pixel: its brightness picks a step on the
   palette ramp, and a 4x4 Bayer matrix decides, pixel by pixel, whether it
   rounds up or down. That ordered pattern is what makes smooth light read as
   hand-placed pixel art.

   The alpha channel is a second, rarer path: where a scene writes alpha > 0,
   the pixel keeps its true colour (posterised, and dithered in by the same
   matrix), which is how a lightning flash briefly shows the painting as it
   really is.
   ========================================================================== */
import * as THREE from "three";
import { RAMP } from "./palette.js";

export function createDitherPass() {
  const ramp = RAMP.map((h) => new THREE.Color(h));   /* raw sRGB numbers, no colour management */
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      uScene: { value: null },
      uRamp: { value: ramp.map((c) => new THREE.Vector3(c.r, c.g, c.b)) },
      uLift: { value: 0 },
    },
    vertexShader: /* glsl */ `
      out vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D uScene;
      uniform vec3 uRamp[${RAMP.length}];
      uniform float uLift;
      in vec2 vUv;
      out vec4 fragColor;

      float bayer4(vec2 p) {
        ivec2 q = ivec2(mod(p, 4.0));
        int i = q.x + q.y * 4;
        int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
        return (float(m[i]) + 0.5) / 16.0;
      }

      void main() {
        vec4 c = texture(uScene, vUv);
        float b = bayer4(gl_FragCoord.xy);

        float L = clamp(dot(c.rgb, vec3(0.299, 0.587, 0.114)) + uLift, 0.0, 1.0);
        float steps = float(${RAMP.length - 1});
        float lv = L * steps;
        float i = floor(lv);
        i = min(steps, i + step(b, lv - i));
        vec3 gold = uRamp[int(i)];

        vec3 tc = clamp(floor(c.rgb * 5.0 + b) / 5.0, 0.0, 1.0);
        fragColor = vec4(c.a > b ? tc : gold, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return { scene, camera, material };
}
