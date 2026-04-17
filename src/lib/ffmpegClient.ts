import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const FFMPEG_CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

type FetchFileFn = typeof fetchFile;
type FfmpegInstance = InstanceType<typeof FFmpeg>;

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
    const coreURL = await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, 'text/javascript');
    const wasmURL = await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm');
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
      coreURL,
      wasmURL,
    });

    return {
      ffmpeg,
      fetchFile,
    };
  })().catch((error) => {
    runtimePromise = null;
    throw error;
  });

  return runtimePromise;
}
