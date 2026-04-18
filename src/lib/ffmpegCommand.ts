import {
  deriveSlices,
  getTotalDuration,
  type CropRect,
  type ExportSettings,
  type SliceModel,
  type VideoMeta,
} from '../types/editor';

export interface BuildFfmpegOverlayInput {
  fileName: string;
  start: number;
  end: number;
}

export interface BuildFfmpegCommandInput {
  video: VideoMeta;
  slices: SliceModel[];
  globalCrop: CropRect | null;
  exportSettings: ExportSettings;
  inputFileName?: string;
  outputFileName?: string;
  overlayInputs?: BuildFfmpegOverlayInput[];
  outputDuration?: number;
}

export interface BuildFfmpegCommandResult {
  filterComplex: string;
  command: string;
  execArgs: string[];
  inputFileName: string;
  outputFileName: string;
}

function clampCrop(crop: CropRect, video: VideoMeta): CropRect {
  const x = Math.max(0, Math.min(video.width - 1, Math.round(crop.x)));
  const y = Math.max(0, Math.min(video.height - 1, Math.round(crop.y)));
  const maxW = Math.max(1, video.width - x);
  const maxH = Math.max(1, video.height - y);

  return {
    x,
    y,
    w: Math.max(1, Math.min(maxW, Math.round(crop.w))),
    h: Math.max(1, Math.min(maxH, Math.round(crop.h))),
  };
}

function getBaseCrop(video: VideoMeta, globalCrop: CropRect | null): CropRect {
  if (!globalCrop) {
    return {
      x: 0,
      y: 0,
      w: video.width,
      h: video.height,
    };
  }

  return clampCrop(globalCrop, video);
}

function formatFloat(value: number): string {
  return Math.max(0, value).toFixed(3);
}

export function buildFfmpegCommand(input: BuildFfmpegCommandInput): BuildFfmpegCommandResult {
  const {
    video,
    slices,
    globalCrop,
    exportSettings,
    inputFileName = video.file.name,
    outputFileName = exportSettings.format === 'gif' ? 'output.gif' : 'output.mp4',
    overlayInputs = [],
    outputDuration,
  } = input;

  const baseCrop = getBaseCrop(video, globalCrop);
  const baseW = Math.max(1, Math.round(baseCrop.w));
  const baseH = Math.max(1, Math.round(baseCrop.h));
  const outputWidth = Math.max(16, Math.round(exportSettings.width));
  const outputHeight = Math.max(16, Math.round(exportSettings.height));

  const sortedSlices = deriveSlices(slices).sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const timelineParts: string[] = [];
  const concatLabels: string[] = [];
  let cursor = 0;
  let segmentIndex = 0;

  const pushGap = (duration: number) => {
    const safeDuration = Math.max(0, duration);
    if (safeDuration <= 0.0001) {
      return;
    }

    const label = `gap_${segmentIndex}`;
    segmentIndex += 1;
    timelineParts.push(`color=c=black:s=${baseW}x${baseH}:d=${formatFloat(safeDuration)}[${label}]`);
    concatLabels.push(`[${label}]`);
  };

  for (const slice of sortedSlices) {
    const start = Math.max(cursor, slice.start);
    pushGap(start - cursor);

    const crop = clampCrop(slice.crop ?? baseCrop, video);
    const setPtsFactor = 1 / Math.max(0.0001, slice.speed);
    const needsPad = crop.w !== baseW || crop.h !== baseH;
    const label = `seg_${segmentIndex}`;
    segmentIndex += 1;
    const chain: string[] = [
      `[0:v]trim=start=${formatFloat(slice.sourceStart)}:end=${formatFloat(slice.sourceEnd)}`,
      `setpts=${setPtsFactor.toFixed(6)}*(PTS-STARTPTS)`,
      `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}`,
    ];

    if (needsPad) {
      chain.push(
        `scale=${baseW}:${baseH}:force_original_aspect_ratio=decrease`,
        `pad=${baseW}:${baseH}:(ow-iw)/2:(oh-ih)/2:black`,
      );
    }

    timelineParts.push(`${chain.join(',')}[${label}]`);
    concatLabels.push(`[${label}]`);
    cursor = start + slice.duration;
  }

  const targetDuration = Math.max(
    cursor,
    outputDuration ?? getTotalDuration(slices),
    sortedSlices.length ? sortedSlices[sortedSlices.length - 1]?.end ?? 0 : 0,
  );
  pushGap(targetDuration - cursor);

  if (!concatLabels.length) {
    pushGap(Math.max(0.1, targetDuration));
  }

  timelineParts.push(`${concatLabels.join('')}concat=n=${concatLabels.length}:v=1:a=0[timeline_v]`);

  const graphParts = [...timelineParts];
  const fps = exportSettings.format === 'gif' ? Math.max(1, Math.round(exportSettings.gifFps)) : Math.max(1, Math.round(exportSettings.mp4Fps));
  graphParts.push(`[timeline_v]fps=${fps},scale=${outputWidth}:${outputHeight}:flags=lanczos[formatted_v]`);

  let composedLabel = 'formatted_v';
  const safeOverlays = overlayInputs.filter((overlay) => overlay.end > overlay.start + 0.0001);

  for (let index = 0; index < safeOverlays.length; index += 1) {
    const overlay = safeOverlays[index];
    const inputLabel = `${index + 1}:v`;
    const outputLabel = `overlay_${index}`;
    const enable = `between(t,${formatFloat(overlay.start)},${formatFloat(overlay.end)})`;
    graphParts.push(`[${composedLabel}][${inputLabel}]overlay=0:0:enable='${enable}'[${outputLabel}]`);
    composedLabel = outputLabel;
  }

  if (exportSettings.format === 'gif') {
    const palettegen = exportSettings.paletteMode === 'single' ? 'palettegen=stats_mode=single' : 'palettegen';
    const paletteuse =
      exportSettings.paletteMode === 'single'
        ? `paletteuse=new=1:dither=${exportSettings.dither}`
        : `paletteuse=dither=${exportSettings.dither}`;

    graphParts.push(
      `[${composedLabel}]split[gif_a][gif_b]`,
      `[gif_a]${palettegen}[gif_p]`,
      `[gif_b][gif_p]${paletteuse}[out_v]`,
    );
  } else {
    if (composedLabel !== 'out_v') {
      graphParts.push(`[${composedLabel}]null[out_v]`);
    }
  }

  const filterComplex = graphParts.join('; ');
  const execArgs: string[] = ['-i', inputFileName];

  for (const overlay of safeOverlays) {
    execArgs.push('-loop', '1', '-i', overlay.fileName);
  }

  execArgs.push('-filter_complex', filterComplex, '-map', '[out_v]', '-an');

  if (exportSettings.format === 'gif') {
    execArgs.push('-r', String(Math.max(1, Math.round(exportSettings.gifFps))), '-loop', '0', outputFileName);
  } else {
    execArgs.push(
      '-r',
      String(Math.max(1, Math.round(exportSettings.mp4Fps))),
      '-preset',
      exportSettings.mp4Preset,
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      outputFileName,
    );
  }

  const command = ['ffmpeg', ...execArgs.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg))].join(' ');

  return {
    filterComplex,
    command,
    execArgs,
    inputFileName,
    outputFileName,
  };
}
