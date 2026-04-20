import { useRef } from 'react';
import { motion, type PanInfo } from 'framer-motion';
import { ChevronDown, ChevronUp, Image as ImageIcon, Type } from 'lucide-react';

import type { LayerMoveDirection } from '../../lib/annotationTimeline';
import type { DerivedAnnotation } from '../../types/editor';
import {
  ANNOTATION_ROW_HEIGHT,
  getAnnotationLabel,
  getAnnotationRowTop,
  MIN_ANNOTATION_BLOCK_WIDTH,
} from './timelineTracksConstants';

interface AnnotationLayerBlockProps {
  annotation: DerivedAnnotation;
  pixelsPerSecond: number;
  row: number;
  zIndex: number;
  selected: boolean;
  draggingAnnotationId: string | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  layerUpLabel: string;
  layerDownLabel: string;
  onSelect: () => void;
  onMove: (nextStart: number) => void;
  onMoveEnd: () => void;
  onResizeStart: (nextStart: number) => void;
  onResizeStartEnd: () => void;
  onResize: (nextDuration: number) => void;
  onResizeEnd: () => void;
  onLayerMove: (direction: LayerMoveDirection) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export default function AnnotationLayerBlock({
  annotation,
  pixelsPerSecond,
  row,
  zIndex,
  selected,
  draggingAnnotationId,
  canMoveUp,
  canMoveDown,
  layerUpLabel,
  layerDownLabel,
  onSelect,
  onMove,
  onMoveEnd,
  onResizeStart,
  onResizeStartEnd,
  onResize,
  onResizeEnd,
  onLayerMove,
  onDragStart,
  onDragEnd,
}: AnnotationLayerBlockProps) {
  const initialStartRef = useRef(annotation.start);
  const initialResizeStartRef = useRef(annotation.start);
  const initialDurationRef = useRef(annotation.duration);
  const isDragging = draggingAnnotationId === annotation.id;
  const isDragLocked = draggingAnnotationId !== null && !isDragging;
  const blockWidth = Math.max(MIN_ANNOTATION_BLOCK_WIDTH, annotation.duration * pixelsPerSecond);
  const isText = annotation.kind === 'text';

  const baseColorClass = isText
    ? 'border-rose-300/60 bg-rose-700/85 text-rose-50 hover:bg-rose-600/90'
    : 'border-amber-300/60 bg-amber-600/85 text-amber-50 hover:bg-amber-500/90';
  const selectedColorClass = isText
    ? 'border-[3px] border-rose-200 bg-rose-500/88 text-white'
    : 'border-[3px] border-amber-200 bg-amber-400/88 text-slate-950';

  return (
    <div
      className="absolute"
      style={{
        left: `${annotation.start * pixelsPerSecond}px`,
        width: `${blockWidth}px`,
        top: `${getAnnotationRowTop(row)}px`,
        height: `${ANNOTATION_ROW_HEIGHT}px`,
        zIndex: selected ? zIndex + 10000 : zIndex,
        pointerEvents: isDragLocked ? 'none' : 'auto',
      }}
    >
      <motion.button
        type="button"
        data-timeline-annotation-block="true"
        className={`absolute inset-y-0 left-0 w-full border px-2 pr-4 text-left text-xs transition ${
          selected ? selectedColorClass : baseColorClass
        }`}
        style={{ touchAction: 'pan-x' }}
        onPointerDown={(event) => {
          if (event.currentTarget.setPointerCapture) {
            event.currentTarget.setPointerCapture(event.pointerId);
          }
          onSelect();
        }}
        onPanStart={() => {
          initialStartRef.current = annotation.start;
          onDragStart();
        }}
        onPan={(_event: Event, info: PanInfo) => {
          const nextStart = Math.max(0, initialStartRef.current + info.offset.x / pixelsPerSecond);
          onMove(nextStart);
        }}
        onPanEnd={() => {
          onMoveEnd();
          onDragEnd();
        }}
        title={getAnnotationLabel(annotation)}
      >
        {selected ? (
          <>
            <span className="pointer-events-none absolute -left-[3px] -top-[3px] h-3 w-3 border-l-[3px] border-t-[3px] border-inherit" />
            <span className="pointer-events-none absolute -right-[3px] -top-[3px] h-3 w-3 border-r-[3px] border-t-[3px] border-inherit" />
            <span className="pointer-events-none absolute -bottom-[3px] -left-[3px] h-3 w-3 border-b-[3px] border-l-[3px] border-inherit" />
            <span className="pointer-events-none absolute -bottom-[3px] -right-[3px] h-3 w-3 border-b-[3px] border-r-[3px] border-inherit" />
          </>
        ) : null}
        <span className="inline-flex max-w-full items-center gap-1 truncate font-semibold tracking-wide select-none">
          {isText ? <Type size={12} className="shrink-0" /> : <ImageIcon size={12} className="shrink-0" />}
          <span className="truncate">{getAnnotationLabel(annotation)}</span>
        </span>
      </motion.button>

      <motion.div
        className="group absolute inset-y-0 left-0 z-30 flex w-4 cursor-col-resize items-center justify-center"
        style={{ touchAction: 'pan-x' }}
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        onPanStart={() => {
          initialResizeStartRef.current = annotation.start;
          onDragStart();
        }}
        onPan={(_event: Event, info: PanInfo) => {
          const deltaSeconds = info.offset.x / pixelsPerSecond;
          onResizeStart(Math.max(0, initialResizeStartRef.current + deltaSeconds));
        }}
        onPanEnd={() => {
          onResizeStartEnd();
          onDragEnd();
        }}
      />

      <motion.div
        className="group absolute inset-y-0 right-0 z-30 flex w-4 cursor-col-resize items-center justify-center"
        style={{ touchAction: 'pan-x' }}
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        onPanStart={() => {
          initialDurationRef.current = annotation.duration;
          onDragStart();
        }}
        onPan={(_event: Event, info: PanInfo) => {
          const deltaSeconds = info.offset.x / pixelsPerSecond;
          onResize(initialDurationRef.current + deltaSeconds);
        }}
        onPanEnd={() => {
          onResizeEnd();
          onDragEnd();
        }}
      />

      {selected ? (
        <div className="absolute -right-11 top-1/2 z-40 flex -translate-y-1/2 flex-col gap-1.5 sm:-right-9 sm:gap-1">
          <button
            type="button"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onLayerMove('up');
            }}
            disabled={!canMoveUp}
            className="inline-flex h-8 w-8 touch-manipulation items-center justify-center rounded-md border border-slate-400/90 bg-slate-900/95 text-slate-100 shadow-lg transition hover:border-cyan-300/80 hover:text-cyan-100 disabled:opacity-30 sm:h-6 sm:w-6"
            aria-label={layerUpLabel}
          >
            <ChevronUp size={14} className="sm:h-3 sm:w-3" />
          </button>
          <button
            type="button"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onLayerMove('down');
            }}
            disabled={!canMoveDown}
            className="inline-flex h-8 w-8 touch-manipulation items-center justify-center rounded-md border border-slate-400/90 bg-slate-900/95 text-slate-100 shadow-lg transition hover:border-cyan-300/80 hover:text-cyan-100 disabled:opacity-30 sm:h-6 sm:w-6"
            aria-label={layerDownLabel}
          >
            <ChevronDown size={14} className="sm:h-3 sm:w-3" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
