const FFMPEG_MODULE_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
const FFMPEG_UTIL_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js';
const FFMPEG_CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';

type FetchFileFn = (input: string | Blob | File | Uint8Array | ArrayBuffer) => Promise<Uint8Array>;

interface FfmpegInstance {
  load: (options: { coreURL: string; wasmURL: string; workerURL?: string }) => Promise<void>;
  exec: (args: string[]) => Promise<number>;
  writeFile: (path: string, data: Uint8Array) => Promise<void>;
  readFile: (path: string) => Promise<Uint8Array>;
}

export interface FfmpegRuntime {
  ffmpeg: FfmpegInstance;
  fetchFile: FetchFileFn;
}

let runtimePromise: Promise<FfmpegRuntime> | null = null;

export function loadFfmpegRuntimeFromCDN(): Promise<FfmpegRuntime> {
  if (runtimePromise) {
    return runtimePromise;
  }

  runtimePromise = (async () => {
    const ffmpegModule = await import(/* @vite-ignore */ FFMPEG_MODULE_URL);
    const utilModule = await import(/* @vite-ignore */ FFMPEG_UTIL_URL);

    const FFmpegCtor = ffmpegModule.FFmpeg as new () => FfmpegInstance;
    const fetchFile = utilModule.fetchFile as FetchFileFn;

    if (!FFmpegCtor || !fetchFile) {
      throw new Error('ffmpeg.wasm CDN モジュールの読み込みに失敗しました。');
    }

    const ffmpeg = new FFmpegCtor();
    await ffmpeg.load({
      coreURL: `${FFMPEG_CORE_BASE}/ffmpeg-core.js`,
      wasmURL: `${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`,
      workerURL: `${FFMPEG_CORE_BASE}/ffmpeg-core.worker.js`,
    });

    return {
      ffmpeg,
      fetchFile,
    };
  })();

  return runtimePromise;
}
