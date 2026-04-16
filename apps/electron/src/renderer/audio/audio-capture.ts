export interface AudioCaptureConfig {
  sampleRate: number;
  silenceThresholdDb: number;
  silenceDurationMs: number;
}

const DEFAULT_CONFIG: AudioCaptureConfig = {
  sampleRate: 16000,
  silenceThresholdDb: -40,
  silenceDurationMs: 1500,
};

export class AudioCapture {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private recording = false;
  private accumulatedSamples: Float32Array[] = [];
  private config: AudioCaptureConfig = DEFAULT_CONFIG;

  private onSilenceDetected: (() => void) | null = null;
  private onError: ((error: Error) => void) | null = null;

  setOnSilenceDetected(cb: () => void): void {
    this.onSilenceDetected = cb;
  }

  setOnError(cb: (error: Error) => void): void {
    this.onError = cb;
  }

  async start(config?: Partial<AudioCaptureConfig>): Promise<void> {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.accumulatedSamples = [];

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const error = new Error(
        'Microphone access denied. Please grant microphone permission in system settings.'
      );
      this.onError?.(error);
      throw error;
    }

    try {
      const deviceSampleRate = this.mediaStream.getAudioTracks()[0]?.getSettings().sampleRate;
      this.audioContext = new AudioContext({
        sampleRate: deviceSampleRate || 44100,
      });

      const vadProcessorUrl = new URL('./vad-processor.js', `file://${__dirname}`).href;
      await this.audioContext.audioWorklet.addModule(vadProcessorUrl);

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'vad-processor');

      // Convert dB threshold to linear RMS
      const linearThreshold = Math.pow(10, this.config.silenceThresholdDb / 20);

      this.workletNode.port.postMessage({
        type: 'configure',
        silenceDurationMs: this.config.silenceDurationMs,
        threshold: linearThreshold,
      });

      this.workletNode.port.onmessage = (event: MessageEvent) => {
        const { type, samples } = event.data;
        if (type === 'silence-detected') {
          this.onSilenceDetected?.();
        } else if (type === 'audio-data' && samples) {
          this.accumulatedSamples.push(samples);
        }
      };

      this.sourceNode.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);
      this.recording = true;
    } catch (err) {
      this.cleanup();
      const error = err instanceof Error ? err : new Error(String(err));
      this.onError?.(error);
      throw error;
    }
  }

  stop(): Float32Array {
    if (!this.recording || !this.workletNode) {
      return new Float32Array(0);
    }

    // Request accumulated audio data from the worklet
    this.workletNode.port.postMessage({ type: 'get-audio-data' });
    this.workletNode.port.postMessage({ type: 'stop' });

    const deviceRate = this.audioContext?.sampleRate || 44100;
    const targetRate = this.config.sampleRate;

    // Merge any samples we already received
    const merged = this.mergeSamples(this.accumulatedSamples);

    this.cleanup();

    // Downsample if needed
    if (deviceRate !== targetRate && merged.length > 0) {
      return this.downsample(merged, deviceRate, targetRate);
    }

    return merged;
  }

  isRecording(): boolean {
    return this.recording;
  }

  private mergeSamples(chunks: Float32Array[]): Float32Array {
    if (chunks.length === 0) return new Float32Array(0);
    let totalLength = 0;
    for (const chunk of chunks) totalLength += chunk.length;
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }

  private downsample(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
    const ratio = fromRate / toRate;
    const newLength = Math.round(samples.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const low = Math.floor(srcIndex);
      const high = Math.min(low + 1, samples.length - 1);
      const frac = srcIndex - low;
      result[i] = samples[low] * (1 - frac) + samples[high] * frac;
    }
    return result;
  }

  private cleanup(): void {
    this.recording = false;
    this.workletNode?.disconnect();
    this.sourceNode?.disconnect();
    this.workletNode = null;
    this.sourceNode = null;
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }
}
