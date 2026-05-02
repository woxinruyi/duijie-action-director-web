/**
 * MediaPipe Face Landmarker integration.
 * Loads MediaPipe Vision WASM via CDN, tracks 478 face landmarks + 52 blendshapes.
 */
export class FaceTracker {
  constructor() {
    this.faceLandmarker = null;
    this.isRunning = false;
    this.lastResults = null;
    this.onResults = null;
    this._animFrame = null;
  }

  async init() {
    // Dynamically import MediaPipe
    const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs');
    const { FaceLandmarker, FilesetResolver } = vision;

    const fileset = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    this.faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
  }

  async startWebcam(videoElement) {
    if (!this.faceLandmarker) await this.init();

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
    });
    videoElement.srcObject = stream;
    await videoElement.play();

    this.isRunning = true;
    this._processFrame(videoElement);
  }

  startVideo(videoElement) {
    if (!this.faceLandmarker) return;
    this.isRunning = true;
    this._processFrame(videoElement);
  }

  _processFrame(videoElement) {
    if (!this.isRunning) return;

    if (videoElement.readyState >= 2) {
      const results = this.faceLandmarker.detectForVideo(videoElement, performance.now());
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

  /** Draw face landmarks on a canvas overlay */
  drawLandmarks(canvas, results) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!results || !results.faceLandmarks || results.faceLandmarks.length === 0) return;

    const landmarks = results.faceLandmarks[0];
    ctx.fillStyle = '#00ff88';

    for (const point of landmarks) {
      const x = point.x * canvas.width;
      const y = point.y * canvas.height;
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Extract blendshape values as a simple object */
  getBlendshapes(results) {
    if (!results || !results.faceBlendshapes || results.faceBlendshapes.length === 0) return null;
    const shapes = {};
    for (const bs of results.faceBlendshapes[0].categories) {
      shapes[bs.categoryName] = bs.score;
    }
    return shapes;
  }
}
