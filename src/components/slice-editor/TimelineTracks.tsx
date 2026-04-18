import { useMemo, useRef } from 'react';
import { motion, type PanInfo } from 'framer-motion';
import { ChevronDown, ChevronUp, Crop, Image as ImageIcon, Type } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { buildUnifiedAnnotationLayout, type LayerMoveDirection } from '../../lib/annotationTimeline';
import type {
  DerivedAnnotation,
  DerivedSlice,
  TimelineScrollInfo,
} from '../../types/editor';

interface TimelineTracksProps {
  slicesWithPos: DerivedSlice[];
  annotationsWithPos: DerivedAnnotation[];
  selectedSliceId: string | null;
  selectedAnnotationId: string | null;
  setSelectedSliceId: (id: string | null) => void;
  setSelectedAnnotationId: (id: string | null) => void;
  pixelsPerSecond: number;
  scrollInfo: TimelineScrollInfo;
  thumbnailUrls: Record<string, string>;
  outputAspectRatio: number;
  onResizeSlice: (sliceId: string, newDuration: number) => void;
  onResizeSliceEnd: () => void;
  onMoveSlice: (sliceId: string, nextStart: number) => void;
  onMoveSliceEnd: () => void;
  onMoveAnnotation: (annotationId: string, nextStart: number) => void;
  onMoveAnnotationEnd: () => void;
  onResizeAnnotation: (annotationId: string, nextDuration: number) => void;
  onResizeAnnotationEnd: () => void;
  onMoveAnnotationLayer: (annotationId: string, direction: LayerMoveDirection) => void;
  canMoveAnnotationUp: boolean;
  canMoveAnnotationDown: boolean;
  draggingAnnotationId: string | null;
  onAnnotationDragStart: (annotationId: string) => void;
  onAnnotationDragEnd: () => void;
}

const VIDEO_TRACK_TOP = 28;
const VIDEO_TRACK_HEIGHT = 116;
const TRACK_GAP = 10;
const ANNOTATION_TRACK_PADDING = 6;
const ANNOTATION_ROW_HEIGHT = 30;
const ANNOTATION_ROW_GAP = 4;
const MIN_ANNOTATION_TRACK_HEIGHT = 40;
const MIN_ANNOTATION_BLOCK_WIDTH = 40;

function getAnnotationRowTop(row: number): number {
  return ANNOTATION_TRACK_PADDING + row * (ANNOTATION_ROW_HEIGHT + ANNOTATION_ROW_GAP);
}

function getAnnotationLabel(annotation: DerivedAnnotation): string {
  if (annotation.kind === 'text') {
    return annotation.text || 'Text';
  }

  return annotation.file.name;
}

