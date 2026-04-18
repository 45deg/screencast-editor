import { Button } from '@base-ui/react/button';
import { Progress } from '@base-ui/react/progress';
import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import { Film, Gauge, Layers3, Sparkles, ZoomIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { CropRect, ExportSettings } from '../types/editor';

interface PropertyPanelProps {
  baseCrop: CropRect;
  exportSettings: ExportSettings;
  ffmpegStatus: 'idle' | 'loading' | 'ready' | 'error';
  ffmpegError: string | null;
  isExporting: boolean;
  exportProgress: number | null;
  exportProgressLabel: string | null;
  exportError: string | null;
  className?: string;
  onChangeExportSettings: (next: Partial<ExportSettings>) => void;
  onExport: () => void;
}

const INPUT_SIZE_MIN = 64;
const INPUT_SIZE_MAX = 4096;

const FORMAT_OPTIONS: Array<{ value: ExportSettings['format']; label: string }> = [
  { value: 'gif', label: 'GIF' },
  { value: 'mp4', label: 'MP4' },
];

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampFloat(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeHeightFromWidth(width: number, crop: CropRect): number {
  return clampInt((width * crop.h) / Math.max(1, crop.w), INPUT_SIZE_MIN, INPUT_SIZE_MAX);
}

function computeWidthFromHeight(height: number, crop: CropRect): number {
  return clampInt((height * crop.w) / Math.max(1, crop.h), INPUT_SIZE_MIN, INPUT_SIZE_MAX);
}

type GifPresetKey = 'size' | 'balance' | 'high_quality';
type Mp4PresetKey = 'size' | 'balance' | 'high_quality';

const GIF_PRESET_OPTIONS: Array<{
  value: GifPresetKey;
  settings: Pick<ExportSettings, 'gifFps' | 'paletteMode' | 'dither'>;
}> = [
  {
    value: 'size',
    settings: {
      gifFps: 10,
      paletteMode: 'global',
      dither: 'none',
    },
  },
  {
    value: 'balance',
    settings: {
      gifFps: 10,
      paletteMode: 'global',
      dither: 'floyd_steinberg',
    },
  },
  {
    value: 'high_quality',
    settings: {
      gifFps: 10,
      paletteMode: 'single',
      dither: 'sierra2_4a',
    },
  },
];

function getMatchingGifPreset(exportSettings: ExportSettings): GifPresetKey | null {
  const matched = GIF_PRESET_OPTIONS.find(
    (preset) =>
      preset.settings.gifFps === exportSettings.gifFps &&
      preset.settings.paletteMode === exportSettings.paletteMode &&
      preset.settings.dither === exportSettings.dither,
  );

  return matched?.value ?? null;
}

const MP4_PROFILE_OPTIONS: Array<{
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

function getMatchingMp4Preset(exportSettings: ExportSettings): Mp4PresetKey | null {
  const matched = MP4_PROFILE_OPTIONS.find((preset) => preset.settings.mp4Preset === exportSettings.mp4Preset);
  return matched?.value ?? null;
}

function ToggleCardGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | null;
  options: Array<{ value: T; label: string; description?: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <ToggleGroup
      value={value ? [value] : []}
      onValueChange={(next) => {
        const selected = next[0];
        if (selected) {
          onChange(selected as T);
        }
      }}
      aria-label="toggle group"
      className="flex flex-wrap gap-1.5"
    >
      {options.map((option) => (
        <Toggle
          key={option.value}
          value={option.value}
          className="inline-flex min-h-8 items-center justify-center rounded-md border border-slate-800 bg-slate-900/70 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-700 hover:bg-slate-900 data-[pressed]:border-cyan-400/50 data-[pressed]:bg-cyan-500/10 data-[pressed]:text-cyan-50"
        >
          <span>{option.label}</span>
        </Toggle>
      ))}
    </ToggleGroup>
  );
}

export default function PropertyPanel({
  baseCrop,
  exportSettings,
  ffmpegStatus,
  ffmpegError,
  isExporting,
  exportProgress,
  exportProgressLabel,
  exportError,
  className,
  onChangeExportSettings,
  onExport,
}: PropertyPanelProps) {
  const { t } = useTranslation();
  const gifPresetOptions: Array<{ value: GifPresetKey; label: string }> = [
    { value: 'size', label: t('propertyPanel.lightweight') },
    { value: 'balance', label: t('propertyPanel.balance') },
    { value: 'high_quality', label: t('propertyPanel.highQuality') },
  ];
  const mp4PresetOptions: Array<{ value: Mp4PresetKey; label: string }> = [
    { value: 'size', label: t('propertyPanel.lightweight') },
    { value: 'balance', label: t('propertyPanel.balance') },
    { value: 'high_quality', label: t('propertyPanel.highQuality') },
  ];
  const scaleMin = Math.max(0.1, INPUT_SIZE_MIN / Math.max(1, baseCrop.w));
  const scaleMax = Math.min(1.5, INPUT_SIZE_MAX / Math.max(1, baseCrop.w));
  const outputScale = clampFloat(exportSettings.width / Math.max(1, baseCrop.w), scaleMin, scaleMax);
  const activeGifPreset = exportSettings.format === 'gif' ? getMatchingGifPreset(exportSettings) : null;
  const activeMp4Preset = exportSettings.format === 'mp4' ? getMatchingMp4Preset(exportSettings) : null;

  return (
    <aside
      className={`w-full rounded-xl border border-slate-800/80 bg-slate-950/70 p-4 shadow-xl lg:w-[360px] ${className ?? ''}`}
    >
      <h2 className="sr-only">{t('propertyPanel.title')}</h2>

      <div className="space-y-4">
        <section className="rounded-lg border border-slate-800/90 bg-slate-950/70 p-3">
          <div className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <Film size={13} />
            {t('propertyPanel.format')}
          </div>
          <ToggleCardGroup
            value={exportSettings.format}
            options={FORMAT_OPTIONS}
            onChange={(format) => onChangeExportSettings({ format })}
          />
        </section>

        <section className="rounded-lg border border-slate-800/90 bg-slate-950/70 p-3">
          <div className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <Layers3 size={13} />
            {t('propertyPanel.outputSize')}
          </div>
          <div className="block text-xs text-slate-300">
            <span className="mb-1 inline-flex items-center gap-1 text-slate-400">{t('propertyPanel.outputSizePx')}</span>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <input
                type="number"
                min={INPUT_SIZE_MIN}
                max={INPUT_SIZE_MAX}
                value={exportSettings.width}
                onChange={(event) => {
                  const width = Number.parseInt(event.target.value, 10);
                  if (!Number.isFinite(width)) {
                    return;
                  }

                  const safeWidth = clampInt(width, INPUT_SIZE_MIN, INPUT_SIZE_MAX);
                  onChangeExportSettings({
                    width: safeWidth,
                    height: computeHeightFromWidth(safeWidth, baseCrop),
                    keepAspectRatio: true,
                  });
                }}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
              />
              <span className="text-center font-mono text-xs text-slate-500">x</span>
              <input
                type="number"
                min={INPUT_SIZE_MIN}
                max={INPUT_SIZE_MAX}
                value={exportSettings.height}
                onChange={(event) => {
                  const height = Number.parseInt(event.target.value, 10);
                  if (!Number.isFinite(height)) {
                    return;
                  }

                  const safeHeight = clampInt(height, INPUT_SIZE_MIN, INPUT_SIZE_MAX);
                  onChangeExportSettings({
                    width: computeWidthFromHeight(safeHeight, baseCrop),
                    height: safeHeight,
                    keepAspectRatio: true,
                  });
                }}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
              />
            </div>

            <div className="mt-3 rounded-md border border-slate-800 bg-slate-900/80 px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <ZoomIn size={12} />
                  {t('propertyPanel.scale')}
                </span>
                <span className="font-mono text-slate-200">{outputScale.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={scaleMin}
                max={scaleMax}
                step={0.01}
                value={outputScale}
                onChange={(event) => {
                  const nextScale = clampFloat(Number.parseFloat(event.target.value), scaleMin, scaleMax);
                  const nextWidth = clampInt(baseCrop.w * nextScale, INPUT_SIZE_MIN, INPUT_SIZE_MAX);
                  onChangeExportSettings({
                    width: nextWidth,
                    height: computeHeightFromWidth(nextWidth, baseCrop),
                    keepAspectRatio: true,
                  });
                }}
                className="h-2 w-full cursor-pointer accent-cyan-400"
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-800/90 bg-slate-950/70 p-3">
          <div className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            {exportSettings.format === 'gif' ? <Sparkles size={13} /> : <Gauge size={13} />}
            {exportSettings.format === 'gif' ? t('propertyPanel.gifPreset') : t('propertyPanel.mp4Details')}
          </div>

          {exportSettings.format === 'gif' ? (
            <div className="space-y-3">
              <ToggleCardGroup
                value={activeGifPreset}
                options={gifPresetOptions}
                onChange={(presetKey) => {
                  const preset = GIF_PRESET_OPTIONS.find((option) => option.value === presetKey);
                  if (preset) {
                    onChangeExportSettings(preset.settings);
                  }
                }}
              />

              <div className="grid gap-3">
                <label className="block text-xs text-slate-300">
                  <span className="mb-1 inline-flex items-center gap-1 text-slate-400">
                    <Gauge size={13} />
                    FPS
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={exportSettings.gifFps}
                    onChange={(event) => {
                      const fps = Number.parseInt(event.target.value, 10);
                      if (Number.isFinite(fps)) {
                        onChangeExportSettings({ gifFps: clampInt(fps, 1, 60) });
                      }
                    }}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <ToggleCardGroup
                value={activeMp4Preset}
                options={mp4PresetOptions}
                onChange={(presetKey) => {
                  const preset = MP4_PROFILE_OPTIONS.find((option) => option.value === presetKey);
                  if (preset) {
                    onChangeExportSettings(preset.settings);
                  }
                }}
              />

              <label className="block text-xs text-slate-300">
                <span className="mb-1 inline-flex items-center gap-1 text-slate-400">
                  <Gauge size={13} />
                  {t('propertyPanel.fpsMp4')}
                </span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={exportSettings.mp4Fps}
                  onChange={(event) => {
                    const fps = Number.parseInt(event.target.value, 10);
                    if (Number.isFinite(fps)) {
                      onChangeExportSettings({ mp4Fps: clampInt(fps, 1, 120) });
                    }
                  }}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                />
              </label>
            </div>
          )}
        </section>
      </div>

      <div className="mt-4">
        <Button
          type="button"
          onClick={onExport}
          disabled={isExporting}
          className="w-full rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/20 disabled:cursor-wait disabled:opacity-70"
        >
          {isExporting
            ? t('propertyPanel.exporting')
            : t('propertyPanel.exportFormat', { format: exportSettings.format.toUpperCase() })}
        </Button>

        {isExporting && exportProgress !== null ? (
          <div className="mt-2 rounded-md border border-cyan-300/20 bg-cyan-400/5 px-2.5 py-2">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-300">
              <span>{exportProgressLabel ?? t('propertyPanel.exportProgress')}</span>
              <span className="font-mono text-cyan-100">{Math.round(exportProgress)}%</span>
            </div>
            <Progress.Root
              aria-label={t('propertyPanel.exportProgress')}
              value={exportProgress}
              className="w-full"
            >
              <Progress.Track className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <Progress.Indicator
                  className="h-full rounded-full bg-cyan-400 transition-[width] duration-200"
                  style={{ width: `${Math.max(0, Math.min(100, exportProgress))}%` }}
                />
              </Progress.Track>
            </Progress.Root>
          </div>
        ) : null}
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        {t('propertyPanel.ffmpegStatus')}: <span className="font-mono text-slate-300">{ffmpegStatus}</span>
      </p>

      {ffmpegError ? (
        <p className="mt-2 rounded-md border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">{ffmpegError}</p>
      ) : null}
      {exportError ? (
        <p className="mt-2 rounded-md border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">{exportError}</p>
      ) : null}
    </aside>
  );
}
