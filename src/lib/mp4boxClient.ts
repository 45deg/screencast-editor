export interface Mp4BoxTrackOptions {
  timescale: number;
  width: number;
  height: number;
  hdlr: 'vide';
  type: 'avc1';
  name: string;
  avcDecoderConfigRecord: BufferSource;
}

export interface Mp4BoxSampleOptions {
  duration: number;
  dts: number;
  cts: number;
  is_sync: boolean;
}

export interface Mp4BoxFile {
  addTrack: (options: Mp4BoxTrackOptions) => number;
  addSample: (trackId: number, data: BufferSource, options: Mp4BoxSampleOptions) => void;
  flush?: () => void;
  getBuffer: () => ArrayBuffer | Uint8Array | { buffer: ArrayBufferLike; byteOffset?: number; byteLength?: number };
}

export interface Mp4BoxModule {
  createFile: () => Mp4BoxFile;
}

let runtimePromise: Promise<Mp4BoxModule> | null = null;

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('Export was cancelled', 'AbortError');
  }
}

export async function loadMp4BoxModule(signal?: AbortSignal): Promise<Mp4BoxModule> {
  throwIfAborted(signal);

  if (runtimePromise) {
    return runtimePromise;
  }

  runtimePromise = import('mp4box')
    .then((module) => {
      const runtime = module as unknown as Partial<Mp4BoxModule>;
      if (typeof runtime.createFile !== 'function') {
        throw new Error('Failed to load the MP4 muxer runtime.');
      }
      return runtime as Mp4BoxModule;
    })
    .catch((error) => {
      runtimePromise = null;
      throw error;
    });

  return runtimePromise;
}
