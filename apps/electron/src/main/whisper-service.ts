import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { TranscriptionResult } from '../shared/types';

let transcriber: any = null;
let loading = false;

export class WhisperService {
  private initialized = false;

  isInitialized(): boolean {
    return this.initialized;
  }

  async initialize(onProgress?: (data: { status: string; progress?: number; file?: string }) => void): Promise<void> {
    if (this.initialized || loading) return;
    loading = true;

    try {
      console.log('[Whisper] Loading model Xenova/whisper-small.en...');
      const dynamicImport = new Function('specifier', 'return import(specifier)');
      const transformers = await dynamicImport('@xenova/transformers');

      // Set up progress callback if provided
      if (onProgress) {
        transformers.env.allowLocalModels = true;
        transformers.env.useBrowserCache = false;
      }

      transcriber = await transformers.pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-small.en',
        {
          quantized: true,
          progress_callback: onProgress || undefined,
        }
      );
      this.initialized = true;
      console.log('[Whisper] Model loaded successfully');
    } catch (err) {
      console.error('[Whisper] Failed to load model:', err);
      throw err;
    } finally {
      loading = false;
    }
  }

  async transcribe(wavFilePath: string): Promise<TranscriptionResult> {
    if (!this.initialized || !transcriber) {
      throw new Error('WhisperService not initialized');
    }

    const startTime = Date.now();
    try {
      console.log(`[Whisper] Transcribing: ${wavFilePath}`);

      // Read WAV file and extract raw PCM samples as Float32Array
      // (transformers.js in Node.js needs raw audio data, not file paths)
      const wavBuffer = fs.readFileSync(wavFilePath);
      const audioData = this.decodeWav(wavBuffer);

      const result = await transcriber(audioData, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: false,
        sampling_rate: 16000,
      });
      const text = (result?.text || '').trim();
      const durationMs = Date.now() - startTime;
      console.log(`[Whisper] Result (${durationMs}ms): "${text}"`);
      return { text, durationMs };
    } catch (err) {
      console.error('[Whisper] Transcription error:', err);
      throw err;
    }
  }

  /**
   * Decode a 16-bit PCM WAV buffer into Float32Array samples.
   */
  private decodeWav(buffer: Buffer): Float32Array {
    // Skip 44-byte WAV header, read 16-bit signed PCM
    const dataOffset = 44;
    const numSamples = (buffer.length - dataOffset) / 2;
    const samples = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      const val = buffer.readInt16LE(dataOffset + i * 2);
      samples[i] = val / 32768;
    }
    return samples;
  }

  async transcribeBuffer(wavBuffer: Buffer): Promise<TranscriptionResult> {
    const tmpFile = path.join(os.tmpdir(), `vtt-${Date.now()}.wav`);
    try {
      fs.writeFileSync(tmpFile, wavBuffer);
      return await this.transcribe(tmpFile);
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  }
}
