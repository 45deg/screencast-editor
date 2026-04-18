import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { motion, type PanInfo } from 'framer-motion';

import { captureVideoThumbnail } from '../lib/videoThumbnail';
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
import TimelineTracks from './slice-editor/TimelineTracks';

const BASE_PIXELS_PER_SECOND = 60;
const MIN_SLICE_DURATION = 0.5;

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

interface TimelineRulerProps {
  totalDuration: number;
  pixelsPerSecond: number;
}

function TimelineRuler({ totalDuration, pixelsPerSecond }: TimelineRulerProps) {
  const markers = useMemo(() => {
    const targetPx = 80;
    const rawInterval = targetPx / pixelsPerSecond;
    const steps = [1, 2, 5, 10, 30, 60, 120, 300, 600, 1800, 3600];
    const interval = steps.find((step) => rawInterval <= step) ?? steps[steps.length - 1];

    let subInterval = interval;
    if (interval >= 60) {
      subInterval = interval / 6;
    } else if (interval === 30) {
      subInterval = 5;
    } else if (interval === 10) {
      subInterval = 2;
    } else if (interval === 5 || interval === 2) {
      subInterval = 1;
    }

    const maxTime = Math.max(10, Math.ceil(totalDuration) + interval);
    const items: ReactNode[] = [];

    for (let time = 0; time <= maxTime; time += subInterval) {
      const isLabel = time % interval === 0;
      items.push(
        <div
          key={time}
          className={`absolute top-0 flex h-full flex-col justify-end border-l pb-0.5 pl-1 font-mono text-[9px] ${
            isLabel ? 'border-slate-500 text-slate-400' : 'border-slate-800 text-slate-700'
          }`}
          style={{ left: `${time * pixelsPerSecond}px` }}
        >
          {isLabel ? `${time}s` : ''}
        </div>,
      );
    }

    return items;
  }, [totalDuration, pixelsPerSecond]);

  return (
    <div id="ruler" className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 border-b border-slate-800 bg-slate-950/90">
      {markers}
    </div>
  );
}

interface PlayheadProps {
  currentTime: number;
  pixelsPerSecond: number;
}

function Playhead({ currentTime, pixelsPerSecond }: PlayheadProps) {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 z-40 w-[1.5px] bg-rose-500"
      style={{ left: `${currentTime * pixelsPerSecond}px` }}
    >
      <div className="absolute left-1/2 top-0 flex h-3 w-3 -translate-x-1/2 items-center justify-center rounded-b-sm bg-rose-500 shadow-md">
        <div className="mt-0.5 h-0 w-0 border-l-[3px] border-r-[3px] border-t-[4px] border-l-transparent border-r-transparent border-t-white" />
      </div>
    </div>
  );
}

function updateSliceDuration(slices: SliceModel[], sliceId: string, duration: number): SliceModel[] {
  return slices.map((slice) => {
    if (slice.id !== sliceId) {
      return slice;
    }

    return {
      ...slice,
      duration,
    };
  });
}

function updateSliceStart(slices: SliceModel[], sliceId: string, timelineStart: number): SliceModel[] {
  return slices.map((slice) => {
    if (slice.id !== sliceId) {
      return slice;
    }

    return {
      ...slice,
      timelineStart,
    };
  });
}

