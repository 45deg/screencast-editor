import {
  deriveSlices,
  type CropRect,
  type ExportSettings,
  type SliceModel,
  type VideoMeta,
} from '../types/editor';

export interface BuildFfmpegCommandInput {
  video: VideoMeta;
  slices: SliceModel[];
  globalCrop: CropRect | null;
  exportSettings: ExportSettings;
  inputFileName?: string;
  outputFileName?: string;
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

export function buildFfmpegCommand(input: BuildFfmpegCommandInput): BuildFfmpegCommandResult {
  const {
    video,
    slices,
    globalCrop,
    exportSettings,
    inputFileName = video.file.name,
    outputFileName = exportSettings.format === 'gif' ? 'output.gif' : 'output.mp4',
  } = input;

  const baseCrop = getBaseCrop(video, globalCrop);
  const baseW = Math.max(1, Math.round(baseCrop.w));
  const baseH = Math.max(1, Math.round(baseCrop.h));

  const derived = deriveSlices(slices);
  const segmentFilters: string[] = [];

  derived.forEach((slice, index) => {
    const crop = clampCrop(slice.crop ?? baseCrop, video);
    const setPtsFactor = 1 / Math.max(0.0001, slice.speed);
    const needsPad = crop.w !== baseW || crop.h !== baseH;
    const chain: string[] = [
      `[0:v]trim=start=${slice.sourceStart.toFixed(3)}:end=${slice.sourceEnd.toFixed(3)}`,
      `setpts=${setPtsFactor.toFixed(6)}*(PTS-STARTPTS)`,
      `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}`,
    ];

    if (needsPad) {
      chain.push(
        `scale=${baseW}:${baseH}:force_original_aspect_ratio=decrease`,
        `pad=${baseW}:${baseH}:(ow-iw)/2:(oh-ih)/2:black`,
      );
    }

    segmentFilters.push(`${chain.join(',')}[seg_${index}]`);
  });

  const concatInputs = derived.map((_, index) => `[seg_${index}]`).join('');
  const graphParts = [
    ...segmentFilters,
    `${concatInputs}concat=n=${derived.length}:v=1:a=0[concat_v]`,
  ];

  const outputWidth = Math.max(16, Math.round(exportSettings.width));
  const outputHeight = Math.max(16, Math.round(exportSettings.height));

  if (exportSettings.format === 'gif') {
    const palettegen = exportSettings.paletteMode === 'single' ? 'palettegen=stats_mode=single' : 'palettegen';
    graphParts.push(
      `[concat_v]fps=${Math.max(1, Math.round(exportSettings.gifFps))},scale=${outputWidth}:${outputHeight}:flags=lanczos,split[gif_a][gif_b]`,
      `[gif_a]${palettegen}[gif_p]`,
      `[gif_b][gif_p]paletteuse=dither=${exportSettings.dither}[out_v]`,
    );
  } else {
    graphParts.push(`[concat_v]scale=${outputWidth}:${outputHeight}:flags=lanczos[out_v]`);
  }

  const filterComplex = graphParts.join('; ');
  const execArgs: string[] = [
    '-i',
    inputFileName,
    '-filter_complex',
    filterComplex,
    '-map',
    '[out_v]',
    '-an',
  ];

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
