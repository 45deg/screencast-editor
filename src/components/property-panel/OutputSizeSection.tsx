import { Layers3, ZoomIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { CropRect, ExportSettings } from '../../types/editor';
import {
  clampFloat,
  clampInt,
  computeHeightFromWidth,
  computeWidthFromHeight,
  INPUT_SIZE_MAX,
  INPUT_SIZE_MIN,
} from './settings';

interface OutputSizeSectionProps {
  baseCrop: CropRect;
  exportSettings: ExportSettings;
  onChangeExportSettings: (next: Partial<ExportSettings>) => void;
}

export default function OutputSizeSection({
  baseCrop,
  exportSettings,
  onChangeExportSettings,
}: OutputSizeSectionProps) {
  const { t } = useTranslation();
  const scaleMin = Math.max(0.1, INPUT_SIZE_MIN / Math.max(1, baseCrop.w));
  const scaleMax = Math.min(1.5, INPUT_SIZE_MAX / Math.max(1, baseCrop.w));
  const outputScale = clampFloat(exportSettings.width / Math.max(1, baseCrop.w), scaleMin, scaleMax);

  return (
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
  );
}
