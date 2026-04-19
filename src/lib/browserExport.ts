import { WebDemuxer } from 'web-demuxer';

import type { AnnotationModel, CropRect, ExportSettings, SliceModel, VideoMeta } from '../types/editor';
import { prepareAnnotationAssets, releaseAnnotationAssets, renderFrameToCanvas } from './exportRenderer';
import {
  clampCrop,
  getBaseCrop,
  getConfiguredBitrate,
  getOutputFrameDurationUs,
  getSortedSlices,
  getTotalFrameCount,
} from './exportVideoUtils';
import { loadMp4BoxModule } from './mp4boxClient';

export interface BrowserExportDiagnostics {
  beforeRuntimeReady?: (signal?: AbortSignal) => Promise<void> | void;
  beforeDemuxerLoad?: (signal?: AbortSignal) => Promise<void> | void;
  onDemuxerCreated?: () => void;
  onDemuxerDestroyed?: () => void;
}

interface ExportVideoToMp4Input {
  video: VideoMeta;
  slices: SliceModel[];
  annotations: AnnotationModel[];
  globalCrop: CropRect | null;
  exportSettings: ExportSettings;
  totalDuration: number;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
  diagnostics?: BrowserExportDiagnostics;
}

interface FrameTarget {
  outputTimeSec: number;
  sourceTimeUs: number;
}

type ExportCanvas = HTMLCanvasElement | OffscreenCanvas;

function getWebDemuxerWasmUrl(): string {
  const baseUrl = import.meta.env.BASE_URL || './';
  const runtimeBase =
    typeof document !== 'undefined'
      ? document.baseURI
      : typeof location !== 'undefined'
        ? location.href
        : 'http://localhost/';

  return new URL(`${baseUrl}web-demuxer.wasm`, runtimeBase).toString();
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('Export was cancelled', 'AbortError');
  }
}

function createCanvas(width: number, height: number): ExportCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getCanvasContext(canvas: ExportCanvas) {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to initialize the export canvas.');
  }

  return context;
}

function toEncodedVideoChunk(sample: EncodedVideoChunk | Record<string, unknown>): EncodedVideoChunk {
  if (sample instanceof EncodedVideoChunk) {
    return sample;
  }

  const dataSource = sample.data;
  const data =
    dataSource instanceof Uint8Array
      ? dataSource
      : dataSource instanceof ArrayBuffer
        ? new Uint8Array(dataSource)
        : new Uint8Array(dataSource as ArrayBufferLike);
  const timestamp =
    typeof sample.timestamp === 'number'
      ? sample.timestamp
      : Math.round((Number(sample.timestampNs) || 0) / 1000);
  const duration =
    typeof sample.duration === 'number'
      ? sample.duration
      : Math.max(1, Math.round((Number(sample.durationNs) || 33_333_000) / 1000));
  const type = sample.type === 'key' || sample.type === 'delta' ? sample.type : sample.is_sync ? 'key' : 'delta';

  return new EncodedVideoChunk({
    type,
    timestamp,
    duration,
    data,
  });
}

