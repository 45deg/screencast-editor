import { useTranslation } from 'react-i18next';

import type { CropRect, ExportSettings } from '../types/editor';
import ExportDetailsSection from './property-panel/ExportDetailsSection';
import ExportStatusSection from './property-panel/ExportStatusSection';
import OutputSizeSection from './property-panel/OutputSizeSection';

interface PropertyPanelProps {
  baseCrop: CropRect;
  exportSettings: ExportSettings;
  exportRuntimeStatus: 'idle' | 'loading' | 'ready' | 'error';
  exportRuntimeError: string | null;
  isExporting: boolean;
  isCancelling: boolean;
  exportProgress: number | null;
  exportProgressLabel: string | null;
  exportError: string | null;
  className?: string;
  onChangeExportSettings: (next: Partial<ExportSettings>) => void;
  onExport: () => void;
  onCancelExport: () => void;
}

export default function PropertyPanel({
  baseCrop,
  exportSettings,
  exportRuntimeStatus,
  exportRuntimeError,
  isExporting,
  isCancelling,
  exportProgress,
  exportProgressLabel,
  exportError,
  className,
  onChangeExportSettings,
  onExport,
  onCancelExport,
}: PropertyPanelProps) {
  const { t } = useTranslation();

  return (
    <aside
      className={`w-full rounded-xl border border-slate-800/80 bg-slate-950/70 p-4 shadow-xl ${className ?? ''}`}
    >
      <h2 className="sr-only">{t('propertyPanel.title')}</h2>

      <div className="space-y-4">
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
        exportRuntimeStatus={exportRuntimeStatus}
        exportRuntimeError={exportRuntimeError}
        isExporting={isExporting}
        isCancelling={isCancelling}
        exportProgress={exportProgress}
        exportProgressLabel={exportProgressLabel}
        exportError={exportError}
        onExport={onExport}
        onCancelExport={onCancelExport}
      />
    </aside>
  );
}
