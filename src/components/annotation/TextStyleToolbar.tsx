import { Toolbar } from '@base-ui/react/toolbar';
import { Bold, Italic, PaintBucket, PenLine, RectangleHorizontal, Trash2, Type, TypeOutline } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { AnnotationTextStyle, TextAnnotation } from '../../types/editor';

interface TextStyleToolbarProps {
  selectedTextAnnotation: TextAnnotation | null;
  outlinePreviewScaleY?: number;
  onStyleChange: (next: Partial<AnnotationTextStyle>) => void;
  onDelete?: () => void;
}

export default function TextStyleToolbar({
  selectedTextAnnotation,
  outlinePreviewScaleY = 1,
  onStyleChange,
  onDelete,
}: TextStyleToolbarProps) {
  const { t } = useTranslation();

  if (!selectedTextAnnotation) {
    return null;
  }

  const style = selectedTextAnnotation.style;
  const displayOutlineWidth = Math.max(0, Math.round(style.outlineWidth * outlinePreviewScaleY));
  const maxDisplayOutlineWidth = Math.max(24, Math.round(24 * outlinePreviewScaleY));

  return (
    <Toolbar.Root
      aria-label={t('canvas.textToolbar')}
      className="timeline-scrollbar inline-flex max-w-[min(92vw,760px)] flex-wrap items-center justify-end gap-1 rounded-lg border border-slate-700/90 bg-slate-950/95 p-1.5 shadow-xl backdrop-blur"
    >
      <Toolbar.Button
        aria-label={t('canvas.bold')}
        onClick={() => onStyleChange({ bold: !style.bold })}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition ${
          style.bold
            ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-100'
            : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
        }`}
      >
        <Bold size={14} />
      </Toolbar.Button>

      <Toolbar.Button
        aria-label={t('canvas.italic')}
        onClick={() => onStyleChange({ italic: !style.italic })}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition ${
          style.italic
            ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-100'
            : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
        }`}
      >
        <Italic size={14} />
      </Toolbar.Button>

      <label className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-slate-200">
        <Type size={12} className="text-slate-400" />
        <input
          type="number"
          min={8}
          max={180}
          step={1}
          value={style.fontSize}
          onChange={(event) => {
            const next = Number.parseInt(event.target.value, 10);
            if (Number.isFinite(next)) {
              onStyleChange({ fontSize: Math.max(8, Math.min(180, next)) });
            }
          }}
          className="w-14 border-0 bg-transparent text-right text-[11px] text-white outline-none"
          aria-label={t('canvas.fontSize')}
        />
      </label>

      <label className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-slate-200">
        <PenLine size={12} className="text-slate-400" />
        <input
          type="color"
          value={style.textColor}
          onChange={(event) => onStyleChange({ textColor: event.target.value })}
          className="h-5 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
          aria-label={t('canvas.fontColor')}
        />
      </label>

      <Toolbar.Button
        aria-label={t('canvas.toggleBox')}
        onClick={() => onStyleChange({ boxEnabled: !style.boxEnabled })}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition ${
          style.boxEnabled
            ? 'border-rose-300/70 bg-rose-400/25 text-rose-50'
            : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
        }`}
      >
        <RectangleHorizontal size={14} />
      </Toolbar.Button>

      {style.boxEnabled ? (
        <label className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-slate-200">
          <PaintBucket size={12} className="text-slate-400" />
          <input
            type="color"
            value={style.boxColor}
            onChange={(event) => onStyleChange({ boxColor: event.target.value })}
            className="h-5 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
            aria-label={t('canvas.boxColor')}
          />
        </label>
      ) : null}

      <label className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-slate-200">
        <span className="font-mono text-[10px]"><TypeOutline size={12} className="text-slate-400" /></span>
        <input
          type="number"
          min={0}
          max={maxDisplayOutlineWidth}
          step={1}
          value={displayOutlineWidth}
          onChange={(event) => {
            const next = Number.parseInt(event.target.value, 10);
            if (Number.isFinite(next)) {
              const clamped = Math.max(0, Math.min(maxDisplayOutlineWidth, next));
              onStyleChange({ outlineWidth: clamped / Math.max(0.0001, outlinePreviewScaleY) });
            }
          }}
          className="w-10 border-0 bg-transparent text-right text-[11px] text-white outline-none"
          aria-label={t('canvas.outlineWidth')}
        />
        <input
          type="color"
          value={style.outlineColor}
          onChange={(event) => onStyleChange({ outlineColor: event.target.value })}
          className="h-5 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
          aria-label={t('canvas.outlineColor')}
        />
      </label>

      {onDelete ? (
        <>
          <Toolbar.Separator className="mx-1 h-5 w-px bg-slate-800" />
          <Toolbar.Button
            aria-label={t('sliceEditor.deleteSelected')}
            onClick={onDelete}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-300/40 bg-rose-400/10 text-rose-100 transition hover:bg-rose-400/20"
          >
            <Trash2 size={14} />
          </Toolbar.Button>
        </>
      ) : null}
    </Toolbar.Root>
  );
}
