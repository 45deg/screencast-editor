import type { CropRect, ExportSettings } from '../../types/editor';

export const INPUT_SIZE_MIN = 64;
export const INPUT_SIZE_MAX = 4096;

export const FORMAT_OPTIONS: Array<{ value: ExportSettings['format']; label: string }> = [
  { value: 'mp4', label: 'MP4' },
];

export type Mp4PresetKey = 'size' | 'balance' | 'high_quality';

export const MP4_PROFILE_OPTIONS: Array<{
  value: Mp4PresetKey;
  settings: Pick<ExportSettings, 'mp4Preset'>;
}> = [
  {
    value: 'size',
    settings: {
      mp4Preset: 'veryfast',
    },
  },
  {
    value: 'balance',
    settings: {
      mp4Preset: 'medium',
    },
  },
  {
    value: 'high_quality',
    settings: {
      mp4Preset: 'slow',
    },
  },
];

export function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function clampFloat(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeHeightFromWidth(width: number, crop: CropRect): number {
  return clampInt((width * crop.h) / Math.max(1, crop.w), INPUT_SIZE_MIN, INPUT_SIZE_MAX);
}

export function computeWidthFromHeight(height: number, crop: CropRect): number {
  return clampInt((height * crop.w) / Math.max(1, crop.h), INPUT_SIZE_MIN, INPUT_SIZE_MAX);
}

export function getMatchingMp4Preset(exportSettings: ExportSettings): Mp4PresetKey | null {
  const matched = MP4_PROFILE_OPTIONS.find((preset) => preset.settings.mp4Preset === exportSettings.mp4Preset);
  return matched?.value ?? null;
}