function AnnotationLayerBlock({
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
  onResize,
  onResizeEnd,
  onLayerMove,
  onDragStart,
  onDragEnd,
}: {
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
  onResize: (nextDuration: number) => void;
  onResizeEnd: () => void;
  onLayerMove: (direction: LayerMoveDirection) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const initialStartRef = useRef(annotation.start);
  const initialDurationRef = useRef(annotation.duration);
  const isDragging = draggingAnnotationId === annotation.id;
  const isDragLocked = draggingAnnotationId !== null && !isDragging;
  const blockWidth = Math.max(MIN_ANNOTATION_BLOCK_WIDTH, annotation.duration * pixelsPerSecond);
  const isText = annotation.kind === 'text';

  const baseColorClass = isText
    ? 'border-rose-300/60 bg-rose-700/85 text-rose-50 hover:bg-rose-600/90'
    : 'border-amber-300/60 bg-amber-600/85 text-amber-50 hover:bg-amber-500/90';
  const selectedColorClass = isText
    ? 'border-rose-200 bg-rose-500/95 text-white'
    : 'border-amber-200 bg-amber-400/95 text-slate-950';

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
        className={`absolute inset-y-0 left-0 w-full rounded border px-2 pr-4 text-left text-xs transition ${
          selected ? selectedColorClass : baseColorClass
        }`}
        style={{ touchAction: 'none' }}
        onPointerDown={(event) => {
          event.stopPropagation();
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
        <span className="inline-flex max-w-full items-center gap-1 truncate font-semibold tracking-wide select-none">
          {isText ? <Type size={12} className="shrink-0" /> : <ImageIcon size={12} className="shrink-0" />}
          <span className="truncate">{getAnnotationLabel(annotation)}</span>
        </span>
      </motion.button>

      <motion.div
        className="group absolute inset-y-0 right-0 z-30 flex w-3 cursor-col-resize items-center justify-center"
        style={{ touchAction: 'none' }}
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
      >
        <div className="h-full w-1 bg-black/30 transition-colors group-hover:bg-cyan-200/90" />
      </motion.div>

      {selected ? (
        <div className="absolute -right-8 top-1/2 z-40 flex -translate-y-1/2 flex-col gap-1">
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
            className="inline-flex h-4 w-4 items-center justify-center rounded border border-slate-500/80 bg-slate-900/95 text-slate-100 transition hover:border-cyan-300/80 hover:text-cyan-100 disabled:opacity-30"
            aria-label={layerUpLabel}
          >
            <ChevronUp size={10} />
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
            className="inline-flex h-4 w-4 items-center justify-center rounded border border-slate-500/80 bg-slate-900/95 text-slate-100 transition hover:border-cyan-300/80 hover:text-cyan-100 disabled:opacity-30"
            aria-label={layerDownLabel}
          >
            <ChevronDown size={10} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function TimelineTracks({
  slicesWithPos,
  annotationsWithPos,
  selectedSliceId,
  selectedAnnotationId,
  setSelectedSliceId,
  setSelectedAnnotationId,
  pixelsPerSecond,
  scrollInfo,
  thumbnailUrls,
  outputAspectRatio,
  onResizeSlice,
  onResizeSliceEnd,
  onMoveSlice,
  onMoveSliceEnd,
  onMoveAnnotation,
  onMoveAnnotationEnd,
  onResizeAnnotation,
  onResizeAnnotationEnd,
  onMoveAnnotationLayer,
  canMoveAnnotationUp,
  canMoveAnnotationDown,
  draggingAnnotationId,
  onAnnotationDragStart,
  onAnnotationDragEnd,
}: TimelineTracksProps) {
  const { t } = useTranslation();
  const initialDurationRef = useRef<number>(0);
  const initialStartRef = useRef<number>(0);

  const safeOutputAspectRatio = Number.isFinite(outputAspectRatio) && outputAspectRatio > 0 ? outputAspectRatio : 16 / 9;
  const annotationTrackTop = VIDEO_TRACK_TOP + VIDEO_TRACK_HEIGHT + TRACK_GAP;
  const annotationLayout = useMemo(
    () => buildUnifiedAnnotationLayout(annotationsWithPos),
    [annotationsWithPos],
  );
  const annotationTrackHeight = Math.max(
    MIN_ANNOTATION_TRACK_HEIGHT,
    ANNOTATION_TRACK_PADDING * 2 +
      annotationLayout.rowCount * ANNOTATION_ROW_HEIGHT +
      Math.max(0, annotationLayout.rowCount - 1) * ANNOTATION_ROW_GAP,
  );
  const timelineHeight = annotationTrackTop + annotationTrackHeight + 12;

  return (
    <>
      <div aria-hidden className="pointer-events-none" style={{ height: `${timelineHeight}px` }} />

      <div
        className="absolute inset-x-0 border-y border-slate-800/70 bg-black/70"
        style={{
          top: `${VIDEO_TRACK_TOP}px`,
          height: `${VIDEO_TRACK_HEIGHT}px`,
        }}
      >
        {slicesWithPos.map((slice, index) => {
          const isSelected = slice.id === selectedSliceId;
          const thumbnailUrl = thumbnailUrls[slice.id];
          const startPx = slice.start * pixelsPerSecond;
          const endPx = slice.end * pixelsPerSecond;

          const visibleLeft = Math.max(scrollInfo.left, startPx);
          const visibleRight = Math.min(scrollInfo.left + scrollInfo.width, endPx);
          const isVisible = visibleLeft < visibleRight;
          const visibleCenter = (visibleLeft + visibleRight) / 2;
          const labelOffset = visibleCenter - startPx;

          return (
            <div key={slice.id} className="absolute inset-y-0">
              <motion.div
                role="button"
                tabIndex={0}
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
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setSelectedAnnotationId(null);
                  setSelectedSliceId(slice.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedAnnotationId(null);
                    setSelectedSliceId(slice.id);
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
                    className="pointer-events-none absolute inset-y-0 flex w-max -translate-x-1/2 flex-col items-center gap-1 px-1.5 py-2"
                    style={{ left: `${labelOffset}px` }}
                  >
                    <div
                      className="w-[118px] max-w-[calc(100%-4px)] overflow-hidden rounded-md border border-slate-700 bg-slate-950/85 shadow-lg"
                      style={{ aspectRatio: `${safeOutputAspectRatio} / 1` }}
                    >
                      {thumbnailUrl ? (
                        <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="h-full w-full animate-pulse bg-slate-800/70" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm font-bold tracking-wider text-white drop-shadow">
                      {slice.crop ? <Crop size={13} className="shrink-0 text-amber-200" /> : null}
                      {t('sliceEditor.sceneNumber', { index: index + 1 })}
                    </div>
                    <div className="font-mono text-[10px] leading-tight text-center text-cyan-100 drop-shadow">
                      <span className="text-white">{slice.duration.toFixed(1)}s</span>
                      <br />
                      <span className="text-amber-200">x{slice.speed.toFixed(2)}</span>
                    </div>
                  </div>
                ) : null}
              </motion.div>

              <motion.div
                className="group absolute inset-y-0 z-30 -ml-2 flex w-4 cursor-col-resize items-center justify-center"
                style={{ left: `${endPx}px`, touchAction: 'none' }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setSelectedAnnotationId(null);
                  setSelectedSliceId(slice.id);
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
        })}
      </div>

      <div
        className="absolute inset-x-0 border border-slate-700/70 bg-slate-900/35"
        style={{
          top: `${annotationTrackTop}px`,
          height: `${annotationTrackHeight}px`,
        }}
      >
        {annotationLayout.placements.map(({ annotation, row, zIndex }) => (
          <AnnotationLayerBlock
            key={annotation.id}
            annotation={annotation}
            pixelsPerSecond={pixelsPerSecond}
            row={row}
            zIndex={zIndex}
            selected={annotation.id === selectedAnnotationId}
            draggingAnnotationId={draggingAnnotationId}
            canMoveUp={annotation.id === selectedAnnotationId ? canMoveAnnotationUp : false}
            canMoveDown={annotation.id === selectedAnnotationId ? canMoveAnnotationDown : false}
            layerUpLabel={t('sliceEditor.layerUp')}
            layerDownLabel={t('sliceEditor.layerDown')}
            onSelect={() => {
              setSelectedSliceId(null);
              setSelectedAnnotationId(annotation.id);
            }}
            onMove={(nextStart) => onMoveAnnotation(annotation.id, nextStart)}
            onMoveEnd={onMoveAnnotationEnd}
            onResize={(nextDuration) => onResizeAnnotation(annotation.id, nextDuration)}
            onResizeEnd={onResizeAnnotationEnd}
            onLayerMove={(direction) => onMoveAnnotationLayer(annotation.id, direction)}
            onDragStart={() => onAnnotationDragStart(annotation.id)}
            onDragEnd={onAnnotationDragEnd}
          />
        ))}
      </div>
    </>
  );
}
