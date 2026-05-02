import * as THREE from 'three';

/**
 * Procedural demo character — no external assets needed.
 * Builds a full humanoid skeleton from Three.js primitives with
 * built-in idle / walk / wave animations.
 */
export class DemoCharacter {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.bones = {};
    this.meshes = [];
    this.mixer = null;
    this.clock = new THREE.Clock();
    this.animMode = 'idle'; // 'idle' | 'walk' | 'wave'
    this.t = 0;

    this._build();
    scene.scene.add(this.root);
    scene.objects.push(this.root);
  }

  // ── Geometry helpers ──────────────────────────────────
  _capsule(rx, ry, rz, color = 0xcccccc) {
    const geo = new THREE.CapsuleGeometry(Math.min(rx, rz), ry, 8, 16);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.6,
      metalness: 0.1,
    });
    return new THREE.Mesh(geo, mat);
  }

  _sphere(r, color = 0xdddddd) {
    const geo = new THREE.SphereGeometry(r, 16, 12);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.15 });
    return new THREE.Mesh(geo, mat);
  }

  _addPart(name, mesh, parent, offset = [0, 0, 0]) {
    mesh.position.set(...offset);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    this.meshes.push(mesh);

    // Create a pivot bone group
    const pivot = new THREE.Group();
    pivot.position.set(0, 0, 0);
    mesh.add(pivot);
    this.bones[name] = pivot;
    return { mesh, pivot };
  }

  // ── Build humanoid ────────────────────────────────────
  _build() {
    const SKIN = 0xf0c090;
    const SHIRT = 0x4466cc;
    const PANTS = 0x334488;
    const SHOE = 0x222222;

    // ── Root / Hips ──
    const hips = new THREE.Group();
    hips.position.set(0, 0.9, 0);
    this.root.add(hips);
    this.bones.hips = hips;

    // Pelvis body
    const pelvis = this._capsule(0.14, 0.12, 0.1, PANTS);
    pelvis.position.set(0, 0, 0);
    pelvis.castShadow = true;
    hips.add(pelvis);
    this.meshes.push(pelvis);

    // ── Spine ──
    const spine = new THREE.Group();
    spine.position.set(0, 0.14, 0);
    hips.add(spine);
    this.bones.spine = spine;

    const torso = this._capsule(0.16, 0.22, 0.11, SHIRT);
    torso.position.set(0, 0.12, 0);
    torso.castShadow = true;
    spine.add(torso);
    this.meshes.push(torso);

    // ── Neck + Head ──
    const neck = new THREE.Group();
    neck.position.set(0, 0.36, 0);
    spine.add(neck);
    this.bones.neck = neck;

    const neckMesh = this._capsule(0.06, 0.06, 0.06, SKIN);
    neckMesh.position.set(0, 0.04, 0);
    neckMesh.castShadow = true;
    neck.add(neckMesh);
    this.meshes.push(neckMesh);

    const head = new THREE.Group();
    head.position.set(0, 0.1, 0);
    neck.add(head);
    this.bones.head = head;

    const headMesh = this._sphere(0.13, SKIN);
    headMesh.position.set(0, 0.1, 0);
    headMesh.castShadow = true;
    head.add(headMesh);
    this.meshes.push(headMesh);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.025, 8, 6);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.045, 0.11, 0.115);
    head.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.045, 0.11, 0.115);
    head.add(eyeR);

    // ── Shoulders + Arms ──
    this._buildArm(spine, 'left',  -1);
    this._buildArm(spine, 'right',  1);

    // ── Legs ──
    this._buildLeg(hips, 'left',  -1);
    this._buildLeg(hips, 'right',  1);
  }

  _buildArm(parent, side, sign) {
    const SKIN = 0xf0c090;
    const SHIRT = 0x4466cc;
    const GLOVE = 0x553322;

    const shoulder = new THREE.Group();
    shoulder.position.set(sign * 0.22, 0.28, 0);
    parent.add(shoulder);
    this.bones[`${side}Shoulder`] = shoulder;

    const upperArm = this._capsule(0.06, 0.16, 0.06, SHIRT);
    upperArm.position.set(sign * 0.04, -0.1, 0);
    upperArm.castShadow = true;
    shoulder.add(upperArm);
    this.meshes.push(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(sign * 0.06, -0.22, 0);
    shoulder.add(elbow);
    this.bones[`${side}Elbow`] = elbow;

    const foreArm = this._capsule(0.055, 0.14, 0.055, SKIN);
    foreArm.position.set(0, -0.09, 0);
    foreArm.castShadow = true;
    elbow.add(foreArm);
    this.meshes.push(foreArm);

    const wrist = new THREE.Group();
    wrist.position.set(0, -0.19, 0);
    elbow.add(wrist);
    this.bones[`${side}Wrist`] = wrist;

    // Hand
    const hand = this._sphere(0.07, GLOVE);
    hand.position.set(0, -0.04, 0);
    hand.castShadow = true;
    wrist.add(hand);
    this.meshes.push(hand);
  }

  _buildLeg(parent, side, sign) {
    const PANTS = 0x334488;
    const SHOE = 0x111111;
    const SOCK = 0xaaaaaa;

    const hip = new THREE.Group();
    hip.position.set(sign * 0.1, -0.06, 0);
    parent.add(hip);
    this.bones[`${side}Hip`] = hip;

    const thigh = this._capsule(0.09, 0.22, 0.08, PANTS);
    thigh.position.set(0, -0.14, 0);
    thigh.castShadow = true;
    hip.add(thigh);
    this.meshes.push(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.3, 0);
    hip.add(knee);
    this.bones[`${side}Knee`] = knee;

    const shin = this._capsule(0.07, 0.18, 0.07, SOCK);
    shin.position.set(0, -0.12, 0);
    shin.castShadow = true;
    knee.add(shin);
    this.meshes.push(shin);

    const ankle = new THREE.Group();
    ankle.position.set(0, -0.26, 0);
    knee.add(ankle);
    this.bones[`${side}Ankle`] = ankle;

    const foot = this._capsule(0.05, 0.08, 0.1, SHOE);
    foot.rotation.x = Math.PI / 2;
    foot.position.set(0, -0.05, 0.06);
    foot.castShadow = true;
    ankle.add(foot);
    this.meshes.push(foot);
  }

  // ── Animation ─────────────────────────────────────────
  setAnimation(mode) {
    this.animMode = mode;
    this.t = 0;
  }

  update(delta) {
    this.t += delta;
    const t = this.t;
    const s = Math.sin;
    const c = Math.cos;

    switch (this.animMode) {
      case 'idle':    this._animIdle(t, s, c); break;
      case 'walk':    this._animWalk(t, s, c); break;
      case 'wave':    this._animWave(t, s, c); break;
      case 'squat':   this._animSquat(t, s, c); break;
    }
  }

  _animIdle(t, s, c) {
    const b = this.t; const hz = 0.8;
    // Gentle breathing
    if (this.bones.spine) {
      this.bones.spine.rotation.x = s(b * hz) * 0.015;
      this.bones.spine.scale.y = 1 + s(b * hz) * 0.008;
    }
    if (this.bones.head) this.bones.head.rotation.y = s(b * 0.4) * 0.06;

    // Subtle arm sway
    if (this.bones.leftShoulder)  this.bones.leftShoulder.rotation.z  =  0.12 + s(b * hz) * 0.02;
    if (this.bones.rightShoulder) this.bones.rightShoulder.rotation.z = -0.12 + s(b * hz) * 0.02;

    // Weight shift
    if (this.bones.hips) this.bones.hips.position.y = 0.9 + s(b * hz) * 0.005;
  }

  _animWalk(t, s, c) {
    const hz = 2.4; const amp = 0.55;
    // Hip rotation
    if (this.bones.hips) {
      this.bones.hips.rotation.y = s(t * hz) * 0.08;
      this.bones.hips.position.y = 0.9 + Math.abs(s(t * hz * 2)) * 0.04 - 0.02;
    }
    if (this.bones.spine) this.bones.spine.rotation.y = -s(t * hz) * 0.06;

    // Arms swing (opposite to legs)
    if (this.bones.leftShoulder) {
      this.bones.leftShoulder.rotation.x = s(t * hz) * amp * 0.5;
      this.bones.leftShoulder.rotation.z = 0.15;
    }
    if (this.bones.rightShoulder) {
      this.bones.rightShoulder.rotation.x = -s(t * hz) * amp * 0.5;
      this.bones.rightShoulder.rotation.z = -0.15;
    }
    // Elbow bend
    if (this.bones.leftElbow)  this.bones.leftElbow.rotation.x  = -0.3 + s(t * hz) * 0.2;
    if (this.bones.rightElbow) this.bones.rightElbow.rotation.x = -0.3 - s(t * hz) * 0.2;

    // Legs
    if (this.bones.leftHip)  this.bones.leftHip.rotation.x  = -s(t * hz) * amp;
    if (this.bones.rightHip) this.bones.rightHip.rotation.x =  s(t * hz) * amp;
    if (this.bones.leftKnee)  this.bones.leftKnee.rotation.x  = Math.max(0, -s(t * hz) * amp * 1.1);
    if (this.bones.rightKnee) this.bones.rightKnee.rotation.x = Math.max(0,  s(t * hz) * amp * 1.1);
    if (this.bones.leftAnkle)  this.bones.leftAnkle.rotation.x  = s(t * hz) * 0.25;
    if (this.bones.rightAnkle) this.bones.rightAnkle.rotation.x = -s(t * hz) * 0.25;
  }

  _animWave(t, s, c) {
    this._animIdle(t, s, c);
    // Right arm wave
    if (this.bones.rightShoulder) {
      this.bones.rightShoulder.rotation.x = -1.2 + s(t * 4) * 0.15;
      this.bones.rightShoulder.rotation.z = -0.5 + s(t * 4) * 0.1;
    }
    if (this.bones.rightElbow) {
      this.bones.rightElbow.rotation.x = -0.6 + s(t * 4 + 0.5) * 0.3;
      this.bones.rightElbow.rotation.z = s(t * 4) * 0.25;
    }
  }

  _animSquat(t, s, c) {
    const phase = (s(t * 1.2) + 1) / 2; // 0..1
    if (this.bones.hips) this.bones.hips.position.y = 0.9 - phase * 0.3;
    if (this.bones.spine) this.bones.spine.rotation.x = phase * 0.2;
    if (this.bones.leftHip)  this.bones.leftHip.rotation.x  = -phase * 1.4;
    if (this.bones.rightHip) this.bones.rightHip.rotation.x = -phase * 1.4;
    if (this.bones.leftKnee)  this.bones.leftKnee.rotation.x  = phase * 1.8;
    if (this.bones.rightKnee) this.bones.rightKnee.rotation.x = phase * 1.8;
    if (this.bones.leftAnkle)  this.bones.leftAnkle.rotation.x  = -phase * 0.4;
    if (this.bones.rightAnkle) this.bones.rightAnkle.rotation.x = -phase * 0.4;
    // Arms forward
    if (this.bones.leftShoulder)  this.bones.leftShoulder.rotation.x  = -phase * 0.8;
    if (this.bones.rightShoulder) this.bones.rightShoulder.rotation.x = -phase * 0.8;
    if (this.bones.leftShoulder)  this.bones.leftShoulder.rotation.z  =  0.15;
    if (this.bones.rightShoulder) this.bones.rightShoulder.rotation.z = -0.15;
  }

  remove() {
    this.scene.scene.remove(this.root);
    const idx = this.scene.objects.indexOf(this.root);
    if (idx !== -1) this.scene.objects.splice(idx, 1);
  }
}
