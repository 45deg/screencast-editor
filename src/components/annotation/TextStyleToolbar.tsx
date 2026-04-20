import { Switch } from '@base-ui/react/switch';
import { Popover } from '@base-ui/react/popover';
import { Toolbar } from '@base-ui/react/toolbar';
import {
  Bold,
  ChevronDown,
  Italic,
  PaintBucket,
  PenLine,
  Trash2,
  Type,
  TypeOutline,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { HexAlphaColorPicker } from 'react-colorful';
import { useTranslation } from 'react-i18next';

import {
  ANNOTATION_FONT_OPTIONS,
  resolveAnnotationFontFamily,
  resolveAnnotationFontLabel,
} from '../../lib/annotationFonts';
import type { AnnotationTextStyle, TextAnnotation } from '../../types/editor';

interface TextStyleToolbarProps {
  selectedTextAnnotation: TextAnnotation | null;
  outlinePreviewScaleY?: number;
  onStyleChange: (next: Partial<AnnotationTextStyle>) => void;
  onDelete?: () => void;
}

interface ColorPopoverFieldProps {
  ariaLabel: string;
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  footer?: ReactNode;
}

function hasTransparentAlpha(value: string): boolean {
  const trimmed = value.trim().toLowerCase();

  if (trimmed.startsWith('#')) {
    if (trimmed.length === 9) {
      return trimmed.slice(-2) !== 'ff';
    }

    if (trimmed.length === 5) {
      return trimmed.slice(-1) !== 'f';
    }

    return false;
  }

  const rgbaMatch = trimmed.match(/^rgba?\((.+)\)$/);
  if (!rgbaMatch) {
    return false;
  }

  const parts = rgbaMatch[1].split(',').map((part) => part.trim());
  if (parts.length < 4) {
    return false;
  }

  const alpha = Number.parseFloat(parts[3]);
  return Number.isFinite(alpha) && alpha < 1;
}

function ColorPopoverField({
  ariaLabel,
  icon,
  value,
  onChange,
  disabled = false,
  footer,
}: ColorPopoverFieldProps) {
  return (
    <Popover.Root>
      <Popover.Trigger
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        title={ariaLabel}
        className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-2 text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="text-slate-400">{icon}</span>
        <span
          aria-hidden="true"
          className="h-4 w-4 rounded border border-white/20 shadow-inner"
          style={{
            backgroundColor: value,
            backgroundImage: hasTransparentAlpha(value)
              ? 'linear-gradient(45deg, rgba(148, 163, 184, 0.35) 25%, transparent 25%, transparent 75%, rgba(148, 163, 184, 0.35) 75%, rgba(148, 163, 184, 0.35)), linear-gradient(45deg, rgba(148, 163, 184, 0.35) 25%, transparent 25%, transparent 75%, rgba(148, 163, 184, 0.35) 75%, rgba(148, 163, 184, 0.35))'
              : undefined,
            backgroundPosition: hasTransparentAlpha(value) ? '0 0, 6px 6px' : undefined,
            backgroundSize: hasTransparentAlpha(value) ? '12px 12px' : undefined,
          }}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="center" sideOffset={8} className="z-[120]">
          <Popover.Popup className="z-[120] rounded-xl border border-slate-800 bg-slate-950/98 p-3 shadow-2xl backdrop-blur">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-[11px] font-medium text-slate-300">{ariaLabel}</div>
              {footer ? <div className="shrink-0">{footer}</div> : null}
            </div>
            <HexAlphaColorPicker color={value} onChange={onChange} />
            <label className="mt-3 flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] text-slate-200">
              <input
                type="text"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                spellCheck={false}
                className="w-24 border-0 bg-transparent font-mono uppercase text-white outline-none"
                aria-label={ariaLabel}
              />
            </label>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function FontFamilySelect({
  value,
  ariaLabel,
  onChange,
}: {
  value: AnnotationTextStyle['fontFamily'];
  ariaLabel: string;
  onChange: (value: AnnotationTextStyle['fontFamily']) => void;
}) {
  const currentLabel = resolveAnnotationFontLabel(value);
  const groupedOptions = ANNOTATION_FONT_OPTIONS.reduce<Record<string, typeof ANNOTATION_FONT_OPTIONS>>((groups, option) => {
    (groups[option.group] ??= []).push(option);
    return groups;
  }, {});
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        type="button"
        aria-label={ariaLabel}
        title={ariaLabel}
        className="inline-flex h-8 min-w-[13rem] items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-[11px] text-slate-200 transition hover:border-slate-500"
      >
        <Type size={12} className="shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1 truncate text-left text-white" style={{ fontFamily: resolveAnnotationFontFamily(value) }}>
          {currentLabel}
        </span>
        <ChevronDown size={12} className="shrink-0 text-slate-500" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={8} className="z-[120]">
          <Popover.Popup className="z-[120] w-[19rem] max-h-[18rem] overflow-auto rounded-xl border border-slate-800 bg-slate-950/98 p-1 shadow-2xl backdrop-blur">
            {Object.entries(groupedOptions).map(([group, options]) => (
              <div key={group} className="py-1">
                <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {group}
                </div>
                {options.map((option) => {
                  const selected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-[11px] transition ${
                        selected ? 'bg-cyan-400/15 text-cyan-50' : 'text-slate-200 hover:bg-slate-800/80'
                      }`}
                      style={{ fontFamily: option.fontFamily }}
                    >
                      <span className="truncate">{option.label}</span>
                      <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-slate-500">Aa</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
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
      className="timeline-scrollbar inline-flex max-w-[min(92vw,820px)] flex-wrap items-center justify-end gap-1 rounded-lg border border-slate-700/90 bg-slate-950/95 p-1.5 shadow-xl backdrop-blur"
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

      <label className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-slate-200">
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

      <FontFamilySelect
        value={style.fontFamily}
        ariaLabel={t('canvas.fontFamily')}
        onChange={(fontFamily) => onStyleChange({ fontFamily })}
      />

      <ColorPopoverField
        ariaLabel={t('canvas.fontColor')}
        icon={<PenLine size={12} />}
        value={style.textColor}
        onChange={(value) => onStyleChange({ textColor: value })}
      />

      <ColorPopoverField
        ariaLabel={t('canvas.boxColor')}
        icon={<PaintBucket size={12} />}
        value={style.boxColor}
        onChange={(value) => onStyleChange({ boxColor: value })}
        footer={
          <Switch.Root
            aria-label={t('canvas.toggleBox')}
            checked={style.boxEnabled}
            onCheckedChange={(checked) => onStyleChange({ boxEnabled: checked })}
            className="inline-flex h-5 w-9 items-center rounded-full border border-slate-600 bg-slate-800 p-0.5 transition data-[checked]:border-emerald-400/60 data-[checked]:bg-emerald-500/30 data-[unchecked]:bg-slate-800"
          >
            <Switch.Thumb className="h-3.5 w-3.5 rounded-full bg-slate-200 shadow-sm transition data-[checked]:translate-x-4 data-[unchecked]:translate-x-0" />
          </Switch.Root>
        }
      />

      <label className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-slate-200">
        <span className="font-mono text-[10px]">
          <TypeOutline size={12} className="text-slate-400" />
        </span>
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
      </label>

      <ColorPopoverField
        ariaLabel={t('canvas.outlineColor')}
        icon={<TypeOutline size={12} />}
        value={style.outlineColor}
        onChange={(value) => onStyleChange({ outlineColor: value })}
      />

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
