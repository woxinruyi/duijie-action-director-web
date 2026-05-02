import './style.css';
import { SceneManager } from './engine/SceneManager.js';
import { CharacterManager } from './engine/CharacterManager.js';
import { RenderPasses } from './engine/RenderPasses.js';
import { CameraSystem } from './engine/CameraSystem.js';
import { EnvironmentManager } from './engine/EnvironmentManager.js';
import { FaceTracker } from './mocap/FaceTracker.js';
import { PoseTracker } from './mocap/PoseTracker.js';
import { MocapRecorder } from './mocap/MocapRecorder.js';
import { DemoCharacter } from './engine/DemoCharacter.js';

// ══════════════════════════════════════════
// Initialize core systems
// ══════════════════════════════════════════
const canvas = document.getElementById('viewport');
const sceneManager = new SceneManager(canvas);
const characterManager = new CharacterManager(sceneManager);
const renderPasses = new RenderPasses(sceneManager);
const cameraSystem = new CameraSystem(sceneManager);
const envManager = new EnvironmentManager(sceneManager);
const faceTracker = new FaceTracker();
const poseTracker = new PoseTracker();
const mocapRecorder = new MocapRecorder();

// ══════════════════════════════════════════
// State
// ══════════════════════════════════════════
let isPlaying = false;
let currentFrame = 0;
let totalFrames = 48;
let fps = 24;
let lastFrameTime = 0;

// Demo character
let demoChar = null;
let demoClockLast = performance.now();

// ══════════════════════════════════════════
// Sidebar Tabs
// ══════════════════════════════════════════
document.querySelectorAll('.sidebar-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panelId = `panel-${tab.dataset.tab}`;
    document.getElementById(panelId)?.classList.add('active');
  });
});

// ══════════════════════════════════════════
// Render Mode Switching
// ══════════════════════════════════════════
document.querySelectorAll('.render-mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.render-mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    sceneManager.setRenderMode(btn.dataset.mode);

    // Update pass thumbnails active state
    document.querySelectorAll('.pass-thumb').forEach(t => t.classList.remove('active'));
    document.querySelector(`.pass-thumb[data-pass="${btn.dataset.mode}"]`)?.classList.add('active');
  });
});

// Pass thumbnails click
document.querySelectorAll('.pass-thumb').forEach(thumb => {
  thumb.addEventListener('click', () => {
    const mode = thumb.dataset.pass;
    document.querySelectorAll('.render-mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.render-mode-btn[data-mode="${mode}"]`)?.classList.add('active');
    document.querySelectorAll('.pass-thumb').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
    sceneManager.setRenderMode(mode);
  });
});

// ══════════════════════════════════════════
// Gizmo Controls
// ══════════════════════════════════════════
document.querySelectorAll('.gizmo-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.gizmo-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    sceneManager.setGizmoMode(btn.dataset.gizmo);
  });
});

// ══════════════════════════════════════════
// Timeline Controls
// ══════════════════════════════════════════
const tlTrack = document.getElementById('timelineTrack');
const tlProgress = document.getElementById('timelineProgress');
const tlScrubber = document.getElementById('timelineScrubber');
const tlCurrentFrame = document.getElementById('tlCurrentFrame');
const tlTotalFrames = document.getElementById('tlTotalFrames');
const tlFps = document.getElementById('tlFps');

function updateTimeline() {
  const pct = totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 0;
  tlProgress.style.width = `${pct}%`;
  tlScrubber.style.left = `${pct}%`;
  tlCurrentFrame.textContent = currentFrame;
  tlTotalFrames.textContent = totalFrames;
  tlFps.textContent = `${fps} fps`;

  const infoFrame = document.getElementById('infoFrame');
  if (infoFrame) infoFrame.textContent = `Frame ${currentFrame}/${totalFrames}`;
}

function setFrame(frame) {
  currentFrame = Math.max(0, Math.min(frame, totalFrames));
  updateTimeline();
}

// Timeline scrubbing
let isDraggingTimeline = false;
tlTrack.addEventListener('mousedown', (e) => {
  isDraggingTimeline = true;
  scrubToMouse(e);
});
document.addEventListener('mousemove', (e) => {
  if (isDraggingTimeline) scrubToMouse(e);
});
document.addEventListener('mouseup', () => { isDraggingTimeline = false; });

