import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

export class EnvironmentManager {
  constructor(sceneManager) {
    this.scene = sceneManager;
    this.environments = [];
    this.gltfLoader = new GLTFLoader();
    this.fbxLoader = new FBXLoader();
    this.rgbeLoader = new RGBELoader();
    this.currentHDRI = null;
    this.hdriRotation = 0;
    this.hdriIntensity = 1.0;
  }

  async loadEnvironment(source, name = 'Environment') {
    const ext = typeof source === 'string'
      ? source.split('.').pop().toLowerCase()
      : source.name.split('.').pop().toLowerCase();

    let model;

    if (ext === 'hdr' || ext === 'exr') {
      await this.loadHDRI(source);
      return null;
    }

    if (ext === 'glb' || ext === 'gltf') {
      const result = await new Promise((resolve, reject) => {
        const url = typeof source === 'string' ? source : URL.createObjectURL(source);
        this.gltfLoader.load(url, resolve, undefined, reject);
      });
      model = result.scene;
    } else if (ext === 'fbx') {
      model = await new Promise((resolve, reject) => {
        const url = typeof source === 'string' ? source : URL.createObjectURL(source);
        this.fbxLoader.load(url, resolve, undefined, reject);
      });
      model.scale.setScalar(0.01);
    } else {
      throw new Error(`Unsupported env format: .${ext}`);
    }

    model.traverse(child => {
      if (child.isMesh) {
        child.receiveShadow = true;
        child.castShadow = true;
      }
    });

    const envData = {
      id: `env_${Date.now()}`,
      name,
      model,
    };

    this.scene.addObject(model);
    this.environments.push(envData);
    return envData;
  }

  async loadHDRI(source) {
    return new Promise((resolve, reject) => {
      const url = typeof source === 'string' ? source : URL.createObjectURL(source);
      this.rgbeLoader.load(url, (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.scene.environment = texture;
        this.currentHDRI = texture;
        resolve(texture);
      }, undefined, reject);
    });
  }

  setHDRIRotation(degrees) {
    this.hdriRotation = degrees;
    // HDRI rotation requires re-mapping; simplified here
  }

  setHDRIIntensity(value) {
    this.hdriIntensity = value;
    if (this.scene.scene.environment) {
      this.scene.renderer.toneMappingExposure = value;
    }
  }

  removeEnvironment(envData) {
    this.scene.removeObject(envData.model);
    const idx = this.environments.indexOf(envData);
    if (idx !== -1) this.environments.splice(idx, 1);
  }
}
