const FFMPEG_CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

type FetchFileFn = typeof import('@ffmpeg/util').fetchFile;
type FfmpegClass = typeof import('@ffmpeg/ffmpeg').FFmpeg;
type FfmpegInstance = InstanceType<FfmpegClass>;

export interface FfmpegRuntime {
  ffmpeg: FfmpegInstance;
  fetchFile: FetchFileFn;
}

let runtimePromise: Promise<FfmpegRuntime> | null = null;

export function loadFfmpegRuntimeFromCDN(signal?: AbortSignal): Promise<FfmpegRuntime> {
  if (runtimePromise) {
    return runtimePromise;
  }

  runtimePromise = (async () => {
    const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
      import('@ffmpeg/ffmpeg'),
      import('@ffmpeg/util'),
    ]);
    const coreURL = await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, 'text/javascript');
    const wasmURL = await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm');
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
      coreURL,
      wasmURL,
    }, signal ? { signal } : undefined);

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