function toEvenDimension(value: number): number {
  const rounded = Math.max(16, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

function toBufferSource(data: AllowSharedBufferSource): BufferSource {
  if (data instanceof SharedArrayBuffer) {
    return Uint8Array.from(new Uint8Array(data));
  }

  if (ArrayBuffer.isView(data) && data.buffer instanceof SharedArrayBuffer) {
    return Uint8Array.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  }

  return data as BufferSource;
}

function toArrayBuffer(
  buffer: ArrayBuffer | Uint8Array | { buffer: ArrayBufferLike; byteOffset?: number; byteLength?: number },
): ArrayBuffer {
  if (buffer instanceof ArrayBuffer) {
    return buffer;
  }

  if (buffer instanceof Uint8Array) {
    return Uint8Array.from(buffer).buffer;
  }

  const source = buffer.buffer;
  const byteOffset = buffer.byteOffset ?? 0;
  const availableLength = source.byteLength - byteOffset;
  const byteLength = buffer.byteLength ?? availableLength;

  if (source instanceof SharedArrayBuffer) {
    return Uint8Array.from(new Uint8Array(source, byteOffset, byteLength)).buffer;
  }

  return source.slice(byteOffset, byteOffset + byteLength);
}

async function getSupportedAvcEncoderConfig(
  width: number,
  height: number,
  bitrate: number,
  framerate: number,
): Promise<VideoEncoderConfig | null> {
  const codecCandidates = ['avc1.42001f', 'avc1.42E01E', 'avc1.4D401F', 'avc1.64001F'];

  for (const codec of codecCandidates) {
    const config: VideoEncoderConfig = {
      codec,
      width,
      height,
      bitrate,
      framerate,
      avc: { format: 'avc' },
    };
    const support = await VideoEncoder.isConfigSupported(config);
    if (support.supported) {
      return config;
    }
  }

  return null;
}

export async function ensureBrowserExportRuntimeReady(signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);

  if (
    typeof VideoDecoder === 'undefined' ||
    typeof VideoEncoder === 'undefined' ||
    typeof VideoFrame === 'undefined'
  ) {
    throw new Error('This browser does not support the WebCodecs APIs required for export.');
  }

  await loadMp4BoxModule(signal);
}

export async function exportVideoToMp4({
  video,
  slices,
  annotations,
  globalCrop,
  exportSettings,
  totalDuration,
  signal,
  onProgress,
  diagnostics,
}: ExportVideoToMp4Input): Promise<Blob> {
  await diagnostics?.beforeRuntimeReady?.(signal);
  await ensureBrowserExportRuntimeReady(signal);
  throwIfAborted(signal);
  onProgress?.(14);

  const mp4box = await loadMp4BoxModule(signal);
  const demuxer = new WebDemuxer({ wasmFilePath: getWebDemuxerWasmUrl() });
  diagnostics?.onDemuxerCreated?.();

  let annotationAssets: Awaited<ReturnType<typeof prepareAnnotationAssets>> | null = null;
  let encoder: VideoEncoder | null = null;
  try {
    await diagnostics?.beforeDemuxerLoad?.(signal);
    await demuxer.load(video.file);
    throwIfAborted(signal);
    onProgress?.(28);

    const decoderConfig = await demuxer.getDecoderConfig('video');
    if (!decoderConfig) {
      throw new Error('The imported file does not contain a supported video track.');
    }

    const outputWidth = toEvenDimension(exportSettings.width);
    const outputHeight = toEvenDimension(exportSettings.height);
    const fps = Math.max(1, Math.round(exportSettings.mp4Fps));
    const frameDurationUs = getOutputFrameDurationUs(fps);
    const totalFrameCount = getTotalFrameCount(totalDuration, fps);
    const sortedSlices = getSortedSlices(slices);
    const baseCrop = getBaseCrop(video, globalCrop);
    annotationAssets = await prepareAnnotationAssets(annotations);
    const canvas = createCanvas(outputWidth, outputHeight);
    const context = getCanvasContext(canvas);

    let nextOutputFrameIndex = 0;

    const targetBitrate = getConfiguredBitrate(outputWidth, outputHeight, {
      ...exportSettings,
      mp4Fps: fps,
    });
    const encoderConfig = await getSupportedAvcEncoderConfig(outputWidth, outputHeight, targetBitrate, fps);
    if (!encoderConfig) {
      throw new Error(
        `H.264 WebCodecs encoding is not supported in this browser for ${outputWidth}x${outputHeight} at ${fps} fps.`,
      );
    }

    const outputSamples: Array<{ bytes: Uint8Array; timestamp: number; key: boolean }> = [];
    const mp4 = mp4box.createFile();
    let trackId: number | null = null;
    let deferredError: Error | null = null;

    encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        if (deferredError) {
          return;
        }

        const bytes = new Uint8Array(chunk.byteLength);
        chunk.copyTo(bytes);

        if (!trackId) {
          const description = metadata?.decoderConfig?.description;
          if (!description) {
            deferredError = new Error('Failed to build the MP4 output. The browser encoder did not provide MP4 initialization data.');
            return;
          }

          trackId = mp4.addTrack({
            timescale: 1_000_000,
            width: outputWidth,
            height: outputHeight,
            hdlr: 'vide',
            type: 'avc1',
            name: 'screencast-editor',
            avcDecoderConfigRecord: toBufferSource(description),
          });
        }

        outputSamples.push({
          bytes,
          timestamp: chunk.timestamp,
          key: chunk.type === 'key',
        });
      },
      error: (error) => {
        deferredError = error instanceof Error ? error : new Error(String(error));
      },
    });

    encoder.configure(encoderConfig);

    const emitFrame = async (frame: VideoFrame | null, sceneCrop: CropRect, outputTimeSec: number) => {
      throwIfAborted(signal);
      renderFrameToCanvas({
        context,
        frame,
        baseCrop,
        sceneCrop,
        outputWidth,
        outputHeight,
        annotations,
        timeSec: outputTimeSec,
        assets: annotationAssets!,
      });

      const timestamp = nextOutputFrameIndex * frameDurationUs;
      const encodedFrame = new VideoFrame(canvas, {
        timestamp,
        duration: frameDurationUs,
      });

      try {
        encoder!.encode(encodedFrame, { keyFrame: nextOutputFrameIndex % Math.max(1, fps) === 0 });
      } finally {
        encodedFrame.close();
      }

      nextOutputFrameIndex += 1;
      onProgress?.(36 + (nextOutputFrameIndex / Math.max(1, totalFrameCount)) * 54);
    };

    const emitGapFrames = async (endSec: number) => {
      while (nextOutputFrameIndex / fps < endSec - 1e-9) {
        await emitFrame(null, baseCrop, nextOutputFrameIndex / fps);
      }
    };

    const encodeSliceTargets = async (slice: SliceModel, sceneCrop: CropRect, targets: FrameTarget[]) => {
      if (!targets.length) {
        return;
      }

      let targetIndex = 0;
      let heldFrame: VideoFrame | null = null;
      let processing = Promise.resolve();
      const decoder = new VideoDecoder({
        output: (frame) => {
          processing = processing
            .then(async () => {
              if (deferredError) {
                frame.close();
                return;
              }

              if (!heldFrame) {
                heldFrame = frame;
                return;
              }

              while (targetIndex < targets.length && targets[targetIndex].sourceTimeUs < frame.timestamp) {
                await emitFrame(heldFrame, sceneCrop, targets[targetIndex].outputTimeSec);
                targetIndex += 1;
              }

              heldFrame.close();
              heldFrame = frame;
            })
            .catch((error) => {
              deferredError = error instanceof Error ? error : new Error(String(error));
              frame.close();
            });
        },
        error: (error) => {
          deferredError = error instanceof Error ? error : new Error(String(error));
        },
      });

      const reader = demuxer.read('video', slice.sourceStart, slice.sourceEnd).getReader();

      try {
        decoder.configure(decoderConfig);

        while (true) {
          throwIfAborted(signal);
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          if (deferredError) {
            throw deferredError;
          }
          if (value) {
            decoder.decode(toEncodedVideoChunk(value as EncodedVideoChunk | Record<string, unknown>));
          }
        }

        await decoder.flush();
        await processing;

        if (deferredError) {
          throw deferredError;
        }
        if (!heldFrame) {
          throw new Error('Failed to decode frames for one of the timeline slices.');
        }

        while (targetIndex < targets.length) {
          await emitFrame(heldFrame, sceneCrop, targets[targetIndex].outputTimeSec);
          targetIndex += 1;
        }
      } finally {
        reader.releaseLock();
        (heldFrame as VideoFrame | null)?.close();
        decoder.close();
      }
    };

    let cursor = 0;

    for (const slice of sortedSlices) {
      await emitGapFrames(slice.start);
      cursor = Math.max(cursor, slice.start);

      const sceneCrop = clampCrop(slice.crop ?? baseCrop, video);
      const targets: FrameTarget[] = [];
      let tempFrameIndex = nextOutputFrameIndex;
      while (tempFrameIndex / fps < slice.end - 1e-9) {
        const outputTimeSec = tempFrameIndex / fps;
        if (outputTimeSec >= slice.start - 1e-9) {
          const sourceTimeSec = slice.sourceStart + (outputTimeSec - slice.start) * (slice.sourceEnd - slice.sourceStart) / Math.max(0.0001, slice.duration);
          targets.push({
            outputTimeSec,
            sourceTimeUs: Math.max(0, Math.round(sourceTimeSec * 1_000_000)),
          });
        }
        tempFrameIndex += 1;
      }

      await encodeSliceTargets(slice, sceneCrop, targets);
      cursor = slice.end;
    }

    await emitGapFrames(Math.max(cursor, totalDuration));
    throwIfAborted(signal);
    await encoder.flush();

    if (deferredError) {
      throw deferredError;
    }
    if (!trackId || outputSamples.length === 0) {
      throw new Error('Failed to build the MP4 output. The browser encoder did not provide MP4 initialization data.');
    }

    const finalTrackId = trackId;
    onProgress?.(94);
    outputSamples.forEach((sample, index) => {
      const nextSample = outputSamples[index + 1];
      const duration = nextSample ? Math.max(1, nextSample.timestamp - sample.timestamp) : frameDurationUs;
      mp4.addSample(finalTrackId, Uint8Array.from(sample.bytes), {
        duration,
        dts: sample.timestamp,
        cts: sample.timestamp,
        is_sync: sample.key,
      });
    });

    mp4.flush?.();
    const arrayBuffer = toArrayBuffer(mp4.getBuffer());
    onProgress?.(100);

    return new Blob([arrayBuffer], { type: 'video/mp4' });
  } finally {
    encoder?.close();
    if (annotationAssets) {
      releaseAnnotationAssets(annotationAssets);
    }
    demuxer.destroy();
    diagnostics?.onDemuxerDestroyed?.();
  }
}
