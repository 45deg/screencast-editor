import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Slider } from '@base-ui/react/slider';
import { motion, type PanInfo } from 'framer-motion';
import { FastForward, Redo2, Scissors, Trash2, Undo2, ZoomIn } from 'lucide-react';

import { captureVideoThumbnail } from '../lib/videoThumbnail';
import {
  type CropRect,
  deriveSlices,
  getTotalDuration,
  type DerivedSlice,
  type SliceModel,
  type TimelineScrollInfo,
  type VideoMeta,
} from '../types/editor';

const BASE_PIXELS_PER_SECOND = 60;
const MIN_SLICE_DURATION = 0.5;

interface SliceEditorProps {
  video: VideoMeta;
  slices: SliceModel[];
  baseCrop: CropRect;
  outputAspectRatio: number;
  currentTime: number;
  selectedSliceId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  onCurrentTimeChange: (time: number) => void;
  onSelectedSliceIdChange: (id: string | null) => void;
  onSlicesPreview: (slices: SliceModel[]) => void;
  onSlicesCommit: (slices: SliceModel[], selectedSliceId?: string | null) => void;
  onUndo: () => void;
  onRedo: () => void;
}

interface ToolbarProps {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onCut: () => void;
  canCut: boolean;
  onDelete: () => void;
  canDelete: boolean;
  selectedSlice: DerivedSlice | undefined;
  onSpeedChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onSpeedChangeEnd: () => void;
  zoomSlider: number;
  setZoomSlider: (val: number) => void;
  zoom: number;
  currentTime: number;
  totalDuration: number;
}

function Toolbar({
  undo,
  redo,
  canUndo,
  canRedo,
  onCut,
  canCut,
  onDelete,
  canDelete,
  selectedSlice,
  onSpeedChange,
  onSpeedChangeEnd,
  zoomSlider,
  setZoomSlider,
  zoom,
  currentTime,
  totalDuration,
}: ToolbarProps) {
  return (
    <div className="h-14 border-b border-slate-800/80 bg-slate-950/95 px-2 shadow-sm sm:px-4">
      <div className="timeline-scrollbar flex h-full items-center gap-2 overflow-x-auto overflow-y-hidden">
        <div className="flex min-w-max items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950 p-1">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={16} />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 size={16} />
            </button>
          </div>

          <div className="h-5 w-px bg-slate-700" />

          <button
            type="button"
            onClick={onCut}
            disabled={!canCut}
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-cyan-200 transition-colors hover:bg-cyan-500/15 hover:text-white disabled:opacity-30 sm:gap-1.5 sm:px-2.5 sm:text-xs"
            title="Cut at playhead"
          >
            <Scissors size={16} />
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={!canDelete}
            className="rounded p-1.5 text-rose-300 transition-colors hover:bg-rose-500/15 hover:text-rose-200 disabled:opacity-30"
            title="Delete selected slice (Del)"
          >
            <Trash2 size={16} />
          </button>

          <div className="h-5 w-px bg-slate-700" />

          <div className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950 px-2 py-1 sm:gap-2 sm:px-3">
            <FastForward size={14} className="text-slate-400" />
            <span className="text-[10px] text-slate-500 sm:text-xs">x</span>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={selectedSlice ? Number(selectedSlice.speed.toFixed(2)) : ''}
              onChange={onSpeedChange}
              onBlur={onSpeedChangeEnd}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  onSpeedChangeEnd();
                }
              }}
              disabled={!selectedSlice}
              className="w-12 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-sm text-white outline-none transition-colors focus:border-cyan-500 disabled:opacity-30 sm:w-16 sm:px-2 sm:py-1 sm:text-xs"
              placeholder="1.0"
            />
          </div>

          <div className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950 px-2 py-1 sm:gap-2 sm:px-3">
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
              className="w-14 sm:w-20"
            >
              <Slider.Control className="relative flex h-4 w-full items-center">
                <Slider.Track className="relative h-1.5 w-full rounded-full bg-slate-700">
                  <Slider.Indicator className="absolute h-full rounded-full bg-cyan-500" />
                </Slider.Track>
                <Slider.Thumb
                  className="block h-3 w-3 rounded-full border border-cyan-100 bg-cyan-400 shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
                  title={`Timeline zoom (${zoom.toFixed(2)}x)`}
                />
              </Slider.Control>
            </Slider.Root>
          </div>
        </div>

        <div className="ml-auto flex min-w-max shrink-0 flex-col items-end">
          <div className="rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] text-cyan-200">
            frame={Math.floor(currentTime * 30)
              .toString()
              .padStart(5, '0')}
          </div>
          <div className="mt-0.5 font-mono text-[10px] tracking-wider text-slate-500">
            <span className="text-slate-200">{currentTime.toFixed(2)}s</span> / {totalDuration.toFixed(2)}s
          </div>
        </div>
      </div>
    </div>
  );
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

