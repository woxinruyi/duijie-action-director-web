/**
 * MediaPipe Pose Landmarker — full body 33-point tracking.
 */
export class PoseTracker {
  constructor() {
    this.poseLandmarker = null;
    this.isRunning = false;
    this.lastResults = null;
    this.onResults = null;
    this._animFrame = null;
  }

  async init() {
    const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs');
    const { PoseLandmarker, FilesetResolver } = vision;

    const fileset = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    this.poseLandmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
  }

  async startWebcam(videoElement) {
    if (!this.poseLandmarker) await this.init();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
    });
    videoElement.srcObject = stream;
    await videoElement.play();
    this.isRunning = true;
    this._processFrame(videoElement);
  }

  _processFrame(videoElement) {
    if (!this.isRunning) return;
    if (videoElement.readyState >= 2) {
      const results = this.poseLandmarker.detectForVideo(videoElement, performance.now());
      this.lastResults = results;
      if (this.onResults) this.onResults(results);
    }
    this._animFrame = requestAnimationFrame(() => this._processFrame(videoElement));
  }

  stop(videoElement) {
    this.isRunning = false;
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
    if (videoElement && videoElement.srcObject) {
      videoElement.srcObject.getTracks().forEach(t => t.stop());
      videoElement.srcObject = null;
    }
  }

  drawPose(canvas, results) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!results || !results.landmarks || results.landmarks.length === 0) return;

    const lm = results.landmarks[0];
    ctx.fillStyle = '#00ff88';
    ctx.strokeStyle = '#00cc66';
    ctx.lineWidth = 2;

    // Draw connections
    const connections = [
      [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
      [11, 23], [12, 24], [23, 24], [23, 25], [24, 26],
      [25, 27], [26, 28],
    ];
    for (const [a, b] of connections) {
      if (lm[a] && lm[b]) {
        ctx.beginPath();
        ctx.moveTo(lm[a].x * canvas.width, lm[a].y * canvas.height);
        ctx.lineTo(lm[b].x * canvas.width, lm[b].y * canvas.height);
        ctx.stroke();
      }
    }

    // Draw points
    for (const point of lm) {
      ctx.beginPath();
      ctx.arc(point.x * canvas.width, point.y * canvas.height, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
