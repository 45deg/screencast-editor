import { Film, Gauge, Layers3, Sparkles } from 'lucide-react';

import type { CropRect, ExportSettings, SliceModel } from '../types/editor';

interface PropertyPanelProps {
  selectedSlice: SliceModel | null;
  baseCrop: CropRect;
  exportSettings: ExportSettings;
  ffmpegStatus: 'idle' | 'loading' | 'ready' | 'error';
  ffmpegError: string | null;
  commandPreview: string;
  onChangeExportSettings: (next: Partial<ExportSettings>) => void;
  onLoadFfmpeg: () => void;
  onGenerateCommandPreview: () => void;
}

export default function PropertyPanel({
  selectedSlice,
  baseCrop,
  exportSettings,
  ffmpegStatus,
  ffmpegError,
  commandPreview,
  onChangeExportSettings,
  onLoadFfmpeg,
  onGenerateCommandPreview,
}: PropertyPanelProps) {
  const computedHeight = Math.max(1, Math.round((exportSettings.width * baseCrop.h) / Math.max(1, baseCrop.w)));

  return (
    <aside className="w-full rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 shadow-xl lg:w-[360px]">
      <h2 className="font-['Space_Grotesk',sans-serif] text-lg font-semibold text-slate-100">Property Panel</h2>
      <p className="mt-1 text-xs text-slate-400">
        {selectedSlice ? '選択中スライスに個別クロップを適用中' : '全体クロップを適用中'}
      </p>

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

        <label className="block text-xs text-slate-300">
          <span className="mb-1 inline-flex items-center gap-1 text-slate-400">
            <Layers3 size={13} />
            Output Width (px)
          </span>
          <input
            type="number"
            min={64}
            max={4096}
            value={exportSettings.width}
            onChange={(event) => {
              const width = Number.parseInt(event.target.value, 10);
              if (Number.isFinite(width)) {
                onChangeExportSettings({ width: Math.max(64, width) });
              }
            }}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
          />
          <span className="mt-1 block font-mono text-[11px] text-slate-500">Height(auto): {computedHeight}px</span>
        </label>

        <label className="block text-xs text-slate-300">
          <span className="mb-1 inline-flex items-center gap-1 text-slate-400">
            <Gauge size={13} />
            FPS (GIF)
          </span>
          <input
            type="number"
            min={1}
            max={60}
            value={exportSettings.fps}
            onChange={(event) => {
              const fps = Number.parseInt(event.target.value, 10);
              if (Number.isFinite(fps)) {
                onChangeExportSettings({ fps: Math.max(1, Math.min(60, fps)) });
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

        <label className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={exportSettings.speedOverlay}
            onChange={(event) => onChangeExportSettings({ speedOverlay: event.target.checked })}
            className="h-4 w-4 accent-cyan-400"
          />
          速度倍率オーバーレイを追加
        </label>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
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
          onClick={onGenerateCommandPreview}
          className="rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/20"
        >
          コマンドプレビュー生成
        </button>
      </div>

      {ffmpegError ? (
        <p className="mt-3 rounded-md border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">{ffmpegError}</p>
      ) : null}

      <div className="mt-4">
        <p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">FFmpeg filter/command preview</p>
        <textarea
          value={commandPreview}
          readOnly
          className="h-48 w-full resize-none rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-cyan-100"
          placeholder="ここに生成コマンドが表示されます"
        />
      </div>
    </aside>
  );
}
