/**
 * Records mocap data (face blendshapes / pose landmarks) per frame
 * and provides playback / save / load functionality.
 */
export class MocapRecorder {
  constructor() {
    this.isRecording = false;
    this.frames = [];
    this.recordings = this._loadFromStorage();
    this.currentName = 'Capture_001';
  }

  startRecording(name) {
    this.currentName = name || `Capture_${Date.now()}`;
    this.frames = [];
    this.isRecording = true;
  }

  recordFrame(data) {
    if (!this.isRecording) return;
    this.frames.push({
      timestamp: performance.now(),
      ...data,
    });
  }

  stopRecording() {
    this.isRecording = false;
    if (this.frames.length === 0) return null;

    const recording = {
      id: `mocap_${Date.now()}`,
      name: this.currentName,
      frameCount: this.frames.length,
      timestamp: new Date().toISOString(),
      frames: this.frames,
    };

    this.recordings.push(recording);
    this._saveToStorage();
    return recording;
  }

  getRecording(id) {
    return this.recordings.find(r => r.id === id);
  }

  deleteRecording(id) {
    this.recordings = this.recordings.filter(r => r.id !== id);
    this._saveToStorage();
  }

  exportToFile(recording) {
    const blob = new Blob([JSON.stringify(recording, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recording.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  _saveToStorage() {
    try {
      // Save metadata only (frames can be large)
      const meta = this.recordings.map(r => ({
        id: r.id, name: r.name, frameCount: r.frameCount, timestamp: r.timestamp,
      }));
      localStorage.setItem('ad_mocap_meta', JSON.stringify(meta));

      // Save individual recordings
      for (const r of this.recordings) {
        localStorage.setItem(`ad_mocap_${r.id}`, JSON.stringify(r));
      }
    } catch {
      console.warn('[MocapRecorder] localStorage full, skipping save');
    }
  }

  _loadFromStorage() {
    try {
      const meta = JSON.parse(localStorage.getItem('ad_mocap_meta') || '[]');
      return meta.map(m => {
        const full = localStorage.getItem(`ad_mocap_${m.id}`);
        return full ? JSON.parse(full) : m;
      });
    } catch {
      return [];
    }
  }
}
