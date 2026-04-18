import { useTranslation } from 'react-i18next';

import type { CropRect, ExportSettings } from '../types/editor';
import ExportDetailsSection from './property-panel/ExportDetailsSection';
import ExportStatusSection from './property-panel/ExportStatusSection';
import FormatSection from './property-panel/FormatSection';
import OutputSizeSection from './property-panel/OutputSizeSection';

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

  return (
    <aside
      className={`w-full rounded-xl border border-slate-800/80 bg-slate-950/70 p-4 shadow-xl lg:w-[360px] ${className ?? ''}`}
    >
      <h2 className="sr-only">{t('propertyPanel.title')}</h2>

      <div className="space-y-4">
        <FormatSection format={exportSettings.format} onChangeExportSettings={onChangeExportSettings} />
        <OutputSizeSection
          baseCrop={baseCrop}
          exportSettings={exportSettings}
          onChangeExportSettings={onChangeExportSettings}
        />
        <ExportDetailsSection
          exportSettings={exportSettings}
          onChangeExportSettings={onChangeExportSettings}
        />
      </div>

      <ExportStatusSection
        exportSettings={exportSettings}
        ffmpegStatus={ffmpegStatus}
        ffmpegError={ffmpegError}
        isExporting={isExporting}
        exportProgress={exportProgress}
        exportProgressLabel={exportProgressLabel}
        exportError={exportError}
        onExport={onExport}
      />
    </aside>
  );
}
