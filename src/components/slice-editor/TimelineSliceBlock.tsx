import { useRef } from 'react';
import { motion, type PanInfo } from 'framer-motion';
import { Crop } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { DerivedSlice, TimelineScrollInfo } from '../../types/editor';

interface TimelineSliceBlockProps {
  slice: DerivedSlice;
  index: number;
  isSelected: boolean;
  pixelsPerSecond: number;
  scrollInfo: TimelineScrollInfo;
  thumbnailUrl: string | undefined;
  outputAspectRatio: number;
  onSelect: (time: number) => void;
  onMoveSlice: (sliceId: string, nextStart: number) => void;
  onMoveSliceEnd: () => void;
  onResizeSliceStart: (sliceId: string, nextStart: number) => void;
  onResizeSliceStartEnd: () => void;
  onResizeSlice: (sliceId: string, nextDuration: number) => void;
  onResizeSliceEnd: () => void;
}

export default function TimelineSliceBlock({
  slice,
  index,
  isSelected,
  pixelsPerSecond,
  scrollInfo,
  thumbnailUrl,
  outputAspectRatio,
  onSelect,
  onMoveSlice,
  onMoveSliceEnd,
  onResizeSliceStart,
  onResizeSliceStartEnd,
  onResizeSlice,
  onResizeSliceEnd,
}: TimelineSliceBlockProps) {
  const { t } = useTranslation();
  const initialDurationRef = useRef<number>(0);
  const initialStartRef = useRef<number>(0);
  const initialLeftResizeStartRef = useRef<number>(0);
  const startPx = slice.start * pixelsPerSecond;
  const endPx = slice.end * pixelsPerSecond;

  const visibleLeft = Math.max(scrollInfo.left, startPx);
  const visibleRight = Math.min(scrollInfo.left + scrollInfo.width, endPx);
  const isVisible = visibleLeft < visibleRight;
  const visibleCenter = (visibleLeft + visibleRight) / 2;
  const labelOffset = visibleCenter - startPx;

  return (
    <div className="absolute inset-y-0">
      <motion.div
        role="button"
        tabIndex={0}
        data-timeline-slice-block="true"
        className={`absolute inset-y-0 cursor-grab overflow-hidden transition-colors active:cursor-grabbing ${
          isSelected
            ? 'z-20 border-[3px] border-amber-300 bg-cyan-600'
            : 'z-10 border border-cyan-500 bg-cyan-800 hover:bg-cyan-700'
        }`}
        style={{
          left: `${startPx}px`,
          width: `${slice.duration * pixelsPerSecond}px`,
          touchAction: 'none',
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect(slice.start);
          }
        }}
        onPanStart={() => {
          initialStartRef.current = slice.start;
        }}
        onPan={(_event: Event, info: PanInfo) => {
          const nextStart = Math.max(0, initialStartRef.current + info.offset.x / pixelsPerSecond);
          onMoveSlice(slice.id, nextStart);
        }}
        onPanEnd={onMoveSliceEnd}
      >
        {isVisible ? (
          <div
            className="pointer-events-none absolute inset-y-0 flex w-max -translate-x-1/2 items-center gap-2 px-1.5 py-1.5 sm:flex-col sm:items-center sm:gap-1 sm:py-2"
            style={{ left: `${labelOffset}px` }}
          >
            <div
              className="w-14 shrink-0 overflow-hidden rounded-md border border-slate-700 bg-slate-950/85 shadow-lg sm:w-[118px]"
              style={{ aspectRatio: `${outputAspectRatio} / 1` }}
            >
              {thumbnailUrl ? (
                <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="h-full w-full animate-pulse bg-slate-800/70" />
              )}
            </div>
            <div className="min-w-0 sm:text-center">
              <div className="flex items-center gap-1 text-[11px] font-bold tracking-wide text-white drop-shadow sm:justify-center sm:text-sm sm:tracking-wider">
                {slice.crop ? <Crop size={12} className="shrink-0 text-amber-200 sm:h-[13px] sm:w-[13px]" /> : null}
                <span className="truncate">{t('sliceEditor.sceneNumber', { index: index + 1 })}</span>
              </div>
              <div className="font-mono text-[9px] leading-tight text-cyan-100 drop-shadow sm:text-[10px]">
                <span className="text-white">{slice.duration.toFixed(1)}s</span>
                <span className="ml-1 text-amber-200 sm:ml-0 sm:block">x{slice.speed.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ) : null}
      </motion.div>

      <motion.div
        className="group absolute inset-y-0 z-30 -ml-2.5 flex w-5 cursor-col-resize items-center justify-center"
        style={{ left: `${startPx}px`, touchAction: 'none' }}
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect(slice.start);
        }}
        onPanStart={() => {
          initialLeftResizeStartRef.current = slice.start;
        }}
        onPan={(_event: Event, info: PanInfo) => {
          const deltaSeconds = info.offset.x / pixelsPerSecond;
          onResizeSliceStart(slice.id, initialLeftResizeStartRef.current + deltaSeconds);
        }}
        onPanEnd={onResizeSliceStartEnd}
      >
        <div className="h-full w-1.5 bg-black/10 transition-colors group-hover:bg-amber-300/80" />
      </motion.div>

      <motion.div
        className="group absolute inset-y-0 z-30 -ml-2.5 flex w-5 cursor-col-resize items-center justify-center"
        style={{ left: `${endPx}px`, touchAction: 'none' }}
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect(slice.end);
        }}
        onPanStart={() => {
          initialDurationRef.current = slice.duration;
        }}
        onPan={(_event: Event, info: PanInfo) => {
          const deltaSeconds = info.offset.x / pixelsPerSecond;
          onResizeSlice(slice.id, initialDurationRef.current + deltaSeconds);
        }}
        onPanEnd={onResizeSliceEnd}
      >
        <div className="h-full w-1.5 bg-black/10 transition-colors group-hover:bg-amber-300/80" />
      </motion.div>
    </div>
  );
}
