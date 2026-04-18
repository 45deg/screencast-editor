import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';

import {
  type AnnotationModel,
  type CropRect,
  deriveAnnotations,
  deriveSlices,
  getTotalDuration,
  type SliceModel,
  type TimelineScrollInfo,
  type VideoMeta,
} from '../types/editor';
import EditorToolbar from './slice-editor/EditorToolbar';
import TimelinePlayhead from './slice-editor/TimelinePlayhead';
import TimelineRuler from './slice-editor/TimelineRuler';
import TimelineTracks from './slice-editor/TimelineTracks';
import { useSliceEditorHandlers } from './slice-editor/useSliceEditorHandlers';
import { useSliceEditorThumbnails } from './slice-editor/useSliceEditorThumbnails';

const BASE_PIXELS_PER_SECOND = 60;

interface SliceEditorProps {
  video: VideoMeta;
  slices: SliceModel[];
  annotations: AnnotationModel[];
  baseCrop: CropRect;
  outputAspectRatio: number;
  currentTime: number;
  selectedSliceId: string | null;
  selectedAnnotationId: string | null;
  canStartSceneCrop: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onCurrentTimeChange: (time: number) => void;
  onSelectedSliceIdChange: (id: string | null) => void;
  onSelectedAnnotationIdChange: (id: string | null) => void;
  onStartSceneCrop: () => void;
  onSlicesPreview: (slices: SliceModel[]) => void;
  onSlicesCommit: (slices: SliceModel[], selectedSliceId?: string | null) => void;
  onAnnotationsPreview: (annotations: AnnotationModel[]) => void;
  onAnnotationsCommit: (annotations: AnnotationModel[], selectedAnnotationId?: string | null) => void;
  onCreateTextAnnotation: () => void;
  onCreateImageAnnotation: (file: File) => void;
  onUndo: () => void;
  onRedo: () => void;
  className?: string;
  fillHeight?: boolean;
}

