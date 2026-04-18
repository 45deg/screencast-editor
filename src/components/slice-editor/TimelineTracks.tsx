import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { buildUnifiedAnnotationLayout, type LayerMoveDirection } from '../../lib/annotationTimeline';
import type { DerivedAnnotation, DerivedSlice, TimelineScrollInfo } from '../../types/editor';
import AnnotationLayerBlock from './AnnotationLayerBlock';
import TimelineSliceBlock from './TimelineSliceBlock';
import {
  ANNOTATION_ROW_GAP,
  ANNOTATION_ROW_HEIGHT,
  ANNOTATION_TRACK_PADDING,
  MIN_ANNOTATION_TRACK_HEIGHT,
  TRACK_GAP,
  VIDEO_TRACK_HEIGHT,
  VIDEO_TRACK_TOP,
} from './timelineTracksConstants';

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
        {slicesWithPos.map((slice, index) => (
          <TimelineSliceBlock
            key={slice.id}
            slice={slice}
            index={index}
            isSelected={slice.id === selectedSliceId}
            pixelsPerSecond={pixelsPerSecond}
            scrollInfo={scrollInfo}
            thumbnailUrl={thumbnailUrls[slice.id]}
            outputAspectRatio={safeOutputAspectRatio}
            onSelect={() => {
              setSelectedAnnotationId(null);
              setSelectedSliceId(slice.id);
            }}
            onMoveSlice={onMoveSlice}
            onMoveSliceEnd={onMoveSliceEnd}
            onResizeSlice={onResizeSlice}
            onResizeSliceEnd={onResizeSliceEnd}
          />
        ))}
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
