import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.mixers = [];
    this.objects = [];
    this.selectedObject = null;
    this.renderMode = 'shaded';
    this.showGrid = true;
    this.showSkeleton = false;
    this.onObjectSelected = null;
    this.fpsFrames = 0;
    this.fpsTime = 0;
    this.currentFps = 60;

    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initControls();
    this._initLights();
    this._initGrid();
    this._initPostProcessing();
    this._initRaycaster();
    this._animate();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a18);
    this.scene.fog = new THREE.FogExp2(0x0a0a18, 0.015);
  }

  _initCamera() {
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.set(3, 2.5, 5);
    this.camera.lookAt(0, 1, 0);
  }

  _initControls() {
    this.orbitControls = new OrbitControls(this.camera, this.canvas);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.08;
    this.orbitControls.target.set(0, 1, 0);
    this.orbitControls.minDistance = 0.5;
    this.orbitControls.maxDistance = 100;

    this.transformControls = new TransformControls(this.camera, this.canvas);
    this.transformControls.setSize(0.7);
    this.scene.add(this.transformControls);

    this.transformControls.addEventListener('dragging-changed', (e) => {
      this.orbitControls.enabled = !e.value;
    });
  }

  _initLights() {
    const ambient = new THREE.AmbientLight(0x404060, 0.6);
    this.scene.add(ambient);

    this.keyLight = new THREE.DirectionalLight(0xffeedd, 1.5);
    this.keyLight.position.set(5, 8, 5);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 0.1;
    this.keyLight.shadow.camera.far = 50;
    this.keyLight.shadow.camera.left = -10;
    this.keyLight.shadow.camera.right = 10;
    this.keyLight.shadow.camera.top = 10;
    this.keyLight.shadow.camera.bottom = -10;
    this.keyLight.shadow.bias = -0.001;
    this.scene.add(this.keyLight);

    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.4);
    fillLight.position.set(-3, 4, -3);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xff88aa, 0.3);
    rimLight.position.set(0, 2, -5);
    this.scene.add(rimLight);
  }

  _initGrid() {
    this.gridHelper = new THREE.GridHelper(20, 40, 0x222244, 0x151530);
    this.scene.add(this.gridHelper);

    const planeGeo = new THREE.PlaneGeometry(40, 40);
    const planeMat = new THREE.ShadowMaterial({ opacity: 0.3 });
    this.shadowPlane = new THREE.Mesh(planeGeo, planeMat);
    this.shadowPlane.rotation.x = -Math.PI / 2;
    this.shadowPlane.receiveShadow = true;
    this.scene.add(this.shadowPlane);

    // Axis marker
    const axisHelper = new THREE.AxesHelper(0.5);
    axisHelper.position.set(0, 0.001, 0);
    this.scene.add(axisHelper);
  }

  _initPostProcessing() {
    const size = this.renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(size, 0.15, 0.4, 0.85);
    this.composer.addPass(this.bloomPass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  _initRaycaster() {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.canvas.addEventListener('click', (e) => {
      if (this.transformControls.dragging) return;
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this._pickObject();
    });
  }

  _pickObject() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = [];
    this.objects.forEach(obj => {
      obj.traverse(child => { if (child.isMesh) meshes.push(child); });
    });
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length > 0) {
      let target = hits[0].object;
      while (target.parent && !this.objects.includes(target)) {
        target = target.parent;
      }
      this.selectObject(target);
    } else {
      this.deselectObject();
    }
  }

  selectObject(obj) {
    this.selectedObject = obj;
    this.transformControls.attach(obj);
    if (this.onObjectSelected) this.onObjectSelected(obj);
  }

  deselectObject() {
    this.selectedObject = null;
    this.transformControls.detach();
    if (this.onObjectSelected) this.onObjectSelected(null);
  }

  setGizmoMode(mode) {
    this.transformControls.setMode(mode);
  }

  addObject(obj) {
    this.scene.add(obj);
    this.objects.push(obj);
  }

  removeObject(obj) {
    this.scene.remove(obj);
    const idx = this.objects.indexOf(obj);
    if (idx !== -1) this.objects.splice(idx, 1);
    if (this.selectedObject === obj) this.deselectObject();
  }

  addMixer(mixer) {
    this.mixers.push(mixer);
  }

  removeMixer(mixer) {
    const idx = this.mixers.indexOf(mixer);
    if (idx !== -1) this.mixers.splice(idx, 1);
  }

  setRenderMode(mode) {
    this.renderMode = mode;
  }

  _resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.canvas.width = w;
    this.canvas.height = h;
    this.renderer.setSize(w, h);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    if (this.composer) {
      this.composer.setSize(w, h);
    }
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    const delta = this.clock.getDelta();

    // FPS calc
    this.fpsFrames++;
    this.fpsTime += delta;
    if (this.fpsTime >= 0.5) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsTime = 0;
      const el = document.getElementById('infoFps');
      if (el) el.textContent = `${this.currentFps} FPS`;
    }

    // Update object count
    const infoObj = document.getElementById('infoObjects');
    if (infoObj) infoObj.textContent = `${this.objects.length} objects`;

    // Update mixers
    for (const mixer of this.mixers) {
      mixer.update(delta);
    }

    this.orbitControls.update();

    // Grid visibility
    if (this.gridHelper) this.gridHelper.visible = this.showGrid;

    this.composer.render();
  }

  /** Render a single frame to an offscreen canvas at given resolution */
  renderToCanvas(width, height) {
    const rt = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
    this.renderer.setRenderTarget(rt);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);

    const pixels = new Uint8Array(width * height * 4);
    this.renderer.readRenderTargetPixels(rt, 0, 0, width, height, pixels);
    rt.dispose();

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(width, height);
    // Flip Y
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = ((height - 1 - y) * width + x) * 4;
        const dstIdx = (y * width + x) * 4;
        imgData.data[dstIdx] = pixels[srcIdx];
        imgData.data[dstIdx + 1] = pixels[srcIdx + 1];
        imgData.data[dstIdx + 2] = pixels[srcIdx + 2];
        imgData.data[dstIdx + 3] = pixels[srcIdx + 3];
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  dispose() {
    this.renderer.dispose();
    this.composer.dispose();
  }
}
