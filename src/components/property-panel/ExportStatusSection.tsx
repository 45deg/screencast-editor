import { Button } from '@base-ui/react/button';
import { Progress } from '@base-ui/react/progress';
import { useTranslation } from 'react-i18next';

import type { ExportSettings } from '../../types/editor';

interface ExportStatusSectionProps {
  exportSettings: ExportSettings;
  ffmpegStatus: 'idle' | 'loading' | 'ready' | 'error';
  ffmpegError: string | null;
  isExporting: boolean;
  exportProgress: number | null;
  exportProgressLabel: string | null;
  exportError: string | null;
  onExport: () => void;
}

export default function ExportStatusSection({
  exportSettings,
  ffmpegStatus,
  ffmpegError,
  isExporting,
  exportProgress,
  exportProgressLabel,
  exportError,
  onExport,
}: ExportStatusSectionProps) {
  const { t } = useTranslation();

  return (
    <>
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
    </>
  );
}
