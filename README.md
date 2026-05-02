# Action Director Web

> **跑在浏览器里的 3D 动画导演台** — A browser-based 3D animation director & ControlNet data production tool.

**Action Director Web，一个跑在浏览器里的 3D 动画导演台。** 内置开源骨骼角色，点击即加载。顶部七个渲染通道一键切换——Pose、Depth、Normal、Canny 全套 ControlNet 输入图，BAKE FRAME 一次烘焙七张。时间轴、Transform Gizmo、相机关键帧、MediaPipe 实时动捕、场景 JSON 保存，一应俱全。纯前端，不需要 ComfyUI，不需要 Python，浏览器就够了。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Three.js](https://img.shields.io/badge/Three.js-0.170-black)](https://threejs.org)
[![Vite](https://img.shields.io/badge/Vite-6-purple)](https://vitejs.dev)

---

## ✨ Features

| Feature | Detail |
|:---|:---|
| **3D Viewport** | Three.js scene with OrbitControls, TransformControls, bloom post-processing |
| **Character Loading** | FBX / GLB drag-and-drop or built-in gallery (Soldier · Robot · CesiumMan) |
| **Animation System** | AnimationMixer with crossfade, skeleton visualization, multi-character scenes |
| **7-Pass Rendering** | Shaded · Pose · Depth · Canny · Normal · Alpha · Textured — one-click bake |
| **Camera Keyframes** | Set start/end positions, easing interpolation, animated preview |
| **Motion Capture** | MediaPipe face (468 pts) + body (33 pts) via webcam, frame recording & JSON export |
| **Scene I/O** | Save/load full scene as JSON, localStorage persistence |
| **Keyboard Shortcuts** | `Space` play · `G/R/S` transform · `←/→` step frames · `Del` remove |

---

## 🚀 Quick Start

```bash
git clone https://github.com/MindDock/action-director-web.git
cd action-director-web
npm install
npm run dev
# Open http://localhost:5173
```

### Built-in Demo Models

The `public/models/` directory includes three ready-to-use GLB files with skeletal animations:

| Model | Source | Animations |
|:---|:---|:---|
| `Soldier.glb` | [Three.js examples](https://threejs.org/examples/) | Idle · Walk · Run · TPose |
| `RobotExpressive.glb` | [Three.js examples](https://threejs.org/examples/) | Multiple expressions & actions |
| `CesiumMan.glb` | [KhronosGroup glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) | Walking loop |

Click any card in the **角色管理** panel to load instantly.

---

## 🎛️ Render Passes

Action Director generates all 7 render passes needed for ControlNet workflows:

```
Shaded → Natural lighting
Pose   → OpenPose skeleton overlay
Depth  → Grayscale depth map
Canny  → Edge detection
Normal → Surface normal map
Alpha  → Silhouette matte
Textured → Flat-shaded textures
```

Click **📸 BAKE FRAME** to render all 7 passes at once.

---

## 📁 Project Structure

```
action-director-web/
├── public/
│   └── models/          # Built-in GLB models (Soldier, Robot, CesiumMan)
├── src/
│   ├── engine/
│   │   ├── SceneManager.js       # Three.js scene, renderer, post-processing
│   │   ├── CharacterManager.js   # FBX/GLB loading, AnimationMixer
│   │   ├── RenderPasses.js       # 7-pass ControlNet rendering
│   │   ├── CameraSystem.js       # Camera keyframes + easing
│   │   ├── EnvironmentManager.js # HDRI / environment loading
│   │   └── DemoCharacter.js      # Procedural demo character (no assets needed)
│   ├── mocap/
│   │   ├── FaceTracker.js        # MediaPipe FaceLandmarker
│   │   ├── PoseTracker.js        # MediaPipe PoseLandmarker
│   │   └── MocapRecorder.js      # Frame recording + export
│   ├── main.js                   # App entry point
│   └── style.css                 # Cyberpunk dark theme
├── index.html
├── vite.config.js
└── package.json
```

---

## 🛠️ Tech Stack

- **[Three.js](https://threejs.org)** `^0.170` — 3D rendering engine
- **[Vite](https://vitejs.dev)** `^6` — Build tool & dev server
- **[MediaPipe Tasks Vision](https://developers.google.com/mediapipe)** — Real-time pose & face tracking (CDN)

---

## 📄 License

MIT — Free to use, modify, and distribute.

---

## 🔗 Related

- [FreeMoCap Studio](https://github.com/MindDock/freemocap-web) — Real-time motion capture analysis dashboard
- [freemocap/freemocap](https://github.com/freemocap/freemocap) — Open-source multi-camera MoCap system