interface SliceTrackProps {
  slicesWithPos: DerivedSlice[];
  selectedSliceId: string | null;
  setSelectedSliceId: (id: string | null) => void;
  pixelsPerSecond: number;
  scrollInfo: TimelineScrollInfo;
  thumbnailUrls: Record<string, string>;
  outputAspectRatio: number;
  onResize: (sliceId: string, newDuration: number) => void;
  onResizeEnd: () => void;
}

function SliceTrack({
  slicesWithPos,
  selectedSliceId,
  setSelectedSliceId,
  pixelsPerSecond,
  scrollInfo,
  thumbnailUrls,
  outputAspectRatio,
  onResize,
  onResizeEnd,
}: SliceTrackProps) {
  const initialDurationRef = useRef<number>(0);
  const safeOutputAspectRatio = Number.isFinite(outputAspectRatio) && outputAspectRatio > 0 ? outputAspectRatio : 16 / 9;

  return (
    <div className="absolute inset-x-0 bottom-10 top-10 border-y border-slate-800/70 bg-slate-900/40 shadow-inner">
      {slicesWithPos.map((slice, index) => {
        const isSelected = slice.id === selectedSliceId;
        const isOpeningScene = index === 0;
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
            <div
              role="button"
              tabIndex={0}
              className={`absolute inset-y-0 cursor-pointer overflow-hidden transition-colors ${
                isSelected
                  ? 'z-20 border-[3px] border-amber-300 bg-cyan-600'
                  : 'z-10 border border-cyan-500 bg-cyan-800 hover:bg-cyan-700'
              }`}
              style={{
                left: `${startPx}px`,
                width: `${slice.duration * pixelsPerSecond}px`,
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                setSelectedSliceId(slice.id);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedSliceId(slice.id);
                }
              }}
            >
              {isVisible ? (
                <div
                  className={`pointer-events-none absolute inset-y-0 flex w-max -translate-x-1/2 flex-col gap-1 px-1.5 py-2 ${
                    isOpeningScene ? 'items-start' : 'items-center'
                  }`}
                  style={{ left: `${labelOffset}px` }}
                >
                  <div
                    className={`w-[118px] max-w-[calc(100%-4px)] overflow-hidden rounded-md border border-slate-700 bg-slate-950/85 shadow-lg ${
                      isOpeningScene ? 'self-start' : ''
                    }`}
                    style={{ aspectRatio: `${safeOutputAspectRatio} / 1` }}
                  >
                    {thumbnailUrl ? (
                      <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="h-full w-full animate-pulse bg-slate-800/70" />
                    )}
                  </div>
                  <div
                    className={`text-sm font-bold tracking-wider text-white drop-shadow ${
                      isOpeningScene ? 'self-start text-left' : 'text-center'
                    }`}
                  >
                    Scene#{index + 1}
                  </div>
                  <div
                    className={`font-mono text-[10px] leading-tight text-cyan-100 drop-shadow ${
                      isOpeningScene ? 'self-start text-left' : 'text-center'
                    }`}
                  >
                    <span className="text-white">{slice.duration.toFixed(1)}s</span>
                    <br />
                    <span className="text-amber-200">x{slice.speed.toFixed(2)}</span>
                  </div>
                </div>
              ) : null}
            </div>

            <motion.div
              className="group absolute inset-y-0 z-30 -ml-2 flex w-4 cursor-col-resize items-center justify-center"
              style={{ left: `${endPx}px`, touchAction: 'none' }}
              onPointerDown={(event) => event.stopPropagation()}
              onPanStart={() => {
                initialDurationRef.current = slice.duration;
              }}
              onPan={(_, info) => {
                const deltaSeconds = info.offset.x / pixelsPerSecond;
                onResize(slice.id, initialDurationRef.current + deltaSeconds);
              }}
              onPanEnd={onResizeEnd}
            >
              <div className="h-full w-1.5 bg-black/10 transition-colors group-hover:bg-amber-300/80" />
            </motion.div>
          </div>
        );
      })}
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

