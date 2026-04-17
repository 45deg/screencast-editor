import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Check, Clapperboard, Crop, Focus, RotateCcw, X } from 'lucide-react';

import type { CropRect, VideoMeta } from '../types/editor';

type DragMode = 'move' | 'n' | 's' | 'w' | 'e' | 'nw' | 'ne' | 'sw' | 'se';

interface CanvasPreviewProps {
  video: VideoMeta;
  currentTime: number;
  baseCrop: CropRect;
  activeSceneCrop: CropRect | null;
  editMode: 'idle' | 'crop' | 'scene';
  editCrop: CropRect | null;
  canStartSceneCrop: boolean;
  onStartCrop: () => void;
  onStartSceneCrop: () => void;
  onEditCropPreview: (crop: CropRect) => void;
  onConfirmEdit: () => void;
  onCancelEdit: () => void;
  onResetEdit: () => void;
}

interface ViewportInfo {
  scale: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

interface DragState {
  mode: DragMode;
  startX: number;
  startY: number;
  initialCrop: CropRect;
  latestCrop: CropRect;
}

interface PadBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface DisplayLayout {
  frameCrop: CropRect;
  contentCrop: CropRect;
  padBox: PadBox | null;
}

const MIN_CROP_SIZE = 24;
const MAX_PREVIEW_HEIGHT_PX = 560;

function clampRectToVideo(rect: CropRect, video: VideoMeta): CropRect {
  const x = Math.max(0, Math.min(video.width - 1, Math.round(rect.x)));
  const y = Math.max(0, Math.min(video.height - 1, Math.round(rect.y)));
  const maxW = Math.max(1, video.width - x);
  const maxH = Math.max(1, video.height - y);

  return {
    x,
    y,
    w: Math.max(1, Math.min(maxW, Math.round(rect.w))),
    h: Math.max(1, Math.min(maxH, Math.round(rect.h))),
  };
}

function createCropVideoStyle(video: VideoMeta, crop: CropRect): CSSProperties {
  const safeW = Math.max(1, crop.w);
  const safeH = Math.max(1, crop.h);

  return {
    position: 'absolute',
    width: `${(video.width / safeW) * 100}%`,
    height: `${(video.height / safeH) * 100}%`,
    left: `${-(crop.x / safeW) * 100}%`,
    top: `${-(crop.y / safeH) * 100}%`,
    maxWidth: 'none',
    maxHeight: 'none',
  };
}

function computeDisplayLayout(video: VideoMeta, baseCrop: CropRect, sceneCrop: CropRect | null): DisplayLayout {
  const safeBase = clampRectToVideo(baseCrop, video);
  const safeScene = sceneCrop ? clampRectToVideo(sceneCrop, video) : safeBase;

  if (safeScene.w === safeBase.w && safeScene.h === safeBase.h) {
    return {
      frameCrop: safeBase,
      contentCrop: safeScene,
      padBox: null,
    };
  }

  const scale = Math.min(safeBase.w / safeScene.w, safeBase.h / safeScene.h);
  const scaledWidth = safeScene.w * scale;
  const scaledHeight = safeScene.h * scale;

  return {
    frameCrop: safeBase,
    contentCrop: safeScene,
    padBox: {
      left: ((safeBase.w - scaledWidth) / 2 / safeBase.w) * 100,
      top: ((safeBase.h - scaledHeight) / 2 / safeBase.h) * 100,
      width: (scaledWidth / safeBase.w) * 100,
      height: (scaledHeight / safeBase.h) * 100,
    },
  };
}

function resizeCrop(initial: CropRect, mode: DragMode, dx: number, dy: number, video: VideoMeta): CropRect {
  if (mode === 'move') {
    const maxX = Math.max(0, video.width - initial.w);
    const maxY = Math.max(0, video.height - initial.h);
    return {
      ...initial,
      x: Math.max(0, Math.min(maxX, Math.round(initial.x + dx))),
      y: Math.max(0, Math.min(maxY, Math.round(initial.y + dy))),
    };
  }

  let left = initial.x;
  let right = initial.x + initial.w;
  let top = initial.y;
  let bottom = initial.y + initial.h;

  if (mode.includes('w')) {
    left += dx;
  }
  if (mode.includes('e')) {
    right += dx;
  }
  if (mode.includes('n')) {
    top += dy;
  }
  if (mode.includes('s')) {
    bottom += dy;
  }

  if (right - left < MIN_CROP_SIZE) {
    if (mode.includes('w') && !mode.includes('e')) {
      left = right - MIN_CROP_SIZE;
    } else {
      right = left + MIN_CROP_SIZE;
    }
  }

  if (bottom - top < MIN_CROP_SIZE) {
    if (mode.includes('n') && !mode.includes('s')) {
      top = bottom - MIN_CROP_SIZE;
    } else {
      bottom = top + MIN_CROP_SIZE;
    }
  }

  if (left < 0) {
    left = 0;
    if (right - left < MIN_CROP_SIZE) {
      right = MIN_CROP_SIZE;
    }
  }
  if (top < 0) {
    top = 0;
    if (bottom - top < MIN_CROP_SIZE) {
      bottom = MIN_CROP_SIZE;
    }
  }

  if (right > video.width) {
    right = video.width;
    if (right - left < MIN_CROP_SIZE) {
      left = video.width - MIN_CROP_SIZE;
    }
  }
  if (bottom > video.height) {
    bottom = video.height;
    if (bottom - top < MIN_CROP_SIZE) {
      top = video.height - MIN_CROP_SIZE;
    }
  }

  return {
    x: Math.round(left),
    y: Math.round(top),
    w: Math.round(right - left),
    h: Math.round(bottom - top),
  };
}

function measureViewport(container: HTMLDivElement, video: VideoMeta): ViewportInfo {
  const rect = container.getBoundingClientRect();
  const scale = Math.min(rect.width / video.width, rect.height / video.height);
  const width = video.width * scale;
  const height = video.height * scale;

  return {
    scale,
    width,
    height,
    offsetX: (rect.width - width) / 2,
    offsetY: (rect.height - height) / 2,
  };
}

export default function CanvasPreview({
  video,
  currentTime,
  baseCrop,
  activeSceneCrop,
  editMode,
  editCrop,
  canStartSceneCrop,
  onStartCrop,
  onStartSceneCrop,
  onEditCropPreview,
  onConfirmEdit,
  onCancelEdit,
  onResetEdit,
}: CanvasPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);
  const [viewport, setViewport] = useState<ViewportInfo>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    width: video.width,
    height: video.height,
  });
  const isEditing = editMode !== 'idle';

  const displayLayout = useMemo(() => {
    return computeDisplayLayout(video, baseCrop, activeSceneCrop);
  }, [activeSceneCrop, baseCrop, video]);

  const safeEditCrop = useMemo(() => {
    const initial = editCrop ?? {
      x: 0,
      y: 0,
      w: video.width,
      h: video.height,
    };

    return clampRectToVideo(initial, video);
  }, [editCrop, video]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }

    const update = () => {
      setViewport(measureViewport(element, video));
    };

    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();

    return () => {
      observer.disconnect();
    };
  }, [video]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }

    if (Math.abs(element.currentTime - currentTime) > 0.04) {
      element.currentTime = Math.max(0, Math.min(video.duration, currentTime));
    }
  }, [currentTime, video.duration]);

  const displayCrop = useMemo(() => {
    const safeCrop = safeEditCrop;

    return {
      left: viewport.offsetX + safeCrop.x * viewport.scale,
      top: viewport.offsetY + safeCrop.y * viewport.scale,
      width: safeCrop.w * viewport.scale,
      height: safeCrop.h * viewport.scale,
    };
  }, [safeEditCrop, viewport]);

  useEffect(() => {
    if (!dragging || !isEditing) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || viewport.scale <= 0) {
        return;
      }

      const dx = (event.clientX - current.startX) / viewport.scale;
      const dy = (event.clientY - current.startY) / viewport.scale;
      const next = resizeCrop(current.initialCrop, current.mode, dx, dy, video);

      current.latestCrop = next;
      onEditCropPreview(next);
    };

    const handlePointerUp = () => {
      dragRef.current = null;
      setDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragging, isEditing, onEditCropPreview, video, viewport.scale]);

  const beginDrag = useCallback(
    (event: ReactPointerEvent, mode: DragMode) => {
      event.preventDefault();
      event.stopPropagation();

      dragRef.current = {
        mode,
        startX: event.clientX,
        startY: event.clientY,
        initialCrop: safeEditCrop,
        latestCrop: safeEditCrop,
      };

      setDragging(true);
    },
    [safeEditCrop],
  );

  return (
    <section className="flex min-h-[320px] flex-1 flex-col rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-end gap-4">
        <h2 className="sr-only">Canvas Preview</h2>
        {isEditing ? (
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={onConfirmEdit}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-300/40 bg-emerald-400/10 px-2.5 py-1.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-400/20"
            >
              <Check size={13} />
              OK
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="inline-flex items-center gap-1 rounded-md border border-rose-300/40 bg-rose-400/10 px-2.5 py-1.5 text-xs font-medium text-rose-100 transition hover:bg-rose-400/20"
            >
              <X size={13} />
              Cancel
            </button>
            <button
              type="button"
              onClick={onResetEdit}
              className="inline-flex items-center gap-1 rounded-md border border-slate-600 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-100 transition hover:border-cyan-400/60 hover:text-cyan-100"
            >
              <RotateCcw size={13} />
              Reset
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={onStartCrop}
              className="inline-flex items-center gap-1 rounded-md border border-cyan-300/40 bg-cyan-400/10 px-2.5 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/20"
            >
              <Crop size={13} />
              Crop
            </button>
            <button
              type="button"
              onClick={onStartSceneCrop}
              disabled={!canStartSceneCrop}
              className="inline-flex items-center gap-1 rounded-md border border-amber-300/40 bg-amber-400/10 px-2.5 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Clapperboard size={13} />
              Scene Crop
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-black/90 p-2">
        <div
          ref={viewportRef}
          className="relative w-full max-w-[980px] overflow-hidden rounded-lg border border-slate-800 bg-black"
          style={{
            aspectRatio: isEditing
              ? `${video.width} / ${video.height}`
              : `${displayLayout.frameCrop.w} / ${displayLayout.frameCrop.h}`,
            maxHeight: `${MAX_PREVIEW_HEIGHT_PX}px`,
          }}
        >
          {isEditing ? (
            <>
              <video
                ref={videoRef}
                src={video.objectUrl}
                muted
                controls={false}
                preload="auto"
                className="h-full w-full object-contain"
                onLoadedMetadata={() => {
                  const host = viewportRef.current;
                  if (host) {
                    setViewport(measureViewport(host, video));
                  }
                }}
              />

              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,transparent_45%,rgba(2,6,23,0.5)_100%)]" />

              <div
                className="absolute border-2 border-cyan-300/90 bg-cyan-200/10 shadow-[0_0_0_9999px_rgba(2,6,23,0.58)]"
                style={{
                  left: `${displayCrop.left}px`,
                  top: `${displayCrop.top}px`,
                  width: `${displayCrop.width}px`,
                  height: `${displayCrop.height}px`,
                }}
              >
                <button
                  type="button"
                  onPointerDown={(event) => beginDrag(event, 'move')}
                  className="absolute inset-0 cursor-move"
                  aria-label="Move crop"
                />

                <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-cyan-100/60" />
                <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-cyan-100/60" />

                <button
                  type="button"
                  aria-label="Resize north-west"
                  onPointerDown={(event) => beginDrag(event, 'nw')}
                  className="absolute -left-2 -top-2 h-4 w-4 cursor-nwse-resize rounded-full border border-cyan-200 bg-slate-950"
                />
                <button
                  type="button"
                  aria-label="Resize north-east"
                  onPointerDown={(event) => beginDrag(event, 'ne')}
                  className="absolute -right-2 -top-2 h-4 w-4 cursor-nesw-resize rounded-full border border-cyan-200 bg-slate-950"
                />
                <button
                  type="button"
                  aria-label="Resize south-west"
                  onPointerDown={(event) => beginDrag(event, 'sw')}
                  className="absolute -bottom-2 -left-2 h-4 w-4 cursor-nesw-resize rounded-full border border-cyan-200 bg-slate-950"
                />
                <button
                  type="button"
                  aria-label="Resize south-east"
                  onPointerDown={(event) => beginDrag(event, 'se')}
                  className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-full border border-cyan-200 bg-slate-950"
                />

                <button
                  type="button"
                  aria-label="Resize north"
                  onPointerDown={(event) => beginDrag(event, 'n')}
                  className="absolute left-1/2 top-0 h-4 w-8 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize rounded-full border border-cyan-200 bg-slate-950"
                />
                <button
                  type="button"
                  aria-label="Resize south"
                  onPointerDown={(event) => beginDrag(event, 's')}
                  className="absolute bottom-0 left-1/2 h-4 w-8 -translate-x-1/2 translate-y-1/2 cursor-ns-resize rounded-full border border-cyan-200 bg-slate-950"
                />
                <button
                  type="button"
                  aria-label="Resize west"
                  onPointerDown={(event) => beginDrag(event, 'w')}
                  className="absolute left-0 top-1/2 h-8 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border border-cyan-200 bg-slate-950"
                />
                <button
                  type="button"
                  aria-label="Resize east"
                  onPointerDown={(event) => beginDrag(event, 'e')}
                  className="absolute right-0 top-1/2 h-8 w-4 translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border border-cyan-200 bg-slate-950"
                />

                <div className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-slate-950/75 px-2 py-1 font-mono text-[10px] text-cyan-100">
                  <Focus size={11} />
                  {safeEditCrop.w}x{safeEditCrop.h} @ {safeEditCrop.x},{safeEditCrop.y}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-black" />

              {displayLayout.padBox ? (
                <div
                  className="absolute overflow-hidden"
                  style={{
                    left: `${displayLayout.padBox.left}%`,
                    top: `${displayLayout.padBox.top}%`,
                    width: `${displayLayout.padBox.width}%`,
                    height: `${displayLayout.padBox.height}%`,
                  }}
                >
                  <video
                    ref={videoRef}
                    src={video.objectUrl}
                    muted
                    controls={false}
                    preload="auto"
                    className="absolute"
                    style={createCropVideoStyle(video, displayLayout.contentCrop)}
                  />
                </div>
              ) : (
                <div className="absolute inset-0 overflow-hidden">
                  <video
                    ref={videoRef}
                    src={video.objectUrl}
                    muted
                    controls={false}
                    preload="auto"
                    className="absolute"
                    style={createCropVideoStyle(video, displayLayout.contentCrop)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
