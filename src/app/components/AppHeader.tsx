import { Drawer } from '@base-ui/react/drawer';
import { Popover } from '@base-ui/react/popover';
import { ChevronLeft, CircleHelp, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { VideoMeta } from '../../types/editor';

interface AppHeaderProps {
  hasVideo: boolean;
  video: VideoMeta | null;
  videoInfoItems: string[];
  canOpenMobileSettings: boolean;
  onReturnToLanding: () => void;
}

export default function AppHeader({
  hasVideo,
  video,
  videoInfoItems,
  canOpenMobileSettings,
  onReturnToLanding,
}: AppHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-slate-800/70 bg-slate-950/88 backdrop-blur">
      <div className="flex h-16 w-full items-center gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {hasVideo ? (
            <button
              type="button"
              onClick={onReturnToLanding}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-100 transition hover:border-cyan-400/60 hover:text-cyan-100"
              aria-label={t('app.back')}
            >
              <ChevronLeft size={18} />
            </button>
          ) : null}
          <h1 className="font-['Space_Grotesk',sans-serif] text-xl font-bold">Screencast Editor</h1>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {hasVideo && video ? (
            <Popover.Root>
              <Popover.Trigger
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-800/85 bg-slate-950/78 text-slate-300 shadow-lg backdrop-blur transition hover:border-cyan-400/60 hover:bg-slate-900 hover:text-cyan-100"
                aria-label={t('canvas.sourceInfo')}
                title={t('canvas.sourceInfo')}
              >
                <CircleHelp size={18} />
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner side="bottom" align="end" sideOffset={10} className="z-[120]">
                  <Popover.Popup className="z-[120] w-[min(68vw,420px)] rounded-xl border border-slate-800 bg-slate-950/98 p-3 shadow-2xl backdrop-blur">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
                      {t('canvas.source')}
                    </div>
                    <div className="truncate text-sm font-medium text-white" title={video.file.name}>
                      {video.file.name}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                      {videoInfoItems.map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </div>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          ) : null}
          {canOpenMobileSettings ? (
            <Drawer.Trigger className="inline-flex items-center gap-1 rounded-md border border-amber-300/40 bg-amber-400/15 px-3 py-2 text-xs font-medium text-amber-100 transition hover:bg-amber-400/25 lg:hidden">
              <Download size={14} />
              {t('app.export')}
            </Drawer.Trigger>
          ) : null}
        </div>
      </div>
    </header>
  );
}
