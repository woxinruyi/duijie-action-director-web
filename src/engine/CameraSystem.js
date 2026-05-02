import * as THREE from 'three';

/**
 * Camera keyframing and preset views.
 */
export class CameraSystem {
  constructor(sceneManager) {
    this.scene = sceneManager;
    this.startState = null;
    this.endState = null;
    this.interpolation = 'easeOut';
    this.isAnimating = false;
    this.animProgress = 0;
  }

  _captureState() {
    return {
      position: this.scene.camera.position.clone(),
      target: this.scene.orbitControls.target.clone(),
      fov: this.scene.camera.fov,
    };
  }

  setStart() {
    this.startState = this._captureState();
  }

  setEnd() {
    this.endState = this._captureState();
  }

  setInterpolation(type) {
    this.interpolation = type;
  }

  preview(duration = 2) {
    if (!this.startState || !this.endState) return;
    this.isAnimating = true;
    this.animProgress = 0;

    // Restore start
    this.scene.camera.position.copy(this.startState.position);
    this.scene.orbitControls.target.copy(this.startState.target);
    this.scene.orbitControls.enabled = false;

    const startTime = performance.now();
    const animate = () => {
      if (!this.isAnimating) return;
      const elapsed = (performance.now() - startTime) / 1000;
      let t = Math.min(elapsed / duration, 1);
      t = this._ease(t);

      this.scene.camera.position.lerpVectors(this.startState.position, this.endState.position, t);
      this.scene.orbitControls.target.lerpVectors(this.startState.target, this.endState.target, t);
      this.scene.camera.updateProjectionMatrix();

      if (elapsed < duration) {
        requestAnimationFrame(animate);
      } else {
        this.isAnimating = false;
        this.scene.orbitControls.enabled = true;
      }
    };
    requestAnimationFrame(animate);
  }

  stop() {
    this.isAnimating = false;
    this.scene.orbitControls.enabled = true;
  }

  _ease(t) {
    switch (this.interpolation) {
      case 'linear': return t;
      case 'easeIn': return t * t;
      case 'easeOut': return 1 - (1 - t) * (1 - t);
      case 'easeInOut': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      default: return t;
    }
  }

  goToPreset(name) {
    const cam = this.scene.camera;
    const target = new THREE.Vector3(0, 1, 0);

    const presets = {
      front: { pos: [0, 1.5, 5], target: [0, 1, 0] },
      back: { pos: [0, 1.5, -5], target: [0, 1, 0] },
      left: { pos: [-5, 1.5, 0], target: [0, 1, 0] },
      right: { pos: [5, 1.5, 0], target: [0, 1, 0] },
      top: { pos: [0, 8, 0.01], target: [0, 0, 0] },
      perspective: { pos: [3, 2.5, 5], target: [0, 1, 0] },
    };

    const preset = presets[name];
    if (!preset) return;

    // Smooth transition
    const startPos = cam.position.clone();
    const endPos = new THREE.Vector3(...preset.pos);
    const startTarget = this.scene.orbitControls.target.clone();
    const endTarget = new THREE.Vector3(...preset.target);

    const duration = 0.6;
    const startTime = performance.now();
    this.scene.orbitControls.enabled = false;

    const anim = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      let t = Math.min(elapsed / duration, 1);
      t = this._ease(t);

      cam.position.lerpVectors(startPos, endPos, t);
      this.scene.orbitControls.target.lerpVectors(startTarget, endTarget, t);

      if (elapsed < duration) {
        requestAnimationFrame(anim);
      } else {
        this.scene.orbitControls.enabled = true;
      }
    };
    requestAnimationFrame(anim);
  }

  serialize() {
    return {
      start: this.startState ? {
        position: this.startState.position.toArray(),
        target: this.startState.target.toArray(),
      } : null,
      end: this.endState ? {
        position: this.endState.position.toArray(),
        target: this.endState.target.toArray(),
      } : null,
      interpolation: this.interpolation,
    };
  }
}
