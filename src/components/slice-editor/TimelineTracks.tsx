import { useMemo, useRef } from 'react';
import { motion, type PanInfo } from 'framer-motion';
import { Crop, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type {
  DerivedAnnotation,
  DerivedSlice,
  ImageAnnotation,
  TextAnnotation,
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
}

const VIDEO_TRACK_TOP = 28;
const VIDEO_TRACK_HEIGHT = 116;
const TRACK_GAP = 10;
const ANNOTATION_TRACK_PADDING = 6;
const ANNOTATION_ROW_HEIGHT = 30;
const ANNOTATION_ROW_GAP = 4;
const MIN_ANNOTATION_TRACK_HEIGHT = 40;
const MIN_ANNOTATION_BLOCK_WIDTH = 40;
const OVERLAP_EPSILON = 0.0001;

interface AnnotationPlacement<T extends DerivedAnnotation> {
  annotation: T;
  row: number;
}

interface AnnotationTrackLayout<T extends DerivedAnnotation> {
  placements: AnnotationPlacement<T>[];
  rowCount: number;
  trackHeight: number;
}

function isTextAnnotation(annotation: DerivedAnnotation): annotation is DerivedAnnotation<TextAnnotation> {
  return annotation.kind === 'text';
}

function isImageAnnotation(annotation: DerivedAnnotation): annotation is DerivedAnnotation<ImageAnnotation> {
  return annotation.kind === 'image';
}

function buildAnnotationTrackLayout<T extends DerivedAnnotation>(annotations: T[]): AnnotationTrackLayout<T> {
  if (!annotations.length) {
    return {
      placements: [],
      rowCount: 1,
      trackHeight: MIN_ANNOTATION_TRACK_HEIGHT,
    };
  }

  const rows: Array<Array<{ start: number; end: number }>> = [];
  const rowById = new Map<string, number>();

  const prioritized = annotations
    .map((annotation, index) => ({ annotation, priority: index }))
    .sort((a, b) => b.priority - a.priority);

  for (const item of prioritized) {
    const { annotation } = item;
    let row = 0;

    while (true) {
      const segments = rows[row] ?? [];
      const overlaps = segments.some(
        (segment) =>
          annotation.start < segment.end - OVERLAP_EPSILON && segment.start < annotation.end - OVERLAP_EPSILON,
      );

      if (!overlaps) {
        break;
      }

      row += 1;
    }

    if (!rows[row]) {
      rows[row] = [];
    }

    rows[row].push({ start: annotation.start, end: annotation.end });
    rowById.set(annotation.id, row);
  }

  const rowCount = Math.max(1, rows.length);
  const trackHeight = Math.max(
    MIN_ANNOTATION_TRACK_HEIGHT,
    ANNOTATION_TRACK_PADDING * 2 + rowCount * ANNOTATION_ROW_HEIGHT + Math.max(0, rowCount - 1) * ANNOTATION_ROW_GAP,
  );

  return {
    placements: annotations.map((annotation) => ({
      annotation,
      row: rowById.get(annotation.id) ?? 0,
    })),
    rowCount,
    trackHeight,
  };
}

function getAnnotationRowTop(row: number): number {
  return ANNOTATION_TRACK_PADDING + row * (ANNOTATION_ROW_HEIGHT + ANNOTATION_ROW_GAP);
}

function TextLayerBlock({
  annotation,
  pixelsPerSecond,
  row,
  selected,
  onSelect,
  onMove,
  onMoveEnd,
}: {
  annotation: DerivedAnnotation<TextAnnotation>;
  pixelsPerSecond: number;
  row: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (nextStart: number) => void;
  onMoveEnd: () => void;
}) {
  const initialStartRef = useRef(annotation.start);

  return (
    <motion.button
      type="button"
      className={`absolute top-0 h-full rounded border px-2 text-left text-xs transition ${
        selected
          ? 'z-20 border-rose-200 bg-rose-500/95 text-white'
          : 'z-10 border-rose-300/60 bg-rose-700/85 text-rose-50 hover:bg-rose-600/90'
      }`}
      style={{
        left: `${annotation.start * pixelsPerSecond}px`,
        width: `${Math.max(MIN_ANNOTATION_BLOCK_WIDTH, annotation.duration * pixelsPerSecond)}px`,
        top: `${getAnnotationRowTop(row)}px`,
        height: `${ANNOTATION_ROW_HEIGHT}px`,
        touchAction: 'none',
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPanStart={() => {
        initialStartRef.current = annotation.start;
      }}
      onPan={(_event: Event, info: PanInfo) => {
        const nextStart = Math.max(0, initialStartRef.current + info.offset.x / pixelsPerSecond);
        onMove(nextStart);
      }}
      onPanEnd={onMoveEnd}
      title={annotation.text}
    >
      <span className="block truncate font-semibold tracking-wide">{annotation.text || 'Text'}</span>
    </motion.button>
  );
}

function ImageLayerBlock({
  annotation,
  pixelsPerSecond,
  row,
  selected,
  onSelect,
  onMove,
  onMoveEnd,
}: {
  annotation: DerivedAnnotation<ImageAnnotation>;
  pixelsPerSecond: number;
  row: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (nextStart: number) => void;
  onMoveEnd: () => void;
}) {
  const initialStartRef = useRef(annotation.start);

  return (
    <motion.button
      type="button"
      className={`absolute top-0 h-full rounded border px-2 text-left text-xs transition ${
        selected
          ? 'z-20 border-amber-200 bg-amber-400/95 text-slate-950'
          : 'z-10 border-amber-300/60 bg-amber-600/85 text-amber-50 hover:bg-amber-500/90'
      }`}
      style={{
        left: `${annotation.start * pixelsPerSecond}px`,
        width: `${Math.max(MIN_ANNOTATION_BLOCK_WIDTH, annotation.duration * pixelsPerSecond)}px`,
        top: `${getAnnotationRowTop(row)}px`,
        height: `${ANNOTATION_ROW_HEIGHT}px`,
        touchAction: 'none',
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPanStart={() => {
        initialStartRef.current = annotation.start;
      }}
      onPan={(_event: Event, info: PanInfo) => {
        const nextStart = Math.max(0, initialStartRef.current + info.offset.x / pixelsPerSecond);
        onMove(nextStart);
      }}
      onPanEnd={onMoveEnd}
      title={annotation.file.name}
    >
      <span className="inline-flex max-w-full items-center gap-1 truncate font-semibold tracking-wide">
        <ImageIcon size={12} className="shrink-0" />
        <span className="truncate">{annotation.file.name}</span>
      </span>
    </motion.button>
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
}: TimelineTracksProps) {
  const { t } = useTranslation();
  const initialDurationRef = useRef<number>(0);
  const initialStartRef = useRef<number>(0);

  const safeOutputAspectRatio = Number.isFinite(outputAspectRatio) && outputAspectRatio > 0 ? outputAspectRatio : 16 / 9;
  const textAnnotations = useMemo(() => annotationsWithPos.filter(isTextAnnotation), [annotationsWithPos]);
  const imageAnnotations = useMemo(() => annotationsWithPos.filter(isImageAnnotation), [annotationsWithPos]);
  const textTrackLayout = useMemo(() => buildAnnotationTrackLayout(textAnnotations), [textAnnotations]);
  const imageTrackLayout = useMemo(() => buildAnnotationTrackLayout(imageAnnotations), [imageAnnotations]);

  const textTrackTop = VIDEO_TRACK_TOP + VIDEO_TRACK_HEIGHT + TRACK_GAP;
  const imageTrackTop = textTrackTop + textTrackLayout.trackHeight + TRACK_GAP;
  const timelineHeight = imageTrackTop + imageTrackLayout.trackHeight + 12;

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
        className="absolute inset-x-0 border border-rose-950/60 bg-rose-950/35"
        style={{
          top: `${textTrackTop}px`,
          height: `${textTrackLayout.trackHeight}px`,
        }}
      >
        {textTrackLayout.placements.map(({ annotation, row }) => (
          <TextLayerBlock
            key={annotation.id}
            annotation={annotation}
            pixelsPerSecond={pixelsPerSecond}
            row={row}
            selected={annotation.id === selectedAnnotationId}
            onSelect={() => {
              setSelectedSliceId(null);
              setSelectedAnnotationId(annotation.id);
            }}
            onMove={(nextStart) => onMoveAnnotation(annotation.id, nextStart)}
            onMoveEnd={onMoveAnnotationEnd}
          />
        ))}
      </div>

      <div
        className="absolute inset-x-0 border border-amber-900/60 bg-amber-900/35"
        style={{
          top: `${imageTrackTop}px`,
          height: `${imageTrackLayout.trackHeight}px`,
        }}
      >
        {imageTrackLayout.placements.map(({ annotation, row }) => (
          <ImageLayerBlock
            key={annotation.id}
            annotation={annotation}
            pixelsPerSecond={pixelsPerSecond}
            row={row}
            selected={annotation.id === selectedAnnotationId}
            onSelect={() => {
              setSelectedSliceId(null);
              setSelectedAnnotationId(annotation.id);
            }}
            onMove={(nextStart) => onMoveAnnotation(annotation.id, nextStart)}
            onMoveEnd={onMoveAnnotationEnd}
          />
        ))}
      </div>
    </>
  );
}
