import { Toolbar } from '@base-ui/react/toolbar';
import { BringToFront, SendToBack, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  AnnotationToolbarRoot,
  AnnotationToolbarSeparator,
  ToolbarTooltip,
} from './AnnotationToolbarPrimitives';
import type { ImageAnnotation } from '../../types/editor';

interface ImageStyleToolbarProps {
  selectedImageAnnotation: ImageAnnotation | null;
  showLayerMoveControls: boolean;
  canBringToFront: boolean;
  canSendToBack: boolean;
  onOpacityChange: (opacity: number) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onDelete?: () => void;
}

export default function ImageStyleToolbar({
  selectedImageAnnotation,
  showLayerMoveControls,
  canBringToFront,
  canSendToBack,
  onOpacityChange,
  onBringToFront,
  onSendToBack,
  onDelete,
}: ImageStyleToolbarProps) {
  const { t } = useTranslation();

  if (!selectedImageAnnotation) {
    return null;
  }

  const opacityPercent = Math.round((selectedImageAnnotation.opacity ?? 1) * 100);

  return (
    <AnnotationToolbarRoot ariaLabel={t('canvas.imageToolbar')}>
      <label className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-slate-200">
        <span className="shrink-0 text-slate-400">{t('canvas.imageOpacity')}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={opacityPercent}
          onChange={(event) => onOpacityChange(Number.parseInt(event.target.value, 10) / 100)}
          className="h-1.5 w-28 accent-cyan-300"
          aria-label={t('canvas.imageOpacity')}
        />
        <span className="w-10 text-right font-mono text-[10px] text-white">{opacityPercent}%</span>
      </label>

      {showLayerMoveControls ? (
        <>
          <AnnotationToolbarSeparator />
          {canBringToFront ? (
            <ToolbarTooltip label={t('canvas.bringToFront')}>
              <Toolbar.Button
                aria-label={t('canvas.bringToFront')}
                onClick={onBringToFront}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-200 transition hover:border-slate-500"
              >
                <BringToFront size={13} />
              </Toolbar.Button>
            </ToolbarTooltip>
          ) : null}
          {canSendToBack ? (
            <ToolbarTooltip label={t('canvas.sendToBack')}>
              <Toolbar.Button
                aria-label={t('canvas.sendToBack')}
                onClick={onSendToBack}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-200 transition hover:border-slate-500"
              >
                <SendToBack size={13} />
              </Toolbar.Button>
            </ToolbarTooltip>
          ) : null}
        </>
      ) : null}

      {onDelete ? (
        <>
          <AnnotationToolbarSeparator />
          <Toolbar.Button
            aria-label={t('sliceEditor.deleteSelected')}
            onClick={onDelete}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-300/40 bg-rose-400/10 text-rose-100 transition hover:bg-rose-400/20"
          >
            <Trash2 size={14} />
          </Toolbar.Button>
        </>
      ) : null}
    </AnnotationToolbarRoot>
  );
}