function scrubToMouse(e) {
  const rect = tlTrack.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  setFrame(Math.round(pct * totalFrames));
}

// Play/Pause
document.getElementById('btnPlay').addEventListener('click', togglePlay);
function togglePlay() {
  isPlaying = !isPlaying;
  document.getElementById('btnPlay').textContent = isPlaying ? '⏸' : '▶';
  if (isPlaying) lastFrameTime = performance.now();
}

document.getElementById('btnSkipStart').addEventListener('click', () => setFrame(0));
document.getElementById('btnSkipEnd').addEventListener('click', () => setFrame(totalFrames));
document.getElementById('btnStepBack').addEventListener('click', () => setFrame(currentFrame - 1));
document.getElementById('btnStepForward').addEventListener('click', () => setFrame(currentFrame + 1));

// Playback loop
function playbackLoop() {
  requestAnimationFrame(playbackLoop);
  const now = performance.now();
  const delta = Math.min((now - demoClockLast) / 1000, 0.05);
  demoClockLast = now;

  // Advance demo character animation every frame
  if (demoChar) demoChar.update(delta);

  if (!isPlaying) return;
  const frameDuration = 1000 / fps;
  if (now - lastFrameTime >= frameDuration) {
    lastFrameTime = now;
    currentFrame++;
    if (currentFrame > totalFrames) currentFrame = 0;
    updateTimeline();
  }
}
playbackLoop();
updateTimeline();

// ══════════════════════════════════════════
// Camera Presets & Keyframes
// ══════════════════════════════════════════
document.getElementById('btnCamStart')?.addEventListener('click', () => {
  cameraSystem.setStart();
  showToast('相机起始位设定 ✓');
});
document.getElementById('btnCamEnd')?.addEventListener('click', () => {
  cameraSystem.setEnd();
  showToast('相机终点位设定 ✓');
});
document.getElementById('btnCamPreview')?.addEventListener('click', () => {
  cameraSystem.preview(2);
});
document.getElementById('camInterpolation')?.addEventListener('change', (e) => {
  cameraSystem.setInterpolation(e.target.value);
});

document.querySelectorAll('[data-preset]').forEach(btn => {
  btn.addEventListener('click', () => {
    cameraSystem.goToPreset(btn.dataset.preset);
  });
});

// ══════════════════════════════════════════
// Character Management
// ══════════════════════════════════════════
document.getElementById('btnAddChar')?.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.fbx,.glb,.gltf';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      showToast(`加载中: ${file.name}...`);
      const charData = await characterManager.loadCharacter(file, file.name.replace(/\.[^.]+$/, ''));
      renderCharacterList();
      showToast(`角色已加载: ${charData.name} ✓`);
    } catch (err) {
      console.error(err);
      showToast(`加载失败: ${err.message}`, 'error');
    }
  };
  input.click();
});

// ── Demo Character ────────────────────
document.getElementById('btnLoadDemo')?.addEventListener('click', () => {
  if (demoChar) {
    demoChar.remove();
    demoChar = null;
  }
  demoChar = new DemoCharacter(sceneManager);
  renderCharacterList();
  showToast('🧍 演示角色已加载 ✓');
  // Show demo controls
  document.getElementById('demoControls')?.style.removeProperty('display');
});

document.getElementById('demoAnimBtns')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-anim]');
  if (!btn || !demoChar) return;
  document.querySelectorAll('[data-anim]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  demoChar.setAnimation(btn.dataset.anim);
  showToast(`动作: ${btn.textContent.trim()}`);
});

// ── Built-in Model Gallery ──────────────
document.getElementById('builtinGallery')?.addEventListener('click', async (e) => {
  const card = e.target.closest('.gallery-card');
  if (!card) return;
  const modelPath = card.dataset.model;
  const modelName = card.dataset.name;
  if (!modelPath) return;

  // Loading state
  card.classList.add('loading');
  card.querySelector('.gallery-card-icon').textContent = '⏳';
  showToast(`加载 ${modelName}...`);

  try {
    await characterManager.loadCharacter(modelPath, modelName);
    renderCharacterList();
    showToast(`✅ ${modelName} 加载完成！`);
    // Switch to first animation right away
    const char = characterManager.characters.find(c => c.name === modelName);
    if (char && char.actions.length > 0) {
      characterManager.playAnimation(char, 0);
    }
  } catch (err) {
    console.error(err);
    showToast(`❌ 加载失败: ${err.message}`, 'error');
  } finally {
    card.classList.remove('loading');
    // Restore emoji based on model
    const icons = { Soldier: '🪖', Robot: '🤖', CesiumMan: '🧑' };
    card.querySelector('.gallery-card-icon').textContent = icons[modelName] || '📦';
  }
});