function updateAnnotationStart(annotations: AnnotationModel[], annotationId: string, start: number): AnnotationModel[] {
  return annotations.map((annotation) => {
    if (annotation.id !== annotationId) {
      return annotation;
    }

    return {
      ...annotation,
      start,
    };
  });
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
  const imageInputRef = useRef<HTMLInputElement>(null);
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

  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    const generateThumbnails = async () => {
      await Promise.resolve();

      if (cancelled) {
        return;
      }

      setThumbnailUrls({});
      const nextThumbnailUrls: Record<string, string> = {};

      for (const slice of slicesWithPos) {
        try {
          const thumbnailUrl = await captureVideoThumbnail({
            videoUrl: video.objectUrl,
            time: slice.sourceStart,
            width: thumbnailWidth,
            height: thumbnailHeight,
            baseCrop,
            sceneCrop: slice.crop,
          });

          if (cancelled) {
            return;
          }

          nextThumbnailUrls[slice.id] = thumbnailUrl;
          setThumbnailUrls({ ...nextThumbnailUrls });
          await new Promise<void>((resolve) => {
            window.requestAnimationFrame(() => resolve());
          });
        } catch {
          if (cancelled) {
            return;
          }
        }
      }
    };

    void generateThumbnails();

    return () => {
      cancelled = true;
    };
  }, [baseCrop, slicesWithPos, thumbnailHeight, video.objectUrl]);

  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pendingSliceCommitRef = useRef<SliceModel[] | null>(null);
  const pendingAnnotationCommitRef = useRef<AnnotationModel[] | null>(null);
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

  const commitPendingSlices = useCallback(
    (nextSelectedId?: string | null) => {
      if (!pendingSliceCommitRef.current) {
        return;
      }

      onSlicesCommit(pendingSliceCommitRef.current, nextSelectedId);
      pendingSliceCommitRef.current = null;
    },
    [onSlicesCommit],
  );

  const commitPendingAnnotations = useCallback(
    (nextSelectedId?: string | null) => {
      if (!pendingAnnotationCommitRef.current) {
        return;
      }

      onAnnotationsCommit(pendingAnnotationCommitRef.current, nextSelectedId);
      pendingAnnotationCommitRef.current = null;
    },
    [onAnnotationsCommit],
  );

  const updateTimeFromClientX = useCallback(
    (clientX: number) => {
      const element = timelineRef.current;
      if (!element) {
        return currentTime;
      }

      const rect = element.getBoundingClientRect();
      const x = clientX - rect.left;
      const nextTime = Math.max(0, Math.min(totalDuration, x / pixelsPerSecond));
      onCurrentTimeChange(nextTime);
      return nextTime;
    },
    [currentTime, onCurrentTimeChange, pixelsPerSecond, totalDuration],
  );

  const getSliceIdAtTime = useCallback(
    (time: number): string | null => {
      const hit = slicesWithPos.find((slice) => time >= slice.start && time < slice.end);
      if (hit) {
        return hit.id;
      }

      return null;
    },
    [slicesWithPos],
  );

  const getAnnotationIdAtTime = useCallback(
    (time: number): string | null => {
      const active = annotationsWithPos.filter((annotation) => time >= annotation.start && time < annotation.end);
      if (!active.length) {
        return null;
      }

      return active[active.length - 1]?.id ?? null;
    },
    [annotationsWithPos],
  );

  const handleCut = useCallback(() => {
    const target = slicesWithPos.find((slice) => currentTime > slice.start && currentTime < slice.end);
    if (!target) {
      return;
    }

    const targetIndex = slices.findIndex((slice) => slice.id === target.id);
    if (targetIndex < 0) {
      return;
    }

    const leftDuration = currentTime - target.start;
    const rightDuration = target.end - currentTime;
    if (leftDuration < MIN_SLICE_DURATION || rightDuration < MIN_SLICE_DURATION) {
      return;
    }

    const ratio = leftDuration / target.duration;
    const splitSource = target.sourceStart + target.sourceDuration * ratio;

    const leftSlice: SliceModel = {
      id: crypto.randomUUID(),
      timelineStart: target.start,
      sourceStart: target.sourceStart,
      sourceEnd: splitSource,
      duration: leftDuration,
      crop: target.crop ? { ...target.crop } : null,
    };
    const rightSlice: SliceModel = {
      id: crypto.randomUUID(),
      timelineStart: currentTime,
      sourceStart: splitSource,
      sourceEnd: target.sourceEnd,
      duration: rightDuration,
      crop: target.crop ? { ...target.crop } : null,
    };

    const nextSlices = [...slices];
    nextSlices.splice(targetIndex, 1, leftSlice, rightSlice);
    onSlicesCommit(nextSlices, rightSlice.id);
    onSelectedAnnotationIdChange(null);
  }, [currentTime, onSelectedAnnotationIdChange, onSlicesCommit, slices, slicesWithPos]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedAnnotationId) {
      const nextAnnotations = annotations.filter((annotation) => annotation.id !== selectedAnnotationId);
      onAnnotationsCommit(nextAnnotations, null);
      return;
    }

    if (selectedSliceId) {
      const nextSlices = slices.filter((slice) => slice.id !== selectedSliceId);
      onSlicesCommit(nextSlices, null);
    }
  }, [annotations, onAnnotationsCommit, onSlicesCommit, selectedAnnotationId, selectedSliceId, slices]);

  const handleSpeedValueChange = useCallback(
    (nextSpeed: number | null) => {
      if (!selectedSliceId || nextSpeed === null) {
        return;
      }

      if (!Number.isFinite(nextSpeed) || nextSpeed <= 0) {
        return;
      }

      const updated = slices.map((slice) => {
        if (slice.id !== selectedSliceId) {
          return slice;
        }

        const sourceDuration = slice.sourceEnd - slice.sourceStart;
        return {
          ...slice,
          duration: Math.max(MIN_SLICE_DURATION, sourceDuration / nextSpeed),
        };
      });

      pendingSliceCommitRef.current = updated;
      onSlicesPreview(updated);
    },
    [onSlicesPreview, selectedSliceId, slices],
  );

  const handleSpeedValueCommit = useCallback(() => {
    commitPendingSlices();
  }, [commitPendingSlices]);

  const handleResizeSlice = useCallback(
    (sliceId: string, newDuration: number) => {
      const clamped = Math.max(MIN_SLICE_DURATION, newDuration);
      const updated = updateSliceDuration(slices, sliceId, clamped);
      pendingSliceCommitRef.current = updated;
      onSlicesPreview(updated);
    },
    [onSlicesPreview, slices],
  );

  const handleResizeSliceEnd = useCallback(() => {
    commitPendingSlices();
  }, [commitPendingSlices]);

  const handleMoveSlice = useCallback(
    (sliceId: string, nextStart: number) => {
      const updated = updateSliceStart(slices, sliceId, nextStart);
      pendingSliceCommitRef.current = updated;
      onSlicesPreview(updated);
    },
    [onSlicesPreview, slices],
  );

  const handleMoveSliceEnd = useCallback(() => {
    commitPendingSlices();
  }, [commitPendingSlices]);

  const handleMoveAnnotation = useCallback(
    (annotationId: string, nextStart: number) => {
      const updated = updateAnnotationStart(annotations, annotationId, nextStart);
      pendingAnnotationCommitRef.current = updated;
      onAnnotationsPreview(updated);
    },
    [annotations, onAnnotationsPreview],
  );

  const handleMoveAnnotationEnd = useCallback(() => {
    commitPendingAnnotations();
  }, [commitPendingAnnotations]);

  const handleTimelinePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.target as Element;
      const nextTime = updateTimeFromClientX(event.clientX);

      if (event.target === event.currentTarget || target.id === 'ruler') {
        const hitAnnotation = getAnnotationIdAtTime(nextTime);
        if (hitAnnotation) {
          onSelectedSliceIdChange(null);
          onSelectedAnnotationIdChange(hitAnnotation);
          return;
        }

        const hitSlice = getSliceIdAtTime(nextTime);
        onSelectedAnnotationIdChange(null);
        onSelectedSliceIdChange(hitSlice);
      }
    },
    [
      getAnnotationIdAtTime,
      getSliceIdAtTime,
      onSelectedAnnotationIdChange,
      onSelectedSliceIdChange,
      updateTimeFromClientX,
    ],
  );

  const handleTimelinePan = useCallback(
    (_event: Event, info: PanInfo) => {
      updateTimeFromClientX(info.point.x);
    },
    [updateTimeFromClientX],
  );

  const triggerImageInput = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handleImageInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      if (!file || !file.type.startsWith('image/')) {
        event.target.value = '';
        return;
      }

      onCreateImageAnnotation(file);
      event.target.value = '';
    },
    [onCreateImageAnnotation],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName ?? '';
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedSliceId || selectedAnnotationId) {
          event.preventDefault();
          handleDeleteSelected();
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          onRedo();
        } else {
          onUndo();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handleDeleteSelected, onRedo, onUndo, selectedAnnotationId, selectedSliceId]);

  return (
    <section
      className={`relative z-10 flex w-full shrink-0 flex-col overflow-hidden rounded-lg border border-slate-800/70 bg-slate-950 shadow-xl ${fillHeight ? 'min-h-0 h-full' : 'h-[320px] sm:h-[360px]'} ${className ?? ''}`}
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

      <div ref={scrollContainerRef} className="timeline-scrollbar relative flex-1 overflow-x-auto overflow-y-hidden bg-slate-950">
        <motion.div
          ref={timelineRef}
          className="relative min-h-full cursor-text"
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
          />

          <Playhead currentTime={currentTime} pixelsPerSecond={pixelsPerSecond} />
        </motion.div>
      </div>

    </section>
  );
}
