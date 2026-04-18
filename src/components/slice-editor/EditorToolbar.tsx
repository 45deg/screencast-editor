import { useCallback, useRef, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Slider } from '@base-ui/react/slider';
import { Clapperboard, Gauge, ImagePlus, PlusSquare, Redo2, Scissors, Trash2, Undo2, ZoomIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { DerivedSlice } from '../../types/editor';

interface EditorToolbarProps {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onSceneCrop: () => void;
  canSceneCrop: boolean;
  onCut: () => void;
  canCut: boolean;
  onDelete: () => void;
  canDelete: boolean;
  onAddTextLayer: () => void;
  onAddImageLayer: () => void;
  selectedSlice: DerivedSlice | undefined;
  onSpeedValueChange: (value: number | null) => void;
  onSpeedValueCommit: () => void;
  zoomSlider: number;
  setZoomSlider: (val: number) => void;
  zoom: number;
}

export default function EditorToolbar({
  undo,
  redo,
  canUndo,
  canRedo,
  onSceneCrop,
  canSceneCrop,
  onCut,
  canCut,
  onDelete,
  canDelete,
  onAddTextLayer,
  onAddImageLayer,
  selectedSlice,
  onSpeedValueChange,
  onSpeedValueCommit,
  zoomSlider,
  setZoomSlider,
  zoom,
}: EditorToolbarProps) {
  const { t } = useTranslation();
  const speedInputRef = useRef<HTMLInputElement>(null);

  const commitSpeedDraft = useCallback(() => {
    if (!selectedSlice) {
      return;
    }

    const nextSpeed = Number.parseFloat(speedInputRef.current?.value ?? '');
    if (!Number.isFinite(nextSpeed) || nextSpeed <= 0) {
      if (speedInputRef.current) {
        speedInputRef.current.value = selectedSlice.speed.toFixed(2);
      }
      return;
    }

    onSpeedValueChange(nextSpeed);
    onSpeedValueCommit();
    if (speedInputRef.current) {
      speedInputRef.current.value = nextSpeed.toFixed(2);
    }
  }, [onSpeedValueChange, onSpeedValueCommit, selectedSlice]);

  const handleSpeedInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextSpeed = Number.parseFloat(event.target.value);
      if (Number.isFinite(nextSpeed) && nextSpeed > 0) {
        onSpeedValueChange(nextSpeed);
      }
    },
    [onSpeedValueChange],
  );

  const handleSpeedInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        commitSpeedDraft();
      }
    },
    [commitSpeedDraft],
  );

  return (
    <div className="h-14 border-b border-slate-800/80 bg-slate-950/95 px-2 shadow-sm sm:px-4">
      <div
        aria-label={t('sliceEditor.editorControls')}
        className="timeline-scrollbar flex h-full min-w-max items-center gap-2 overflow-x-auto overflow-y-hidden sm:min-w-0"
      >
        <div className="flex min-w-max items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label={t('sliceEditor.undo')}
            title={t('sliceEditor.undoWithShortcut')}
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label={t('sliceEditor.redo')}
            title={t('sliceEditor.redoWithShortcut')}
          >
            <Redo2 size={16} />
          </button>

          <div aria-hidden="true" className="mx-1 h-5 w-px bg-slate-700" />

          <button
            type="button"
            onClick={onSceneCrop}
            disabled={!canSceneCrop}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-amber-100 transition hover:bg-amber-400/15 hover:text-white disabled:opacity-30 sm:gap-1.5 sm:px-2.5 sm:text-xs"
            aria-label={t('sliceEditor.sceneCrop')}
          >
            <Clapperboard size={15} />
            <span className="hidden sm:inline">{t('sliceEditor.crop')}</span>
          </button>

          <button
            type="button"
            onClick={onCut}
            disabled={!canCut}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-cyan-200 transition hover:bg-cyan-500/15 hover:text-white disabled:opacity-30 sm:gap-1.5 sm:px-2.5 sm:text-xs"
            aria-label={t('sliceEditor.cutAtPlayhead')}
            title={t('sliceEditor.cutAtPlayhead')}
          >
            <Scissors size={16} />
            <span className="hidden sm:inline">{t('sliceEditor.cut')}</span>
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={!canDelete}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-rose-300 transition hover:bg-rose-500/15 hover:text-rose-200 disabled:opacity-30 sm:gap-1.5 sm:px-2.5 sm:text-xs"
            aria-label={t('sliceEditor.deleteSelection')}
            title={t('sliceEditor.deleteWithShortcut')}
          >
            <Trash2 size={16} />
            <span className="hidden sm:inline">{t('sliceEditor.deleteSelection')}</span>
          </button>

          <div aria-hidden="true" className="mx-1 h-5 w-px bg-slate-700" />

          <button
            type="button"
            onClick={onAddTextLayer}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-rose-100 transition hover:bg-rose-500/15 hover:text-white sm:gap-1.5 sm:px-2.5 sm:text-xs"
            aria-label={t('sliceEditor.addTextLayer')}
            title={t('sliceEditor.addTextLayer')}
          >
            <PlusSquare size={16} />
            <span className="hidden sm:inline">{t('sliceEditor.addTextLayer')}</span>
          </button>

          <button
            type="button"
            onClick={onAddImageLayer}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-amber-100 transition hover:bg-amber-500/15 hover:text-white sm:gap-1.5 sm:px-2.5 sm:text-xs"
            aria-label={t('sliceEditor.addImageLayer')}
            title={t('sliceEditor.addImageLayer')}
          >
            <ImagePlus size={16} />
            <span className="hidden sm:inline">{t('sliceEditor.addImageLayer')}</span>
          </button>

          <div aria-hidden="true" className="mx-1 h-5 w-px bg-slate-700" />
        </div>

        <div className="ml-auto flex min-w-max items-center gap-2 pl-2">
          <Popover.Root>
            <Popover.Trigger
              type="button"
              disabled={!selectedSlice}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950 px-2.5 font-medium text-slate-200 transition hover:border-cyan-500/60 hover:bg-slate-900 hover:text-white disabled:opacity-30 sm:text-[11px]"
              aria-label={t('sliceEditor.sliceSpeed')}
            >
              <Gauge size={14} className="text-slate-400" />
              <span className="text-xs">x {selectedSlice ? selectedSlice.speed.toFixed(1) : '1.0'}</span>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-[120]">
                <Popover.Popup className="z-[120] w-44 rounded-xl border border-slate-800 bg-slate-950/98 p-3 shadow-2xl backdrop-blur">
                  <div className="mb-2 text-[11px] font-medium tracking-wide text-slate-400">{t('sliceEditor.playbackSpeed')}</div>
                  <label
                    htmlFor="slice-speed"
                    className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 focus-within:border-cyan-500"
                  >
                    <Gauge size={14} className="shrink-0 text-slate-400" />
                    <input
                      key={selectedSlice ? selectedSlice.id : 'no-slice'}
                      ref={speedInputRef}
                      id="slice-speed"
                      name="slice-speed"
                      type="number"
                      inputMode="decimal"
                      min={0.1}
                      step={0.1}
                      defaultValue={selectedSlice ? selectedSlice.speed.toFixed(2) : ''}
                      onChange={handleSpeedInputChange}
                      onBlur={commitSpeedDraft}
                      onKeyDown={handleSpeedInputKeyDown}
                      disabled={!selectedSlice}
                      placeholder="1.0"
                      className="w-full border-0 bg-transparent text-sm text-white outline-none [appearance:textfield] disabled:opacity-30 [&::-webkit-inner-spin-button]:appearance-auto [&::-webkit-outer-spin-button]:appearance-auto"
                    />
                  </label>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>

          <div className="flex h-8 items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950 px-2 sm:gap-2 sm:px-3">
            <ZoomIn size={14} className="text-slate-400" />
            <Slider.Root
              min={-6}
              max={3}
              step={0.1}
              value={zoomSlider}
              onValueChange={(value) => {
                if (typeof value === 'number') {
                  setZoomSlider(value);
                }
              }}
              className="w-14 sm:w-24"
            >
              <Slider.Control className="relative flex h-5 w-full items-center">
                <Slider.Track className="relative h-3 w-full rounded-full bg-slate-700">
                  <Slider.Indicator className="absolute h-full rounded-full bg-cyan-500" />
                </Slider.Track>
                <Slider.Thumb
                  className="block h-3 w-3 rounded-full border border-cyan-100 bg-cyan-400 shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
                  title={t('sliceEditor.timelineZoom', { zoom: zoom.toFixed(2) })}
                />
              </Slider.Control>
            </Slider.Root>
          </div>
        </div>
      </div>
    </div>
  );
}
