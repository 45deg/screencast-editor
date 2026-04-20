import { Button } from '@base-ui/react/button';
import { Tooltip } from '@base-ui/react/tooltip';
import { Toolbar } from '@base-ui/react/toolbar';
import { Check, Crop, Pause, Play, RotateCcw, SkipBack, X } from 'lucide-react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { formatSeconds } from './math';

interface CanvasPreviewHeaderProps {
  fileName: string;
  isEditing: boolean;
  onResetEdit: () => void;
  onCancelEdit: () => void;
  onConfirmEdit: () => void;
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  onRestart: () => void;
  onTogglePlay: () => void;
  onStartCrop: () => void;
}

function ToolbarTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactElement;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner side="top" sideOffset={8} className="z-[130]">
          <Tooltip.Popup className="max-w-[18rem] whitespace-pre-line rounded-md border border-slate-700 bg-slate-950/98 px-2.5 py-2 text-[11px] leading-relaxed text-slate-100 shadow-xl backdrop-blur">
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export default function CanvasPreviewHeader({
  fileName,
  isEditing,
  onResetEdit,
  onCancelEdit,
  onConfirmEdit,
  isPlaying,
  currentTime,
  totalDuration,
  onRestart,
  onTogglePlay,
  onStartCrop,
}: CanvasPreviewHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <h2 className="sr-only">{t('canvas.title')}</h2>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <p className="min-w-0 max-w-[52vw] truncate text-xs text-slate-400 sm:max-w-[360px]" title={fileName}>
          {fileName}
        </p>
      </div>

      {isEditing ? (
        <div className="inline-flex items-center gap-2">
          <Button
            type="button"
            onClick={onResetEdit}
            className="inline-flex items-center gap-1 rounded-md border border-slate-600 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-100 transition hover:border-cyan-400/60 hover:text-cyan-100"
          >
            <RotateCcw size={13} />
            {t('canvas.reset')}
          </Button>
          <Button
            type="button"
            onClick={onCancelEdit}
            className="inline-flex items-center gap-1 rounded-md border border-rose-300/40 bg-rose-400/10 px-2.5 py-1.5 text-xs font-medium text-rose-100 transition hover:bg-rose-400/20"
          >
            <X size={13} />
            {t('canvas.cancel')}
          </Button>
          <Button
            type="button"
            onClick={onConfirmEdit}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-300/40 bg-emerald-400/10 px-2.5 py-1.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-400/20"
          >
            <Check size={13} />
            {t('canvas.confirm')}
          </Button>
        </div>
      ) : null}

      {!isEditing ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Toolbar.Root
            aria-label={t('canvas.previewControls')}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/90 p-1"
          >
            <Toolbar.Group className="inline-flex items-center gap-1">
              <Toolbar.Button
                aria-label={t('canvas.restartPreview')}
                onClick={onRestart}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                <SkipBack size={14} />
              </Toolbar.Button>
              <Toolbar.Button
                aria-label={isPlaying ? t('canvas.pausePreview') : t('canvas.playPreview')}
                onClick={onTogglePlay}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-100 transition hover:bg-cyan-500/15 hover:text-cyan-100"
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
              </Toolbar.Button>
            </Toolbar.Group>
            <Toolbar.Separator className="mx-1 h-5 w-px bg-slate-800" />
            <div className="min-w-[110px] px-2 text-right font-mono text-[11px] text-slate-300">
              {formatSeconds(currentTime)} / {formatSeconds(totalDuration)}
            </div>
          </Toolbar.Root>
          <ToolbarTooltip label={t('canvas.canvasCropTooltip')}>
            <Button
              type="button"
              onClick={onStartCrop}
              className="inline-flex items-center gap-1 rounded-md border border-cyan-300/40 bg-cyan-400/10 px-2.5 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/20"
            >
              <Crop size={13} />
              {t('sliceEditor.crop')}
            </Button>
          </ToolbarTooltip>
        </div>
      ) : null}
    </div>
  );
}
