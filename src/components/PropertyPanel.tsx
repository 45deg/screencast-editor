import { type ReactNode } from 'react';
import { Accordion } from '@base-ui/react/accordion';
import { Button } from '@base-ui/react/button';
import { Select } from '@base-ui/react/select';
import { Check, ChevronDown, Film, Gauge, Layers3, ZoomIn } from 'lucide-react';

import type { CropRect, ExportSettings } from '../types/editor';

interface PropertyPanelProps {
  baseCrop: CropRect;
  exportSettings: ExportSettings;
  ffmpegStatus: 'idle' | 'loading' | 'ready' | 'error';
  ffmpegError: string | null;
  isExporting: boolean;
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

const GIF_PALETTE_OPTIONS: Array<{ value: ExportSettings['paletteMode']; label: string }> = [
  { value: 'global', label: 'Global Palette' },
  { value: 'single', label: 'Per-frame Palette' },
];

const GIF_DITHER_OPTIONS: Array<{ value: ExportSettings['dither']; label: string }> = [
  { value: 'none', label: 'none' },
  { value: 'bayer', label: 'bayer' },
  { value: 'floyd_steinberg', label: 'floyd_steinberg' },
  { value: 'sierra2', label: 'sierra2' },
];

const MP4_PRESET_OPTIONS: Array<{ value: ExportSettings['mp4Preset']; label: string }> = [
  { value: 'ultrafast', label: 'ultrafast' },
  { value: 'superfast', label: 'superfast' },
  { value: 'veryfast', label: 'veryfast' },
  { value: 'faster', label: 'faster' },
  { value: 'fast', label: 'fast' },
  { value: 'medium', label: 'medium' },
  { value: 'slow', label: 'slow' },
  { value: 'slower', label: 'slower' },
  { value: 'veryslow', label: 'veryslow' },
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

interface PropertySectionProps {
  value: string;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

function PropertySection({ value, title, icon, children }: PropertySectionProps) {
  return (
    <Accordion.Item value={value} className="overflow-hidden rounded-lg border border-slate-800/90 bg-slate-950/70">
      <Accordion.Header className="m-0">
        <Accordion.Trigger className="group flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-100 transition hover:bg-slate-900">
          <span className="inline-flex items-center gap-1.5 text-slate-200">
            {icon}
            {title}
          </span>
          <ChevronDown size={14} className="text-slate-500 transition-transform duration-200 group-data-[panel-open]:rotate-180" />
        </Accordion.Trigger>
      </Accordion.Header>

      <Accordion.Panel className="border-t border-slate-800/80 px-3 py-3">
        <div className="space-y-3">{children}</div>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectFieldProps<T extends string> {
  value: T;
  options: Array<SelectOption<T>>;
  onChange: (value: T) => void;
}

function SelectField<T extends string>({ value, options, onChange }: SelectFieldProps<T>) {
  return (
    <Select.Root
      value={value}
      onValueChange={(next) => {
        if (next !== null) {
          onChange(next as T);
        }
      }}
    >
      <Select.Trigger className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-left text-sm text-slate-100 outline-none transition focus:border-cyan-500">
        <Select.Value />
        <Select.Icon className="text-slate-500">
          <ChevronDown size={14} />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner sideOffset={6} className="z-50">
          <Select.Popup className="z-50 max-h-64 overflow-y-auto rounded-md border border-slate-700 bg-slate-950 p-1 shadow-2xl">
            <Select.List className="space-y-0.5">
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded px-2.5 py-1.5 text-sm text-slate-100 outline-none transition hover:bg-slate-800 data-[highlighted]:bg-slate-800"
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check size={13} className="text-cyan-300" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

export default function PropertyPanel({
  baseCrop,
  exportSettings,
  ffmpegStatus,
  ffmpegError,
  isExporting,
  exportError,
  className,
  onChangeExportSettings,
  onExport,
}: PropertyPanelProps) {
  const scaleMin = Math.max(0.1, INPUT_SIZE_MIN / Math.max(1, baseCrop.w));
  const scaleMax = Math.min(4, INPUT_SIZE_MAX / Math.max(1, baseCrop.w));
  const outputScale = clampFloat(exportSettings.width / Math.max(1, baseCrop.w), scaleMin, scaleMax);
  const outputScalePercent = Math.round(outputScale * 100);

  return (
    <aside
      className={`w-full rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 shadow-xl lg:w-[360px] ${className ?? ''}`}
    >
      <h2 className="sr-only">Property Panel</h2>

      <Accordion.Root multiple defaultValue={['basic', 'format']} className="space-y-2">
        <PropertySection value="basic" title="基本設定" icon={<Layers3 size={13} />}>
          <label className="block text-xs text-slate-300">
            <span className="mb-1 inline-flex items-center gap-1 text-slate-400">
              <Film size={13} />
              Format
            </span>
            <SelectField
              value={exportSettings.format}
              options={FORMAT_OPTIONS}
              onChange={(format) => onChangeExportSettings({ format })}
            />
          </label>

          <div className="block text-xs text-slate-300">
            <span className="mb-1 inline-flex items-center gap-1 text-slate-400">
              <Layers3 size={13} />
              Output Size (px)
            </span>
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

            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <ZoomIn size={12} />
                  倍率
                </span>
                <span className="font-mono text-slate-200">{outputScale.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={scaleMin}
                max={scaleMax}
                step={0.05}
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
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                <span>{Math.round(scaleMin * 100)}%</span>
                <span>{outputScalePercent}%</span>
                <span>{Math.round(scaleMax * 100)}%</span>
              </div>
            </div>
          </div>
        </PropertySection>

        <PropertySection
          value="format"
          title={exportSettings.format === 'gif' ? 'GIF 詳細' : 'MP4 詳細'}
          icon={<Gauge size={13} />}
        >
          {exportSettings.format === 'gif' ? (
            <>
              <label className="block text-xs text-slate-300">
                <span className="mb-1 inline-flex items-center gap-1 text-slate-400">
                  <Gauge size={13} />
                  FPS (GIF)
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

              <label className="block text-xs text-slate-300">
                <span className="mb-1 inline-flex items-center gap-1 text-slate-400">
                  <Gauge size={13} />
                  Palette Mode (GIF)
                </span>
                <SelectField
                  value={exportSettings.paletteMode}
                  options={GIF_PALETTE_OPTIONS}
                  onChange={(paletteMode) => onChangeExportSettings({ paletteMode })}
                />
              </label>

              <label className="block text-xs text-slate-300">
                <span className="mb-1 inline-flex items-center gap-1 text-slate-400">Dither (GIF)</span>
                <SelectField
                  value={exportSettings.dither}
                  options={GIF_DITHER_OPTIONS}
                  onChange={(dither) => onChangeExportSettings({ dither })}
                />
              </label>
            </>
          ) : (
            <>
              <label className="block text-xs text-slate-300">
                <span className="mb-1 inline-flex items-center gap-1 text-slate-400">
                  <Gauge size={13} />
                  FPS (MP4)
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

              <label className="block text-xs text-slate-300">
                <span className="mb-1 inline-flex items-center gap-1 text-slate-400">Preset (MP4)</span>
                <SelectField
                  value={exportSettings.mp4Preset}
                  options={MP4_PRESET_OPTIONS}
                  onChange={(mp4Preset) => onChangeExportSettings({ mp4Preset })}
                />
              </label>
            </>
          )}
        </PropertySection>
      </Accordion.Root>

      <div className="mt-4">
        <Button
          type="button"
          onClick={onExport}
          disabled={isExporting}
          className="rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/20 disabled:cursor-wait disabled:opacity-70"
        >
          {isExporting ? 'エクスポート中...' : `${exportSettings.format.toUpperCase()} をエクスポート`}
        </Button>
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        FFmpeg status: <span className="font-mono text-slate-300">{ffmpegStatus}</span>
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
