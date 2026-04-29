import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  EncodedPacket,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  Input,
  Mp4OutputFormat,
  Output,
} from 'mediabunny';

import type { AnnotationModel, CropRect, ExportSettings, SliceModel, VideoMeta } from '../types/editor';
import { clampCropToVideo, getDefaultCrop, getDefaultSceneCrop } from '../app/appUtils';
import { prepareAnnotationAssets, releaseAnnotationAssets, renderFrameToCanvas } from './exportRenderer';
import {
  clampCrop,
  getConfiguredBitrate,
  getOutputFrameDurationUs,
  getSortedSlices,
  getTotalFrameCount,
} from './exportVideoUtils';

export interface BrowserExportDiagnostics {
  beforeRuntimeReady?: (signal?: AbortSignal) => Promise<void> | void;
  beforeInputLoad?: (signal?: AbortSignal) => Promise<void> | void;
  onInputCreated?: () => void;
  onInputDestroyed?: () => void;
}

interface ExportVideoToMp4Input {
  sources: VideoMeta[];
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

function toEvenDimension(value: number): number {
  const rounded = Math.max(16, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

async function getSupportedAvcEncoderConfig(
  width: number,
  height: number,
  bitrate: number,
  framerate: number,
): Promise<VideoEncoderConfig | null> {
  // Try modern/high-level profiles first so large exports (e.g. >1080p) can negotiate support.
  const codecCandidates = [
    'avc1.640034',
    'avc1.640033',
    'avc1.640032',
    'avc1.64002A',
    'avc1.640029',
    'avc1.640028',
    'avc1.4D4034',
    'avc1.4D4033',
    'avc1.4D4032',
    'avc1.4D402A',
    'avc1.4D4029',
    'avc1.4D4028',
    'avc1.42E034',
    'avc1.42E033',
    'avc1.42E032',
    'avc1.42E02A',
    'avc1.42E029',
    'avc1.42E028',
    'avc1.42001f',
    'avc1.42E01E',
    'avc1.4D401F',
    'avc1.64001F',
  ];

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
}

export async function exportVideoToMp4({
  sources,
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

  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  const loadedInputs = new Map<
    string,
    {
      input: Input;
      packetSink: EncodedPacketSink;
      decoderConfig: VideoDecoderConfig;
    }
  >();
  const decoderConfigs = new Map<string, VideoDecoderConfig>();

  let annotationAssets: Awaited<ReturnType<typeof prepareAnnotationAssets>> | null = null;
  let encoder: VideoEncoder | null = null;
  let mp4Output: Output<Mp4OutputFormat, BufferTarget> | null = null;
  try {
    const getLoadedInput = async (source: VideoMeta) => {
      const existing = loadedInputs.get(source.id);
      if (existing) {
        return existing;
      }

      const input = new Input({
        source: new BlobSource(source.file),
        formats: ALL_FORMATS,
      });
      diagnostics?.onInputCreated?.();

      try {
        await diagnostics?.beforeInputLoad?.(signal);
        throwIfAborted(signal);

        const track = await input.getPrimaryVideoTrack();
        if (!track) {
          throw new Error(`The imported file "${source.file.name}" does not contain a supported video track.`);
        }

        const decoderConfig = await track.getDecoderConfig();
        if (!decoderConfig) {
          throw new Error(`The imported file "${source.file.name}" does not contain a supported video track.`);
        }

        const packetSink = new EncodedPacketSink(track);
        const loadedInput = { input, packetSink, decoderConfig };
        loadedInputs.set(source.id, loadedInput);
        return loadedInput;
      } catch (error) {
        input.dispose();
        diagnostics?.onInputDestroyed?.();
        throw error;
      }
    };

    const getDecoderConfigForSource = async (source: VideoMeta) => {
      const cached = decoderConfigs.get(source.id);
      if (cached) {
        return cached;
      }

      const loadedInput = await getLoadedInput(source);
      decoderConfigs.set(source.id, loadedInput.decoderConfig);
      return loadedInput.decoderConfig;
    };

    const primarySource = sources[0];
    if (!primarySource) {
      throw new Error('There is nothing to export.');
    }
    const resolvedReferenceCrop = globalCrop
      ? clampCropToVideo(globalCrop, primarySource)
      : getDefaultCrop(primarySource.width, primarySource.height);
    const virtualBaseCrop: CropRect = {
      x: 0,
      y: 0,
      w: resolvedReferenceCrop.w,
      h: resolvedReferenceCrop.h,
    };
    const referenceAspectRatio = virtualBaseCrop.w / Math.max(1, virtualBaseCrop.h);

    await getDecoderConfigForSource(primarySource);
    onProgress?.(28);

    const outputWidth = toEvenDimension(exportSettings.width);
    const outputHeight = toEvenDimension(exportSettings.height);
    const fps = Math.max(1, Math.round(exportSettings.mp4Fps));
    const frameDurationUs = getOutputFrameDurationUs(fps);
    const totalFrameCount = getTotalFrameCount(totalDuration, fps);
    const sortedSlices = getSortedSlices(slices);
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

    let deferredError: Error | null = null;
    let muxQueue = Promise.resolve();
    let encodedPacketCount = 0;
    const outputTarget = new BufferTarget();
    mp4Output = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target: outputTarget,
    });
    const encodedVideoSource = new EncodedVideoPacketSource('avc');
    mp4Output.addVideoTrack(encodedVideoSource, {
      frameRate: fps,
      name: 'screencast-editor',
    });
    await mp4Output.start();

    encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        if (deferredError) {
          return;
        }

        const packet = EncodedPacket.fromEncodedChunk(chunk);
        encodedPacketCount += 1;
        muxQueue = muxQueue
          .then(async () => {
            throwIfAborted(signal);
            await encodedVideoSource.add(packet, metadata);
          })
          .catch((error) => {
            deferredError = error instanceof Error ? error : new Error(String(error));
          });
      },
      error: (error) => {
        deferredError = error instanceof Error ? error : new Error(String(error));
      },
    });

