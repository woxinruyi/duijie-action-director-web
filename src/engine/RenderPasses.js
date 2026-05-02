import * as THREE from 'three';

/**
 * 7-pass ControlNet rendering system.
 * Each pass uses custom materials applied temporarily to scene objects.
 */

// OpenPose body part color mapping
const POSE_COLORS = {
  'Hips': 0xff0000, 'Spine': 0xff5500, 'Spine1': 0xffaa00, 'Spine2': 0xffff00,
  'Neck': 0xaaff00, 'Head': 0x55ff00,
  'LeftShoulder': 0x00ff00, 'LeftArm': 0x00ff55, 'LeftForeArm': 0x00ffaa, 'LeftHand': 0x00ffff,
  'RightShoulder': 0x0000ff, 'RightArm': 0x5500ff, 'RightForeArm': 0xaa00ff, 'RightHand': 0xff00ff,
  'LeftUpLeg': 0x00aaff, 'LeftLeg': 0x0055ff, 'LeftFoot': 0x0000aa,
  'RightUpLeg': 0xff00aa, 'RightLeg': 0xff0055, 'RightFoot': 0xaa0000,
};

export class RenderPasses {
  constructor(sceneManager) {
    this.scene = sceneManager;
    this.depthNear = 0.1;
    this.depthFar = 100;

    // Canny rim-light shader (Fresnel)
    this.cannyMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float rim = 1.0 - max(dot(vNormal, vViewDir), 0.0);
          rim = pow(rim, 2.0);
          gl_FragColor = vec4(vec3(rim), 1.0);
        }
      `,
    });

    // Depth material
    this.depthMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uNear: { value: this.depthNear },
        uFar: { value: this.depthFar },
      },
      vertexShader: `
        varying float vDepth;
        uniform float uNear;
        uniform float uFar;
        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vDepth = (-mvPos.z - uNear) / (uFar - uNear);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying float vDepth;
        void main() {
          float d = 1.0 - clamp(vDepth, 0.0, 1.0);
          gl_FragColor = vec4(vec3(d), 1.0);
        }
      `,
    });

    // Pose material (flat unlit colors per bone)
    this.poseMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });

    // Normal material
    this.normalMaterial = new THREE.MeshNormalMaterial();

    // Shaded (clay) material
    this.shadedMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888, roughness: 0.7, metalness: 0.0,
    });

    // Alpha material
    this.alphaMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  }

  setDepthRange(near, far) {
    this.depthNear = near;
    this.depthFar = far;
    this.depthMaterial.uniforms.uNear.value = near;
    this.depthMaterial.uniforms.uFar.value = far;
  }

  /**
   * Render a specific pass to a canvas.
   * @param {string} passName - 'pose'|'depth'|'canny'|'normal'|'shaded'|'alpha'|'textured'
   * @param {number} width
   * @param {number} height
   * @returns {HTMLCanvasElement}
   */
  renderPass(passName, width, height) {
    const { scene, camera, renderer } = this.scene;
    const originalMaterials = new Map();
    const originalBg = scene.background;
    const originalFog = scene.fog;

    // Store original materials
    scene.traverse(child => {
      if (child.isMesh) {
        originalMaterials.set(child, child.material);
      }
    });

    // Set pass-specific materials and background
    switch (passName) {
      case 'pose':
        scene.background = new THREE.Color(0x000000);
        scene.fog = null;
        scene.traverse(child => {
          if (child.isMesh) {
            const boneName = this._findBoneName(child);
            const color = POSE_COLORS[boneName] || 0xff0000;
            child.material = new THREE.MeshBasicMaterial({ color });
          }
        });
        break;

      case 'depth':
        scene.background = new THREE.Color(0x000000);
        scene.fog = null;
        scene.traverse(child => {
          if (child.isMesh) child.material = this.depthMaterial;
        });
        break;

      case 'canny':
        scene.background = new THREE.Color(0x000000);
        scene.fog = null;
        scene.traverse(child => {
          if (child.isMesh) child.material = this.cannyMaterial;
        });
        break;

      case 'normal':
        scene.background = new THREE.Color(0x8080ff);
        scene.fog = null;
        scene.traverse(child => {
          if (child.isMesh) child.material = this.normalMaterial;
        });
        break;

      case 'shaded':
        // Keep default lighting, just swap materials
        scene.traverse(child => {
          if (child.isMesh) child.material = this.shadedMaterial;
        });
        break;

      case 'alpha':
        scene.background = new THREE.Color(0x000000);
        scene.fog = null;
        scene.traverse(child => {
          if (child.isMesh) child.material = this.alphaMaterial;
        });
        break;

      case 'textured':
        // Use original materials — no swap needed
        break;
    }

    // Render to offscreen target
    const rt = new THREE.WebGLRenderTarget(width, height);
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    // Read pixels
    const pixels = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, width, height, pixels);
    rt.dispose();

    // Create canvas with flipped Y
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const src = ((height - 1 - y) * width + x) * 4;
        const dst = (y * width + x) * 4;
        imgData.data[dst] = pixels[src];
        imgData.data[dst + 1] = pixels[src + 1];
        imgData.data[dst + 2] = pixels[src + 2];
        imgData.data[dst + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Restore materials & scene state
    scene.traverse(child => {
      if (child.isMesh && originalMaterials.has(child)) {
        child.material = originalMaterials.get(child);
      }
    });
    scene.background = originalBg;
    scene.fog = originalFog;

    return canvas;
  }

  _findBoneName(mesh) {
    let current = mesh.parent;
    while (current) {
      if (current.isBone) return current.name.replace(/^mixamorig:?/, '');
      current = current.parent;
    }
    return 'Unknown';
  }

  /** Render all 7 passes and return them as an object of canvases */
  renderAllPasses(width, height) {
    return {
      pose: this.renderPass('pose', width, height),
      depth: this.renderPass('depth', width, height),
      canny: this.renderPass('canny', width, height),
      normal: this.renderPass('normal', width, height),
      shaded: this.renderPass('shaded', width, height),
      alpha: this.renderPass('alpha', width, height),
      textured: this.renderPass('textured', width, height),
    };
  }
}
