import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Manages loading, animating, and organizing 3D characters.
 */
export class CharacterManager {
  constructor(sceneManager) {
    this.scene = sceneManager;
    this.characters = [];
    this.fbxLoader = new FBXLoader();
    this.gltfLoader = new GLTFLoader();
    this.onCharacterAdded = null;
    this.onCharacterRemoved = null;
  }

  /**
   * Load a character from a File object or URL.
   * Returns a promise that resolves with the character data.
   */
  async loadCharacter(source, name = 'Character') {
    const ext = typeof source === 'string'
      ? source.split('.').pop().toLowerCase()
      : source.name.split('.').pop().toLowerCase();

    let model, animations;

    if (ext === 'glb' || ext === 'gltf') {
      const result = await this._loadGLTF(source);
      model = result.scene;
      animations = result.animations;
    } else if (ext === 'fbx') {
      const result = await this._loadFBX(source);
      model = result;
      animations = result.animations;
    } else {
      throw new Error(`Unsupported format: .${ext}`);
    }

    // Scale down FBX (typically in cm)
    if (ext === 'fbx') {
      model.scale.setScalar(0.01);
    }

    // Enable shadows
    model.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.side = THREE.FrontSide;
        }
      }
    });

    // Auto-center and normalize scale using bounding box
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    // Only auto-scale if we haven't already scaled (fbx) and model is way off
    if (ext !== 'fbx' && (maxDim > 5 || maxDim < 0.1)) {
      const targetHeight = 1.8; // meters
      const scale = targetHeight / size.y;
      model.scale.setScalar(scale);
    }

    // Re-compute after scale adjustment
    const box2 = new THREE.Box3().setFromObject(model);
    const center2 = box2.getCenter(new THREE.Vector3());
    const min2 = box2.min;
    // Place feet on ground plane
    model.position.sub(center2);
    model.position.y -= min2.y - center2.y;

    // Animation mixer
    const mixer = new THREE.AnimationMixer(model);
    const actions = [];
    for (const clip of animations) {
      const action = mixer.clipAction(clip);
      actions.push({ clip, action });
    }

    // Play first animation by default
    if (actions.length > 0) {
      actions[0].action.play();
    }

    // Skeleton helper
    const skeleton = new THREE.SkeletonHelper(model);
    skeleton.visible = false;
    skeleton.material.linewidth = 2;

    const charData = {
      id: `char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      model,
      mixer,
      actions,
      skeleton,
      gender: 'M',
      loop: true,
      visible: true,
      animSequence: animations.length > 0 ? [0] : [],
    };

    this.scene.addObject(model);
    this.scene.scene.add(skeleton);
    this.scene.addMixer(mixer);
    this.characters.push(charData);

    if (this.onCharacterAdded) this.onCharacterAdded(charData);
    return charData;
  }

  _loadGLTF(source) {
    return new Promise((resolve, reject) => {
      if (typeof source === 'string') {
        this.gltfLoader.load(source, resolve, undefined, reject);
      } else {
        const url = URL.createObjectURL(source);
        this.gltfLoader.load(url, (result) => {
          URL.revokeObjectURL(url);
          resolve(result);
        }, undefined, (err) => {
          URL.revokeObjectURL(url);
          reject(err);
        });
      }
    });
  }

  _loadFBX(source) {
    return new Promise((resolve, reject) => {
      if (typeof source === 'string') {
        this.fbxLoader.load(source, resolve, undefined, reject);
      } else {
        const url = URL.createObjectURL(source);
        this.fbxLoader.load(url, (result) => {
          URL.revokeObjectURL(url);
          resolve(result);
        }, undefined, (err) => {
          URL.revokeObjectURL(url);
          reject(err);
        });
      }
    });
  }

  /** Add an animation to an existing character from file */
  async addAnimationToCharacter(charData, source) {
    const ext = typeof source === 'string'
      ? source.split('.').pop().toLowerCase()
      : source.name.split('.').pop().toLowerCase();

    let animations;
    if (ext === 'glb' || ext === 'gltf') {
      const result = await this._loadGLTF(source);
      animations = result.animations;
    } else if (ext === 'fbx') {
      const result = await this._loadFBX(source);
      animations = result.animations;
    }

    if (!animations || animations.length === 0) return;

    for (const clip of animations) {
      const action = charData.mixer.clipAction(clip);
      charData.actions.push({ clip, action });
    }
  }

  /** Play a specific animation index on a character */
  playAnimation(charData, index, crossfadeDuration = 0.3) {
    if (index < 0 || index >= charData.actions.length) return;

    // Stop all current
    for (const a of charData.actions) {
      if (a.action.isRunning()) {
        a.action.fadeOut(crossfadeDuration);
      }
    }

    const target = charData.actions[index].action;
    target.reset();
    target.setLoop(charData.loop ? THREE.LoopRepeat : THREE.LoopOnce);
    target.clampWhenFinished = !charData.loop;
    target.fadeIn(crossfadeDuration);
    target.play();
  }

  removeCharacter(charData) {
    this.scene.removeObject(charData.model);
    this.scene.scene.remove(charData.skeleton);
    this.scene.removeMixer(charData.mixer);
    charData.mixer.stopAllAction();

    const idx = this.characters.indexOf(charData);
    if (idx !== -1) this.characters.splice(idx, 1);

    if (this.onCharacterRemoved) this.onCharacterRemoved(charData);
  }

  toggleGender(charData) {
    charData.gender = charData.gender === 'M' ? 'F' : 'M';
    // In a full implementation, this would swap the depth mesh
    // For now it's a data toggle for render pass differentiation
  }

  toggleSkeleton(charData, visible) {
    charData.skeleton.visible = visible;
  }

  getCharacterById(id) {
    return this.characters.find(c => c.id === id);
  }

  serialize() {
    return this.characters.map(c => ({
      id: c.id,
      name: c.name,
      gender: c.gender,
      loop: c.loop,
      position: c.model.position.toArray(),
      rotation: [c.model.rotation.x, c.model.rotation.y, c.model.rotation.z],
      scale: c.model.scale.toArray(),
      animSequence: c.animSequence,
    }));
  }
}
