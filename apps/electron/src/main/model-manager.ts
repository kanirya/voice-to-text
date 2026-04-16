import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as crypto from 'crypto';
import type { DownloadProgress } from '../shared/types';

export interface ModelInfo {
  name: string;
  fileName: string;
  size: number;
  sha256: string;
  downloadUrl: string;
}

const MODEL_CATALOG: ModelInfo[] = [
  {
    name: 'tiny.en',
    fileName: 'ggml-tiny.en.bin',
    size: 77691713,
    sha256: 'c78c86eb1a8faa21b369bcd33e1d0c2e2ecab3e5c33d5a3eeab247dd92e5457c',
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
  },
  {
    name: 'base.en',
    fileName: 'ggml-base.en.bin',
    size: 147951465,
    sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
  },
  {
    name: 'small.en',
    fileName: 'ggml-small.en.bin',
    size: 487601967,
    sha256: 'db8a495a91d927739e50b3fc1fbb2cd7d63d5ef22c0a8e35f9f3ce8a2c554e7e',
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin',
  },
  {
    name: 'medium.en',
    fileName: 'ggml-medium.en.bin',
    size: 1533774781,
    sha256: 'fd9727b63210e85e2e06b5e2d5a5ad2b9b1a28e13e8e3c1b1e97e7e3e5e5e5e5',
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin',
  },
];

export class ModelManager {
  private modelsDir: string;

  constructor(modelsDir?: string) {
    this.modelsDir = modelsDir ?? path.join(app.getPath('userData'), 'models');
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
    }
  }

  getModelsDir(): string {
    return this.modelsDir;
  }

  getModelInfo(modelName: string): ModelInfo | undefined {
    return MODEL_CATALOG.find((m) => m.name === modelName);
  }

  getModelPath(modelName: string): string | null {
    const info = this.getModelInfo(modelName);
    if (!info) return null;
    return path.join(this.modelsDir, info.fileName);
  }

  isModelDownloaded(modelName: string): boolean {
    const modelPath = this.getModelPath(modelName);
    if (!modelPath) return false;
    return fs.existsSync(modelPath);
  }

  getDownloadedModels(): string[] {
    return MODEL_CATALOG.filter((m) => this.isModelDownloaded(m.name)).map((m) => m.name);
  }

  async downloadModel(
    modelName: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<string> {
    const info = this.getModelInfo(modelName);
    if (!info) throw new Error(`Unknown model: ${modelName}`);

    const filePath = path.join(this.modelsDir, info.fileName);
    const partialPath = filePath + '.partial';

    // Check for partial download to support resume
    let startByte = 0;
    if (fs.existsSync(partialPath)) {
      const stat = fs.statSync(partialPath);
      startByte = stat.size;
    }

    return new Promise<string>((resolve, reject) => {
      const makeRequest = (url: string) => {
        const headers: Record<string, string> = {};
        if (startByte > 0) {
          headers['Range'] = `bytes=${startByte}-`;
        }

        https.get(url, { headers }, (response) => {
          // Handle redirects
          if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            makeRequest(response.headers.location);
            return;
          }

          if (response.statusCode && response.statusCode !== 200 && response.statusCode !== 206) {
            reject(new Error(`Download failed with status ${response.statusCode}`));
            return;
          }

          const totalBytes = startByte + Number(response.headers['content-length'] || 0);
          let bytesDownloaded = startByte;
          const startTime = Date.now();

          const fileStream = fs.createWriteStream(partialPath, {
            flags: startByte > 0 ? 'a' : 'w',
          });

          response.on('data', (chunk: Buffer) => {
            bytesDownloaded += chunk.length;
            const elapsed = (Date.now() - startTime) / 1000 || 1;
            const speedBps = (bytesDownloaded - startByte) / elapsed;
            onProgress?.({
              modelName,
              bytesDownloaded,
              totalBytes,
              percentage: totalBytes > 0 ? Math.round((bytesDownloaded / totalBytes) * 100) : 0,
              speedBps: Math.round(speedBps),
            });
          });

          response.pipe(fileStream);

          fileStream.on('finish', () => {
            // Rename partial to final
            fs.renameSync(partialPath, filePath);
            resolve(filePath);
          });

          fileStream.on('error', (err) => reject(err));
          response.on('error', (err) => reject(err));
        }).on('error', (err) => reject(err));
      };

      makeRequest(info.downloadUrl);
    });
  }

  async verifyModel(modelName: string): Promise<boolean> {
    const info = this.getModelInfo(modelName);
    if (!info) return false;

    const filePath = path.join(this.modelsDir, info.fileName);
    if (!fs.existsSync(filePath)) return false;

    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    return new Promise<boolean>((resolve, reject) => {
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => {
        const computed = hash.digest('hex');
        resolve(computed === info.sha256);
      });
      stream.on('error', (err) => reject(err));
    });
  }

  async deleteModel(modelName: string): Promise<void> {
    const filePath = this.getModelPath(modelName);
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