export default function SliceEditorTimeline({
  video,
  slices,
  baseCrop,
  outputAspectRatio,
  currentTime,
  selectedSliceId,
  canUndo,
  canRedo,
  onCurrentTimeChange,
  onSelectedSliceIdChange,
  onSlicesPreview,
  onSlicesCommit,
  onUndo,
  onRedo,
}: SliceEditorProps) {
  const [zoomSlider, setZoomSlider] = useState(0);
  const zoom = useMemo(() => Math.pow(2, zoomSlider), [zoomSlider]);
  const pixelsPerSecond = BASE_PIXELS_PER_SECOND * zoom;
  const totalDuration = useMemo(() => getTotalDuration(slices), [slices]);
  const slicesWithPos = useMemo(() => deriveSlices(slices), [slices]);
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
  const pendingCommitRef = useRef<SliceModel[] | null>(null);
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
      if (!pendingCommitRef.current) {
        return;
      }

      onSlicesCommit(pendingCommitRef.current, nextSelectedId);
      pendingCommitRef.current = null;
    },
    [onSlicesCommit],
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

      if (slicesWithPos.length && time >= totalDuration) {
        return slicesWithPos[slicesWithPos.length - 1].id;
      }

      return null;
    },
    [slicesWithPos, totalDuration],
  );

  const handleCut = useCallback(() => {
    const targetIndex = slicesWithPos.findIndex((slice) => currentTime > slice.start && currentTime < slice.end);
    if (targetIndex === -1) {
      return;
    }

    const target = slicesWithPos[targetIndex];
    const leftDuration = currentTime - target.start;
    const rightDuration = target.end - currentTime;
    if (leftDuration < MIN_SLICE_DURATION || rightDuration < MIN_SLICE_DURATION) {
      return;
    }

    const ratio = leftDuration / target.duration;
    const splitSource = target.sourceStart + target.sourceDuration * ratio;

    const leftSlice: SliceModel = {
      id: crypto.randomUUID(),
      sourceStart: target.sourceStart,
      sourceEnd: splitSource,
      duration: leftDuration,
      crop: target.crop ? { ...target.crop } : null,
    };
    const rightSlice: SliceModel = {
      id: crypto.randomUUID(),
      sourceStart: splitSource,
      sourceEnd: target.sourceEnd,
      duration: rightDuration,
      crop: target.crop ? { ...target.crop } : null,
    };

    const nextSlices = [...slices];
    nextSlices.splice(targetIndex, 1, leftSlice, rightSlice);
    onSlicesCommit(nextSlices, rightSlice.id);
  }, [currentTime, onSlicesCommit, slices, slicesWithPos]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedSliceId) {
      return;
    }

    const nextSlices = slices.filter((slice) => slice.id !== selectedSliceId);
    onSlicesCommit(nextSlices, null);
  }, [onSlicesCommit, selectedSliceId, slices]);

  const handleSpeedChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (!selectedSliceId) {
        return;
      }

      const nextSpeed = Number.parseFloat(event.target.value);
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

      pendingCommitRef.current = updated;
      onSlicesPreview(updated);
    },
    [onSlicesPreview, selectedSliceId, slices],
  );

  const handleSpeedChangeEnd = useCallback(() => {
    commitPendingSlices();
  }, [commitPendingSlices]);

  const handleResize = useCallback(
    (sliceId: string, newDuration: number) => {
      const clamped = Math.max(MIN_SLICE_DURATION, newDuration);
      const updated = updateSliceDuration(slices, sliceId, clamped);
      pendingCommitRef.current = updated;
      onSlicesPreview(updated);
    },
    [onSlicesPreview, slices],
  );

  const handleResizeEnd = useCallback(() => {
    commitPendingSlices();
  }, [commitPendingSlices]);

  const handleTimelinePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.target as Element;
      const nextTime = updateTimeFromClientX(event.clientX);

      if (event.target === event.currentTarget || target.id === 'ruler') {
        onSelectedSliceIdChange(getSliceIdAtTime(nextTime));
      }
    },
    [getSliceIdAtTime, onSelectedSliceIdChange, updateTimeFromClientX],
  );

  const handleTimelinePan = useCallback(
    (_: Event, info: PanInfo) => {
      updateTimeFromClientX(info.point.x);
    },
    [updateTimeFromClientX],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName ?? '';
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedSliceId) {
        event.preventDefault();
        handleDeleteSelected();
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
  }, [handleDeleteSelected, onRedo, onUndo, selectedSliceId]);

  return (
    <section className="relative z-10 flex h-[240px] w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950 shadow-xl sm:h-[280px]">
      <Toolbar
        undo={onUndo}
        redo={onRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onCut={handleCut}
        canCut={slices.length > 0}
        onDelete={handleDeleteSelected}
        canDelete={selectedSliceId !== null}
        selectedSlice={selectedSlice}
        onSpeedChange={handleSpeedChange}
        onSpeedChangeEnd={handleSpeedChangeEnd}
        zoomSlider={zoomSlider}
        setZoomSlider={setZoomSlider}
        zoom={zoom}
        currentTime={currentTime}
        totalDuration={totalDuration}
      />

      <div ref={scrollContainerRef} className="timeline-scrollbar relative flex-1 overflow-x-auto overflow-y-hidden bg-slate-950">
        <motion.div
          ref={timelineRef}
          className="relative min-h-full cursor-text"
          style={{
            width: `${Math.max(10, totalDuration) * pixelsPerSecond}px`,
            minWidth: '100%',
            touchAction: 'pan-y',
          }}
          onPointerDown={handleTimelinePointerDown}
          onPan={handleTimelinePan}
        >
          <TimelineRuler totalDuration={totalDuration} pixelsPerSecond={pixelsPerSecond} />

          <SliceTrack
            slicesWithPos={slicesWithPos}
            selectedSliceId={selectedSliceId}
            setSelectedSliceId={onSelectedSliceIdChange}
            pixelsPerSecond={pixelsPerSecond}
            scrollInfo={scrollInfo}
            thumbnailUrls={thumbnailUrls}
            outputAspectRatio={safeOutputAspectRatio}
            onResize={handleResize}
            onResizeEnd={handleResizeEnd}
          />

          <Playhead currentTime={currentTime} pixelsPerSecond={pixelsPerSecond} />
        </motion.div>
      </div>
    </section>
  );
}
