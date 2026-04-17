import { Clapperboard, Film, Gauge, Layers3, Sparkles } from 'lucide-react';

import type { CropRect, ExportSettings, SliceModel } from '../types/editor';

interface PropertyPanelProps {
  selectedSlice: SliceModel | null;
  baseCrop: CropRect;
  exportSettings: ExportSettings;
  ffmpegStatus: 'idle' | 'loading' | 'ready' | 'error';
  ffmpegError: string | null;
  isExporting: boolean;
  exportError: string | null;
  onChangeExportSettings: (next: Partial<ExportSettings>) => void;
  onSelectGlobalCrop: () => void;
  onLoadFfmpeg: () => void;
  onLogCommandPreview: () => void;
  onExport: () => void;
}

const INPUT_SIZE_MIN = 64;
const INPUT_SIZE_MAX = 4096;

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function computeHeightFromWidth(width: number, crop: CropRect): number {
  return clampInt((width * crop.h) / Math.max(1, crop.w), INPUT_SIZE_MIN, INPUT_SIZE_MAX);
}

function computeWidthFromHeight(height: number, crop: CropRect): number {
  return clampInt((height * crop.w) / Math.max(1, crop.h), INPUT_SIZE_MIN, INPUT_SIZE_MAX);
}

export default function PropertyPanel({
  selectedSlice,
  baseCrop,
  exportSettings,
  ffmpegStatus,
  ffmpegError,
  isExporting,
  exportError,
  onChangeExportSettings,
  onSelectGlobalCrop,
  onLoadFfmpeg,
  onLogCommandPreview,
  onExport,
}: PropertyPanelProps) {
  const aspectLabel = `${baseCrop.w}:${baseCrop.h}`;

  return (
    <aside className="w-full rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 shadow-xl lg:w-[360px]">
      <h2 className="font-['Space_Grotesk',sans-serif] text-lg font-semibold text-slate-100">Property Panel</h2>
      <p className="mt-1 text-xs text-slate-400">
        {selectedSlice ? '選択中スライスに個別クロップを適用中' : '全体クロップを適用中'}
      </p>

      {selectedSlice ? (
        <button
          type="button"
          onClick={onSelectGlobalCrop}
          className="mt-3 inline-flex items-center gap-1 rounded-md border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/20"
        >
          <Clapperboard size={13} />
          全体クロップ編集モードへ
        </button>
      ) : null}

      <div className="mt-4 space-y-3">
        <label className="block text-xs text-slate-300">
          <span className="mb-1 inline-flex items-center gap-1 text-slate-400">
            <Film size={13} />
            Format
          </span>
          <select
            value={exportSettings.format}
            onChange={(event) => onChangeExportSettings({ format: event.target.value as ExportSettings['format'] })}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
          >
            <option value="gif">GIF</option>
            <option value="mp4">MP4</option>
          </select>
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
                if (exportSettings.keepAspectRatio) {
                  onChangeExportSettings({
                    width: safeWidth,
                    height: computeHeightFromWidth(safeWidth, baseCrop),
                  });
                  return;
                }

                onChangeExportSettings({ width: safeWidth });
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
                if (exportSettings.keepAspectRatio) {
                  onChangeExportSettings({
                    width: computeWidthFromHeight(safeHeight, baseCrop),
                    height: safeHeight,
                  });
                  return;
                }

                onChangeExportSettings({ height: safeHeight });
              }}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
            />
          </div>
          <label className="mt-2 flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={exportSettings.keepAspectRatio}
              onChange={(event) => {
                if (event.target.checked) {
                  onChangeExportSettings({
                    keepAspectRatio: true,
                    height: computeHeightFromWidth(exportSettings.width, baseCrop),
                  });
                } else {
                  onChangeExportSettings({ keepAspectRatio: false });
                }
              }}
              className="h-4 w-4 accent-cyan-400"
            />
            アスペクト比を保持
          </label>
          <span className="mt-1 block font-mono text-[11px] text-slate-500">Base aspect: {aspectLabel}</span>
        </div>

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
                <Sparkles size={13} />
                Palette Mode (GIF)
              </span>
              <select
                value={exportSettings.paletteMode}
                onChange={(event) =>
                  onChangeExportSettings({ paletteMode: event.target.value as ExportSettings['paletteMode'] })
                }
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
              >
                <option value="global">Global Palette</option>
                <option value="single">Per-frame Palette (stats_mode=single)</option>
              </select>
            </label>

            <label className="block text-xs text-slate-300">
              <span className="mb-1 inline-flex items-center gap-1 text-slate-400">Dither (GIF)</span>
              <select
                value={exportSettings.dither}
                onChange={(event) => onChangeExportSettings({ dither: event.target.value as ExportSettings['dither'] })}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
              >
                <option value="none">none</option>
                <option value="bayer">bayer</option>
                <option value="floyd_steinberg">floyd_steinberg</option>
                <option value="sierra2">sierra2</option>
              </select>
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
              <select
                value={exportSettings.mp4Preset}
                onChange={(event) => onChangeExportSettings({ mp4Preset: event.target.value as ExportSettings['mp4Preset'] })}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
              >
                <option value="ultrafast">ultrafast</option>
                <option value="superfast">superfast</option>
                <option value="veryfast">veryfast</option>
                <option value="faster">faster</option>
                <option value="fast">fast</option>
                <option value="medium">medium</option>
                <option value="slow">slow</option>
                <option value="slower">slower</option>
                <option value="veryslow">veryslow</option>
              </select>
            </label>
          </>
        )}

        <details className="rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
          <summary className="cursor-pointer list-none select-none font-medium text-slate-200">
            速度倍率オーバーレイ
          </summary>
          <div className="mt-3 space-y-2">
            <label className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={exportSettings.speedOverlay}
                onChange={(event) => onChangeExportSettings({ speedOverlay: event.target.checked })}
                className="h-4 w-4 accent-cyan-400"
              />
              右下に倍率を重ねる
            </label>
            <p className="px-1 text-[11px] leading-relaxed text-slate-500">
              Google Fonts の Space Grotesk を使って、速度が変わったシーンだけに倍率を表示します。
            </p>
          </div>
        </details>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={onLoadFfmpeg}
          disabled={ffmpegStatus === 'loading'}
          className="rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-wait disabled:opacity-70"
        >
          {ffmpegStatus === 'loading' ? 'FFmpeg CDN読込中...' : 'FFmpeg (CDN) を準備'}
        </button>

        <button
          type="button"
          onClick={onLogCommandPreview}
          className="rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/20"
        >
          コマンドを console.log
        </button>

        <button
          type="button"
          onClick={onExport}
          disabled={isExporting}
          className="rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/20 disabled:cursor-wait disabled:opacity-70"
        >
          {isExporting ? 'エクスポート中...' : `${exportSettings.format.toUpperCase()} をエクスポート`}
        </button>
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

      <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
        フィルタとコマンドの詳細は DevTools の console に出します。
      </p>
    </aside>
  );
}