    encoder.configure(encoderConfig);

    const emitFrame = async (
      frame: VideoFrame | null,
      baseCrop: CropRect,
      sceneCrop: CropRect,
      outputTimeSec: number,
    ) => {
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
        await emitFrame(null, virtualBaseCrop, virtualBaseCrop, nextOutputFrameIndex / fps);
      }
    };

    const encodeSliceTargets = async (
      source: VideoMeta,
      slice: SliceModel,
      baseCrop: CropRect,
      sceneCrop: CropRect,
      targets: FrameTarget[],
    ) => {
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
                await emitFrame(heldFrame, baseCrop, sceneCrop, targets[targetIndex].outputTimeSec);
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

      const loadedInput = await getLoadedInput(source);
      const decoderConfig = await getDecoderConfigForSource(source);
      const startPacket =
        (await loadedInput.packetSink.getKeyPacket(slice.sourceStart, { verifyKeyPackets: true })) ??
        (await loadedInput.packetSink.getFirstPacket({ verifyKeyPackets: true }));
      if (!startPacket) {
        throw new Error('Failed to decode frames for one of the timeline slices.');
      }
      const endPacket = await loadedInput.packetSink.getPacket(slice.sourceEnd, { verifyKeyPackets: true });
      const endPacketExclusive = endPacket
        ? ((await loadedInput.packetSink.getNextPacket(endPacket, { verifyKeyPackets: true })) ?? undefined)
        : undefined;

      try {
        decoder.configure(decoderConfig);

        for await (const packet of loadedInput.packetSink.packets(startPacket, endPacketExclusive, {
          verifyKeyPackets: true,
        })) {
          throwIfAborted(signal);
          if (deferredError) {
            throw deferredError;
          }
          decoder.decode(packet.toEncodedVideoChunk());
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
          await emitFrame(heldFrame, baseCrop, sceneCrop, targets[targetIndex].outputTimeSec);
          targetIndex += 1;
        }
      } finally {
        (heldFrame as VideoFrame | null)?.close();
        decoder.close();
      }
    };

    let cursor = 0;

    for (const slice of sortedSlices) {
      await emitGapFrames(slice.start);
      cursor = Math.max(cursor, slice.start);

      const source = sourcesById.get(slice.sourceId);
      if (!source) {
        throw new Error(`Missing source for slice ${slice.id}.`);
      }

      const preferredCrop = slice.crop ?? (source.id === primarySource.id ? resolvedReferenceCrop : null);
      const sceneCrop = clampCrop(getDefaultSceneCrop(source, referenceAspectRatio, preferredCrop), source);
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

      await encodeSliceTargets(source, slice, virtualBaseCrop, sceneCrop, targets);
      cursor = slice.end;
    }

    await emitGapFrames(Math.max(cursor, totalDuration));
    throwIfAborted(signal);
    await encoder.flush();
    await muxQueue;

    if (deferredError) {
      throw deferredError;
    }
    if (encodedPacketCount === 0) {
      throw new Error('Failed to build the MP4 output. The browser encoder did not provide MP4 initialization data.');
    }

    onProgress?.(94);
    await mp4Output.finalize();
    const arrayBuffer = outputTarget.buffer;
    if (!arrayBuffer) {
      throw new Error('Failed to build the MP4 output. The muxer did not provide output data.');
    }
    onProgress?.(100);

    return new Blob([arrayBuffer], { type: 'video/mp4' });
  } finally {
    encoder?.close();
    if (mp4Output && mp4Output.state !== 'finalized' && mp4Output.state !== 'canceled') {
      await mp4Output.cancel();
    }
    if (annotationAssets) {
      releaseAnnotationAssets(annotationAssets);
    }
    for (const loadedInput of loadedInputs.values()) {
      loadedInput.input.dispose();
      diagnostics?.onInputDestroyed?.();
    }
  }
}