function renderCharacterList() {
  const list = document.getElementById('characterList');
  const hasChars = characterManager.characters.length > 0 || demoChar;
  if (!hasChars) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">🧍</div><p>拖拽 FBX/GLB 文件到视口<br/>或点击 "添加角色" / "加载演示"</p></div>`;
    return;
  }
  // Demo character entry
  const demoEntry = demoChar ? `
    <div class="character-card selected" style="border-color:var(--accent);">
      <div class="char-header">
        <span class="char-name">🧍 演示角色</span>
        <div class="char-controls">
          <button class="btn btn-xs btn-ghost" id="btnRemoveDemo" title="删除">✕</button>
        </div>
      </div>
      <div id="demoAnimBtns" style="display:flex;gap:4px;padding:4px 0;flex-wrap:wrap;">
        <button class="btn btn-xs btn-ghost active" data-anim="idle">🧘 站立</button>
        <button class="btn btn-xs btn-ghost" data-anim="walk">🚶 走路</button>
        <button class="btn btn-xs btn-ghost" data-anim="wave">👋 挥手</button>
        <button class="btn btn-xs btn-ghost" data-anim="squat">🦵 深蹲</button>
      </div>
    </div>` : '';

  list.innerHTML = demoEntry;

  // Wire demo buttons via event delegation on the list
  list.addEventListener('click', (e) => {
    // Remove demo
    if (e.target.id === 'btnRemoveDemo') {
      if (demoChar) { demoChar.remove(); demoChar = null; }
      renderCharacterList();
      return;
    }
    // Switch animation
    const animBtn = e.target.closest('[data-anim]');
    if (animBtn && demoChar) {
      list.querySelectorAll('[data-anim]').forEach(b => b.classList.remove('active'));
      animBtn.classList.add('active');
      demoChar.setAnimation(animBtn.dataset.anim);
      showToast(`动作: ${animBtn.textContent.trim()}`);
    }
  }, { once: true }); // replaced on each render, so use once

  for (const char of characterManager.characters) {
    const card = document.createElement('div');
    card.className = `character-card${sceneManager.selectedObject === char.model ? ' selected' : ''}`;
    card.innerHTML = `
      <div class="char-header">
        <span class="char-name">${char.name}</span>
        <div class="char-controls">
          <button class="char-toggle${char.loop ? ' active' : ''}" data-action="loop">Loop</button>
          <button class="char-toggle-gender" data-action="gender">${char.gender}</button>
          <button class="btn btn-xs btn-ghost" data-action="skeleton" title="Toggle Skeleton">💀</button>
          <button class="btn btn-xs btn-ghost" data-action="delete" title="Delete" style="color:var(--red);">✕</button>
        </div>
      </div>
      <div class="char-anim-list">
        ${char.actions.map((a, i) => `
          <div class="char-anim-slot">
            <span style="font-size:10px;color:var(--text-muted);width:16px;">${i + 1}</span>
            <span style="font-size:11px;flex:1;overflow:hidden;text-overflow:ellipsis;">${a.clip.name || 'Animation ' + (i + 1)}</span>
            <button class="btn btn-xs btn-ghost" data-action="play" data-index="${i}" title="Play">▶</button>
          </div>
        `).join('')}
        <button class="btn btn-xs btn-accent" data-action="addAnim" style="margin-top:4px;width:100%;">+ 添加动画</button>
      </div>
    `;

    // Event delegation
    card.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) {
        sceneManager.selectObject(char.model);
        renderCharacterList();
        return;
      }

      const action = btn.dataset.action;
      if (action === 'loop') {
        char.loop = !char.loop;
        btn.classList.toggle('active');
      } else if (action === 'gender') {
        characterManager.toggleGender(char);
        btn.textContent = char.gender;
      } else if (action === 'skeleton') {
        char.skeleton.visible = !char.skeleton.visible;
      } else if (action === 'delete') {
        characterManager.removeCharacter(char);
        renderCharacterList();
      } else if (action === 'play') {
        const idx = parseInt(btn.dataset.index);
        characterManager.playAnimation(char, idx);
      } else if (action === 'addAnim') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.fbx,.glb,.gltf';
        input.onchange = async (ev) => {
          const file = ev.target.files[0];
          if (file) {
            await characterManager.addAnimationToCharacter(char, file);
            renderCharacterList();
          }
        };
        input.click();
      }
    });

    list.appendChild(card);
  }
}