export default function SliceEditorTimeline({
  video,
  slices,
  annotations,
  baseCrop,
  outputAspectRatio,
  currentTime,
  selectedSliceId,
  selectedAnnotationId,
  canStartSceneCrop,
  canUndo,
  canRedo,
  onCurrentTimeChange,
  onSelectedSliceIdChange,
  onSelectedAnnotationIdChange,
  onStartSceneCrop,
  onSlicesPreview,
  onSlicesCommit,
  onAnnotationsPreview,
  onAnnotationsCommit,
  onCreateTextAnnotation,
  onCreateImageAnnotation,
  onUndo,
  onRedo,
  className,
  fillHeight = false,
}: SliceEditorProps) {
  const [zoomSlider, setZoomSlider] = useState(0);
  const zoom = useMemo(() => Math.pow(2, zoomSlider), [zoomSlider]);
  const pixelsPerSecond = BASE_PIXELS_PER_SECOND * zoom;
  const totalDuration = useMemo(() => getTotalDuration(slices, annotations), [annotations, slices]);
  const slicesWithPos = useMemo(() => deriveSlices(slices), [slices]);
  const annotationsWithPos = useMemo(() => deriveAnnotations(annotations), [annotations]);
  const selectedSlice = useMemo(
    () => slicesWithPos.find((slice) => slice.id === selectedSliceId),
    [slicesWithPos, selectedSliceId],
  );

  const safeOutputAspectRatio = useMemo(
    () => (Number.isFinite(outputAspectRatio) && outputAspectRatio > 0 ? outputAspectRatio : 16 / 9),
    [outputAspectRatio],
  );
  const thumbnailWidth = 240;
  const thumbnailHeight = useMemo(
    () => Math.max(1, Math.round(thumbnailWidth / safeOutputAspectRatio)),
    [safeOutputAspectRatio],
  );
  const thumbnailUrls = useSliceEditorThumbnails({
    slicesWithPos,
    videoObjectUrl: video.objectUrl,
    baseCrop,
    thumbnailWidth,
    thumbnailHeight,
  });

  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollInfo, setScrollInfo] = useState<TimelineScrollInfo>({ left: 0, width: 1000 });

  useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) {
      return;
    }

    const update = () => {
      setScrollInfo({ left: element.scrollLeft, width: element.clientWidth });
    };

    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener('scroll', update);
    update();

    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', update);
    };
  }, []);

  const {
    imageInputRef,
    canMoveAnnotationUp,
    canMoveAnnotationDown,
    draggingAnnotationId,
    handleCut,
    handleDeleteSelected,
    handleSpeedValueChange,
    handleSpeedValueCommit,
    handleResizeSlice,
    handleResizeSliceEnd,
    handleMoveSlice,
    handleMoveSliceEnd,
    handleMoveAnnotation,
    handleMoveAnnotationEnd,
    handleResizeAnnotation,
    handleResizeAnnotationEnd,
    handleMoveAnnotationLayer,
    handleAnnotationDragStart,
    handleAnnotationDragEnd,
    handleTimelinePointerDown,
    handleTimelinePan,
    triggerImageInput,
    handleImageInputChange,
  } = useSliceEditorHandlers({
    slices,
    slicesWithPos,
    annotations,
    annotationsWithPos,
    currentTime,
    totalDuration,
    pixelsPerSecond,
    selectedSliceId,
    selectedAnnotationId,
    timelineRef,
    onCurrentTimeChange,
    onSelectedSliceIdChange,
    onSelectedAnnotationIdChange,
    onSlicesPreview,
    onSlicesCommit,
    onAnnotationsPreview,
    onAnnotationsCommit,
    onCreateImageAnnotation,
    onUndo,
    onRedo,
  });

  return (
    <section
      className={`relative z-10 flex w-full shrink-0 select-none flex-col overflow-hidden rounded-lg border border-slate-800/70 bg-slate-950 shadow-xl ${fillHeight ? 'min-h-0 h-full' : 'h-[320px] sm:h-[360px]'} ${className ?? ''}`}
    >
      <EditorToolbar
        undo={onUndo}
        redo={onRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onSceneCrop={onStartSceneCrop}
        canSceneCrop={canStartSceneCrop}
        onCut={handleCut}
        canCut={slices.length > 0}
        onDelete={handleDeleteSelected}
        canDelete={selectedSliceId !== null || selectedAnnotationId !== null}
        onAddTextLayer={onCreateTextAnnotation}
        onAddImageLayer={triggerImageInput}
        selectedSlice={selectedSlice}
        onSpeedValueChange={handleSpeedValueChange}
        onSpeedValueCommit={handleSpeedValueCommit}
        zoomSlider={zoomSlider}
        setZoomSlider={setZoomSlider}
        zoom={zoom}
      />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageInputChange}
      />

      <div ref={scrollContainerRef} className="timeline-scrollbar relative flex-1 overflow-auto bg-slate-950">
        <motion.div
          ref={timelineRef}
          className="relative min-h-full cursor-text select-none"
          style={{
            width: `${Math.max(10, totalDuration) * pixelsPerSecond}px`,
            minWidth: '100%',
            minHeight: '250px',
            touchAction: 'pan-y',
          }}
          onPointerDown={handleTimelinePointerDown}
          onPan={handleTimelinePan}
        >
          <TimelineRuler totalDuration={totalDuration} pixelsPerSecond={pixelsPerSecond} />

          <TimelineTracks
            slicesWithPos={slicesWithPos}
            annotationsWithPos={annotationsWithPos}
            selectedSliceId={selectedSliceId}
            selectedAnnotationId={selectedAnnotationId}
            setSelectedSliceId={onSelectedSliceIdChange}
            setSelectedAnnotationId={onSelectedAnnotationIdChange}
            pixelsPerSecond={pixelsPerSecond}
            scrollInfo={scrollInfo}
            thumbnailUrls={thumbnailUrls}
            outputAspectRatio={safeOutputAspectRatio}
            onResizeSlice={handleResizeSlice}
            onResizeSliceEnd={handleResizeSliceEnd}
            onMoveSlice={handleMoveSlice}
            onMoveSliceEnd={handleMoveSliceEnd}
            onMoveAnnotation={handleMoveAnnotation}
            onMoveAnnotationEnd={handleMoveAnnotationEnd}
            onResizeAnnotation={handleResizeAnnotation}
            onResizeAnnotationEnd={handleResizeAnnotationEnd}
            onMoveAnnotationLayer={handleMoveAnnotationLayer}
            canMoveAnnotationUp={canMoveAnnotationUp}
            canMoveAnnotationDown={canMoveAnnotationDown}
            draggingAnnotationId={draggingAnnotationId}
            onAnnotationDragStart={handleAnnotationDragStart}
            onAnnotationDragEnd={handleAnnotationDragEnd}
          />

          <TimelinePlayhead currentTime={currentTime} pixelsPerSecond={pixelsPerSecond} />
        </motion.div>
      </div>
    </section>
  );
}
