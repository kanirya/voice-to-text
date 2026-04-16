/**
 * AudioWorklet processor for Voice Activity Detection (VAD).
 * Computes RMS energy per frame, accumulates PCM samples,
 * and posts messages when silence is detected.
 */
class VadProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    /** @type {Float32Array[]} */
    this._chunks = [];
    this._silenceStart = -1;
    this._silenceDurationMs = 1500;
    this._threshold = 0.01; // RMS energy threshold (linear)
    this._stopped = false;

    this.port.onmessage = (event) => {
      const { type, silenceDurationMs, threshold } = event.data;
      if (type === 'configure') {
        if (silenceDurationMs !== undefined) this._silenceDurationMs = silenceDurationMs;
        if (threshold !== undefined) this._threshold = threshold;
      } else if (type === 'get-audio-data') {
        this._sendAudioData();
      } else if (type === 'stop') {
        this._stopped = true;
      } else if (type === 'reset') {
        this._chunks = [];
        this._silenceStart = -1;
        this._stopped = false;
      }
    };
  }

  /**
   * Compute RMS energy of a Float32Array audio frame.
   * @param {Float32Array} frame
   * @returns {number}
   */
  _computeRMS(frame) {
    let sum = 0;
    for (let i = 0; i < frame.length; i++) {
      sum += frame[i] * frame[i];
    }
    return Math.sqrt(sum / frame.length);
  }

  _sendAudioData() {
    if (this._chunks.length === 0) {
      this.port.postMessage({ type: 'audio-data', samples: new Float32Array(0) });
      return;
    }
    let totalLength = 0;
    for (const chunk of this._chunks) {
      totalLength += chunk.length;
    }
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this._chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this.port.postMessage({ type: 'audio-data', samples: merged }, [merged.buffer]);
    this._chunks = [];
  }

  /**
   * @param {Float32Array[][]} inputs
   * @param {Float32Array[][]} outputs
   * @param {Object} parameters
   * @returns {boolean}
   */
  process(inputs, outputs, parameters) {
    if (this._stopped) return false;

    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;

    const channelData = input[0];

    // Store a copy of the samples
    this._chunks.push(new Float32Array(channelData));

    // Compute RMS energy
    const rms = this._computeRMS(channelData);

    if (rms < this._threshold) {
      if (this._silenceStart === -1) {
        this._silenceStart = currentTime;
      }
      const silenceElapsedMs = (currentTime - this._silenceStart) * 1000;
      if (silenceElapsedMs >= this._silenceDurationMs) {
        this.port.postMessage({ type: 'silence-detected' });
        this._silenceStart = -1;
      }
    } else {
      this._silenceStart = -1;
    }

    return true;
  }
}

registerProcessor('vad-processor', VadProcessor);