// ══════════════════════════════════════════
// Environment Management
// ══════════════════════════════════════════
document.getElementById('btnAddEnv')?.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.glb,.gltf,.fbx,.obj,.hdr,.exr';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      showToast(`加载环境: ${file.name}...`);
      await envManager.loadEnvironment(file, file.name.replace(/\.[^.]+$/, ''));
      showToast(`环境已加载 ✓`);
    } catch (err) {
      showToast(`环境加载失败: ${err.message}`, 'error');
    }
  };
  input.click();
});

// HDRI controls
document.getElementById('hdriRotation')?.addEventListener('input', (e) => {
  const val = parseInt(e.target.value);
  document.getElementById('hdriRotationVal').textContent = `${val}°`;
  envManager.setHDRIRotation(val);
});
document.getElementById('hdriIntensity')?.addEventListener('input', (e) => {
  const val = parseInt(e.target.value) / 100;
  document.getElementById('hdriIntensityVal').textContent = val.toFixed(1);
  envManager.setHDRIIntensity(val);
});

// ══════════════════════════════════════════
// Motion Capture
// ══════════════════════════════════════════
const mocapVideo = document.getElementById('mocapVideo');
const mocapCanvas = document.getElementById('mocapCanvas');
let activeMocapTracker = null;

document.getElementById('btnMocapStart')?.addEventListener('click', async () => {
  const source = document.querySelector('input[name="mocapSource"]:checked')?.value;
  const trackFace = document.getElementById('trackFace')?.checked;
  const trackPose = document.getElementById('trackPose')?.checked;

  try {
    document.querySelector('.mocap-overlay-text').style.display = 'none';

    if (source === 'webcam') {
      if (trackFace) {
        showToast('初始化面部追踪...');
        await faceTracker.startWebcam(mocapVideo);
        activeMocapTracker = faceTracker;
        faceTracker.onResults = (results) => {
          mocapCanvas.width = mocapVideo.videoWidth || 640;
          mocapCanvas.height = mocapVideo.videoHeight || 480;
          faceTracker.drawLandmarks(mocapCanvas, results);
          if (mocapRecorder.isRecording) {
            mocapRecorder.recordFrame({
              type: 'face',
              blendshapes: faceTracker.getBlendshapes(results),
            });
          }
        };
        showToast('面部追踪已启动 ✓');
      } else if (trackPose) {
        showToast('初始化姿态追踪...');
        await poseTracker.startWebcam(mocapVideo);
        activeMocapTracker = poseTracker;
        poseTracker.onResults = (results) => {
          mocapCanvas.width = mocapVideo.videoWidth || 640;
          mocapCanvas.height = mocapVideo.videoHeight || 480;
          poseTracker.drawPose(mocapCanvas, results);
          if (mocapRecorder.isRecording) {
            mocapRecorder.recordFrame({
              type: 'pose',
              landmarks: results.landmarks?.[0],
            });
          }
        };
        showToast('姿态追踪已启动 ✓');
      }
    }

    document.getElementById('btnMocapRec').disabled = false;
    document.getElementById('btnMocapStop').disabled = false;
  } catch (err) {
    showToast(`动捕启动失败: ${err.message}`, 'error');
  }
});

document.getElementById('btnMocapRec')?.addEventListener('click', () => {
  const name = document.getElementById('mocapName')?.value || 'Capture';
  mocapRecorder.startRecording(name);
  document.getElementById('btnMocapRec').style.background = 'rgba(255,50,50,0.4)';
  showToast('🔴 录制中...');
});

