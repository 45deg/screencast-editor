import { Drawer } from '@base-ui/react/drawer';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import PropertyPanel from '../../components/PropertyPanel';
import type { CropRect, ExportSettings } from '../../types/editor';

interface MobileSettingsDrawerProps {
  isVisible: boolean;
  baseCrop: CropRect;
  exportSettings: ExportSettings;
  ffmpegStatus: 'idle' | 'loading' | 'ready' | 'error';
  ffmpegError: string | null;
  isExporting: boolean;
  exportProgress: number | null;
  exportProgressLabel: string | null;
  exportError: string | null;
  onChangeExportSettings: (next: Partial<ExportSettings>) => void;
  onExport: () => void;
}

export default function MobileSettingsDrawer({
  isVisible,
  baseCrop,
  exportSettings,
  ffmpegStatus,
  ffmpegError,
  isExporting,
  exportProgress,
  exportProgressLabel,
  exportError,
  onChangeExportSettings,
  onExport,
}: MobileSettingsDrawerProps) {
  const { t } = useTranslation();

  if (!isVisible) {
    return null;
  }

  return (
    <Drawer.Portal>
      <Drawer.Backdrop className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
      <Drawer.Popup className="fixed inset-x-0 bottom-0 z-40 max-h-[88vh] rounded-t-2xl border border-slate-800/90 bg-slate-950 outline-none data-[starting-style]:translate-y-6 data-[ending-style]:translate-y-6 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0">
        <Drawer.Content className="flex h-full max-h-[88vh] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3">
            <div>
              <Drawer.Title className="text-sm font-semibold text-slate-100">{t('app.outputSettings')}</Drawer.Title>
              <p className="text-[11px] text-slate-400">{t('app.outputSettingsDescription')}</p>
            </div>

            <Drawer.Close className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 transition hover:border-cyan-400/60 hover:text-cyan-100">
              <X size={13} />
              {t('app.close')}
            </Drawer.Close>
          </div>

          <div className="timeline-scrollbar flex-1 overflow-y-auto p-3 pb-[calc(env(safe-area-inset-bottom)+14px)]">
            <PropertyPanel
              baseCrop={baseCrop}
              exportSettings={exportSettings}
              ffmpegStatus={ffmpegStatus}
              ffmpegError={ffmpegError}
              isExporting={isExporting}
              exportProgress={exportProgress}
              exportProgressLabel={exportProgressLabel}
              exportError={exportError}
              onChangeExportSettings={onChangeExportSettings}
              onExport={onExport}
              className="border-none bg-transparent p-0 shadow-none lg:w-full"
            />
          </div>
        </Drawer.Content>
      </Drawer.Popup>
    </Drawer.Portal>
  );
}