document.getElementById('btnMocapStop')?.addEventListener('click', () => {
  if (activeMocapTracker) {
    activeMocapTracker.stop(mocapVideo);
    activeMocapTracker = null;
  }
  const recording = mocapRecorder.stopRecording();
  document.getElementById('btnMocapRec').disabled = true;
  document.getElementById('btnMocapStop').disabled = true;
  document.getElementById('btnMocapRec').style.background = '';
  document.querySelector('.mocap-overlay-text').style.display = '';

  if (recording) {
    showToast(`录制完成: ${recording.frameCount} 帧 ✓`);
    document.getElementById('mocapBindSection').style.display = '';
  }
});

// ══════════════════════════════════════════
// Scene Save/Load
// ══════════════════════════════════════════
document.getElementById('btnSaveScene')?.addEventListener('click', () => {
  const name = document.getElementById('sceneName')?.value || 'MyScene';
  const sceneData = {
    name,
    timestamp: new Date().toISOString(),
    characters: characterManager.serialize(),
    camera: cameraSystem.serialize(),
    settings: {
      width: parseInt(document.getElementById('renderWidth')?.value || 512),
      height: parseInt(document.getElementById('renderHeight')?.value || 512),
      fps: parseInt(document.getElementById('renderFps')?.value || 24),
      frameCount: parseInt(document.getElementById('renderFrameCount')?.value || 48),
    },
  };

  const blob = new Blob([JSON.stringify(sceneData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.json`;
  a.click();
  URL.revokeObjectURL(url);

  // Save to localStorage
  const saved = JSON.parse(localStorage.getItem('ad_scenes') || '[]');
  saved.push({ name, timestamp: sceneData.timestamp });
  localStorage.setItem('ad_scenes', JSON.stringify(saved.slice(-10)));
  renderSavedScenes();

  showToast(`场景已保存: ${name} ✓`);
});

document.getElementById('btnLoadScene')?.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.settings) {
          totalFrames = data.settings.frameCount || 48;
          fps = data.settings.fps || 24;
          updateTimeline();
        }
        showToast(`场景已加载: ${data.name} ✓`);
      } catch {
        showToast('场景加载失败', 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
});

function renderSavedScenes() {
  const list = document.getElementById('savedSceneList');
  const saved = JSON.parse(localStorage.getItem('ad_scenes') || '[]');
  if (saved.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>暂无保存的场景</p></div>';
    return;
  }
  list.innerHTML = saved.map(s =>
    `<div class="saved-scene-item"><span>${s.name}</span><span style="font-size:10px;color:var(--text-muted);">${new Date(s.timestamp).toLocaleString('zh-CN')}</span></div>`
  ).join('');
}
renderSavedScenes();

// ══════════════════════════════════════════
// Bake
// ══════════════════════════════════════════
document.getElementById('btnBakeFrame')?.addEventListener('click', () => {
  const w = parseInt(document.getElementById('renderWidth')?.value || 512);
  const h = parseInt(document.getElementById('renderHeight')?.value || 512);
  const passes = renderPasses.renderAllPasses(w, h);

  // Update thumbnails
  for (const [name, passCanvas] of Object.entries(passes)) {
    const thumb = document.querySelector(`.pass-thumb[data-pass="${name}"] canvas`);
    if (thumb) {
      const ctx = thumb.getContext('2d');
      ctx.drawImage(passCanvas, 0, 0, thumb.width, thumb.height);
    }
  }
  showToast('单帧渲染完成 ✓');
});

document.getElementById('btnBake')?.addEventListener('click', () => {
  showToast('批量烘焙功能开发中... 🚧');
});

// ══════════════════════════════════════════
// Settings Modal
// ══════════════════════════════════════════
document.getElementById('btnSettings')?.addEventListener('click', () => {
  document.getElementById('settingsModal').style.display = '';
});
document.getElementById('btnCloseSettings')?.addEventListener('click', () => {
  document.getElementById('settingsModal').style.display = 'none';
});
document.getElementById('settingsModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'settingsModal') {
    document.getElementById('settingsModal').style.display = 'none';
  }
});

document.getElementById('settingGrid')?.addEventListener('change', (e) => {
  sceneManager.showGrid = e.target.checked;
});
document.getElementById('settingDepthNear')?.addEventListener('change', (e) => {
  renderPasses.setDepthRange(parseFloat(e.target.value), renderPasses.depthFar);
});
document.getElementById('settingDepthFar')?.addEventListener('change', (e) => {
  renderPasses.setDepthRange(renderPasses.depthNear, parseFloat(e.target.value));
});

// ══════════════════════════════════════════
// Drag & Drop
// ══════════════════════════════════════════
const dropZone = document.getElementById('dropZone');
const viewportContainer = document.getElementById('viewport-container');

['dragenter', 'dragover'].forEach(evt => {
  viewportContainer.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.add('active');
  });
});
['dragleave', 'drop'].forEach(evt => {
  viewportContainer.addEventListener(evt, () => {
    dropZone.classList.remove('active');
  });
});

viewportContainer.addEventListener('drop', async (e) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer?.files || []);
  for (const file of files) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (['fbx', 'glb', 'gltf'].includes(ext)) {
      try {
        showToast(`加载: ${file.name}...`);
        await characterManager.loadCharacter(file, file.name.replace(/\.[^.]+$/, ''));
        renderCharacterList();
        showToast(`已加载: ${file.name} ✓`);
      } catch (err) {
        showToast(`失败: ${err.message}`, 'error');
      }
    } else if (['hdr', 'exr'].includes(ext)) {
      await envManager.loadEnvironment(file, file.name);
      showToast(`HDRI 已加载 ✓`);
    } else if (['obj', 'ply'].includes(ext)) {
      showToast(`${ext.toUpperCase()} 环境加载中...`);
      await envManager.loadEnvironment(file, file.name.replace(/\.[^.]+$/, ''));
    }
  }
});

// ══════════════════════════════════════════
// Keyboard Shortcuts
// ══════════════════════════════════════════
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

  switch (e.key.toLowerCase()) {
    case ' ':
      e.preventDefault();
      togglePlay();
      break;
    case 'g':
      sceneManager.setGizmoMode('translate');
      document.querySelectorAll('.gizmo-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-gizmo="translate"]')?.classList.add('active');
      break;
    case 'r':
      sceneManager.setGizmoMode('rotate');
      document.querySelectorAll('.gizmo-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-gizmo="rotate"]')?.classList.add('active');
      break;
    case 's':
      if (!e.metaKey && !e.ctrlKey) {
        sceneManager.setGizmoMode('scale');
        document.querySelectorAll('.gizmo-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-gizmo="scale"]')?.classList.add('active');
      }
      break;
    case 'delete':
    case 'backspace':
      if (sceneManager.selectedObject) {
        const char = characterManager.characters.find(c => c.model === sceneManager.selectedObject);
        if (char) {
          characterManager.removeCharacter(char);
          renderCharacterList();
        }
      }
      break;
    case 'arrowleft':
      setFrame(currentFrame - 1);
      break;
    case 'arrowright':
      setFrame(currentFrame + 1);
      break;
  }
});

// ══════════════════════════════════════════
// Toast Notifications
// ══════════════════════════════════════════
function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.cssText = `
    position: fixed; bottom: 72px; left: 50%; transform: translateX(-50%);
    padding: 8px 20px; border-radius: 8px; font-size: 12px; font-weight: 500;
    z-index: 300; pointer-events: none;
    backdrop-filter: blur(12px);
    animation: toastIn 0.3s ease-out;
    ${type === 'error'
      ? 'background: rgba(200,40,40,0.85); color: #fff; border: 1px solid rgba(255,80,80,0.5);'
      : 'background: rgba(15,15,30,0.9); color: #e8e8f0; border: 1px solid rgba(100,120,255,0.3);'}
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// Toast animation
const toastStyle = document.createElement('style');
toastStyle.textContent = `
  @keyframes toastIn {
    from { opacity: 0; transform: translateX(-50%) translateY(10px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
`;
document.head.appendChild(toastStyle);

// ══════════════════════════════════════════
// Render settings sync
// ══════════════════════════════════════════
document.getElementById('renderFrameCount')?.addEventListener('change', (e) => {
  totalFrames = parseInt(e.target.value) || 48;
  updateTimeline();
});
document.getElementById('renderFps')?.addEventListener('change', (e) => {
  fps = parseInt(e.target.value) || 24;
  updateTimeline();
});

console.log('%c◈ Action Director Web v1.0', 'color: #6488ff; font-size: 16px; font-weight: bold;');
console.log('%c  3D 动画导演台 — Ready', 'color: #888; font-size: 12px;');
