import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Button } from '@base-ui/react/button';
import { Toolbar } from '@base-ui/react/toolbar';
import { Check, Crop, Focus, Pause, Play, RotateCcw, SkipBack, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import TextStyleToolbar from './annotation/TextStyleToolbar';
import type { AnnotationModel, AnnotationTextStyle, CropRect, TextAnnotation, VideoMeta } from '../types/editor';

type DragMode = 'move' | 'n' | 's' | 'w' | 'e' | 'nw' | 'ne' | 'sw' | 'se';

interface CanvasPreviewProps {
  video: VideoMeta;
  fileName: string;
  currentTime: number;
  sourceTime: number;
  totalDuration: number;
  baseCrop: CropRect;
  activeSceneCrop: CropRect | null;
  activeAnnotations: AnnotationModel[];
  selectedAnnotationId: string | null;
  selectedTextAnnotation: TextAnnotation | null;
  hasActiveVideoSlice: boolean;
  editMode: 'idle' | 'crop' | 'scene';
  editCrop: CropRect | null;
  onStartCrop: () => void;
  onEditCropPreview: (crop: CropRect) => void;
  onConfirmEdit: () => void;
  onCancelEdit: () => void;
  onResetEdit: () => void;
  onCurrentTimeChange: (time: number) => void;
  onSelectedAnnotationIdChange: (annotationId: string | null) => void;
  onAnnotationPositionPreview: (annotationId: string, x: number, y: number) => void;
  onAnnotationImageResizePreview: (
    annotationId: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
  onAnnotationPositionCommit: () => void;
  onTextAnnotationChange: (annotationId: string, text: string) => void;
  onTextAnnotationStyleChange: (next: Partial<AnnotationTextStyle>) => void;
  className?: string;
  fillHeight?: boolean;
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

interface AnnotationDragState {
  annotation: AnnotationModel;
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
}

interface AnnotationResizeState {
  annotation: Extract<AnnotationModel, { kind: 'image' }>;
  startX: number;
  startY: number;
  initialWidth: number;
  initialHeight: number;
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

interface FrameSize {
  width: number;
  height: number;
}

const MIN_CROP_SIZE = 24;
const MIN_IMAGE_ANNOTATION_SIZE = 24;
const DOUBLE_TAP_MS = 320;

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

function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(2)}s`;
}

function clampAnnotationPosition(annotation: AnnotationModel, nextX: number, nextY: number, frameCrop: CropRect) {
  if (annotation.kind === 'image') {
    return {
      x: Math.max(0, Math.min(frameCrop.w - annotation.width, Math.round(nextX))),
      y: Math.max(0, Math.min(frameCrop.h - annotation.height, Math.round(nextY))),
    };
  }

  return {
    x: Math.max(0, Math.min(frameCrop.w - 8, Math.round(nextX))),
    y: Math.max(0, Math.min(frameCrop.h - 8, Math.round(nextY))),
  };
}

function clampImageAnnotationSize(annotation: Extract<AnnotationModel, { kind: 'image' }>, nextWidth: number, nextHeight: number, frameCrop: CropRect) {
  return {
    width: Math.max(
      MIN_IMAGE_ANNOTATION_SIZE,
      Math.min(Math.max(MIN_IMAGE_ANNOTATION_SIZE, frameCrop.w - annotation.x), Math.round(nextWidth)),
    ),
    height: Math.max(
      MIN_IMAGE_ANNOTATION_SIZE,
      Math.min(Math.max(MIN_IMAGE_ANNOTATION_SIZE, frameCrop.h - annotation.y), Math.round(nextHeight)),
    ),
  };
}

function toTextStyle(style: AnnotationTextStyle, scale: number): CSSProperties {
  const fontSize = Math.max(8, Math.round(style.fontSize * scale));
  const outlineWidth = Math.max(0, Math.round(style.outlineWidth * scale));
  const lineHeight = Math.max(Math.round(fontSize * 1.25), fontSize + 2);
  const paddingX = Math.max(4, Math.round(fontSize * 0.24));
  const paddingY = Math.max(2, Math.round(fontSize * 0.14));

  return {
    color: style.textColor,
    fontWeight: style.bold ? 700 : 500,
    fontStyle: style.italic ? 'italic' : 'normal',
    fontSize: `${fontSize}px`,
    lineHeight: `${lineHeight}px`,
    whiteSpace: 'pre-wrap',
    backgroundColor: style.boxEnabled ? style.boxColor : 'transparent',
    padding: style.boxEnabled ? `${paddingY}px ${paddingX}px` : '0',
    WebkitTextStroke: outlineWidth > 0 ? `${outlineWidth}px ${style.outlineColor}` : undefined,
  };
}

export default function CanvasPreview({
  video,
  fileName,
  currentTime,
  sourceTime,
  totalDuration,
  baseCrop,
  activeSceneCrop,
  activeAnnotations,
  selectedAnnotationId,
  selectedTextAnnotation,
  hasActiveVideoSlice,
  editMode,
  editCrop,
  onStartCrop,
  onEditCropPreview,
  onConfirmEdit,
  onCancelEdit,
  onResetEdit,
  onCurrentTimeChange,
  onSelectedAnnotationIdChange,
  onAnnotationPositionPreview,
  onAnnotationImageResizePreview,
  onAnnotationPositionCommit,
  onTextAnnotationChange,
  onTextAnnotationStyleChange,
  className,
  fillHeight = false,
}: CanvasPreviewProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const annotationDragRef = useRef<AnnotationDragState | null>(null);
  const annotationResizeRef = useRef<AnnotationResizeState | null>(null);
  const inlineEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const lastTapRef = useRef<{ annotationId: string; timestamp: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timelineTimeRef = useRef(currentTime);
  const lastFrameTimeRef = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [annotationDragging, setAnnotationDragging] = useState(false);
  const [annotationResizing, setAnnotationResizing] = useState(false);
  const [editingTextAnnotationId, setEditingTextAnnotationId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewport, setViewport] = useState<ViewportInfo>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    width: video.width,
    height: video.height,
  });
  const [frameSize, setFrameSize] = useState<FrameSize>({ width: 1, height: 1 });
  const isEditing = editMode !== 'idle';

  const syncVideoTime = useCallback(
    (element: HTMLVideoElement | null) => {
      if (!element) {
        return;
      }

      if (Math.abs(element.currentTime - sourceTime) > 0.04) {
        element.currentTime = Math.max(0, Math.min(video.duration || 0, sourceTime));
      }
    },
    [sourceTime, video.duration],
  );

  useEffect(() => {
    timelineTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    if (!editingTextAnnotationId) {
      return;
    }

    const input = inlineEditorRef.current;
    if (!input) {
      return;
    }

    input.focus();
    const cursor = input.value.length;
    input.setSelectionRange(cursor, cursor);
  }, [editingTextAnnotationId]);

  useEffect(() => {
    if (!editingTextAnnotationId) {
      return;
    }

    const exists = activeAnnotations.some(
      (annotation) => annotation.id === editingTextAnnotationId && annotation.kind === 'text',
    );

    if (!exists || isEditing) {
      const timer = window.setTimeout(() => {
        setEditingTextAnnotationId(null);
      }, 0);

      return () => {
        window.clearTimeout(timer);
      };
    }
  }, [activeAnnotations, editingTextAnnotationId, isEditing]);

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
      const rect = element.getBoundingClientRect();
      setFrameSize({
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
      });
    };

    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();

    return () => {
      observer.disconnect();
    };
  }, [video]);

  useEffect(() => {
    syncVideoTime(videoRef.current);
  }, [hasActiveVideoSlice, isEditing, syncVideoTime, video.objectUrl]);

  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastFrameTimeRef.current = null;
      return;
    }

    const tick = (frameTime: number) => {
      const previousFrameTime = lastFrameTimeRef.current;
      lastFrameTimeRef.current = frameTime;

      if (previousFrameTime === null) {
        animationFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      const delta = (frameTime - previousFrameTime) / 1000;
      const nextTime = Math.min(totalDuration, timelineTimeRef.current + delta);
      timelineTimeRef.current = nextTime;
      onCurrentTimeChange(nextTime);

      if (nextTime >= totalDuration) {
        setIsPlaying(false);
        return;
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastFrameTimeRef.current = null;
    };
  }, [isPlaying, onCurrentTimeChange, totalDuration]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const displayCrop = useMemo(() => {
    return {
      left: viewport.offsetX + safeEditCrop.x * viewport.scale,
      top: viewport.offsetY + safeEditCrop.y * viewport.scale,
      width: safeEditCrop.w * viewport.scale,
      height: safeEditCrop.h * viewport.scale,
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

  useEffect(() => {
    if (!annotationDragging || annotationResizing || isEditing) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const current = annotationDragRef.current;
      if (!current || frameSize.width <= 0 || frameSize.height <= 0) {
        return;
      }

      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      const dxFrame = (dx / frameSize.width) * displayLayout.frameCrop.w;
      const dyFrame = (dy / frameSize.height) * displayLayout.frameCrop.h;
      const clamped = clampAnnotationPosition(
        current.annotation,
        current.initialX + dxFrame,
        current.initialY + dyFrame,
        displayLayout.frameCrop,
      );

      onAnnotationPositionPreview(current.annotation.id, clamped.x, clamped.y);
    };

    const handlePointerUp = () => {
      annotationDragRef.current = null;
      setAnnotationDragging(false);
      onAnnotationPositionCommit();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [
    annotationDragging,
    annotationResizing,
    displayLayout.frameCrop,
    frameSize.height,
    frameSize.width,
    isEditing,
    onAnnotationPositionCommit,
    onAnnotationPositionPreview,
  ]);

  useEffect(() => {
    if (!annotationResizing || isEditing) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const current = annotationResizeRef.current;
      if (!current || frameSize.width <= 0 || frameSize.height <= 0) {
        return;
      }

      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      const dxFrame = (dx / frameSize.width) * displayLayout.frameCrop.w;
      const dyFrame = (dy / frameSize.height) * displayLayout.frameCrop.h;

      const resized = clampImageAnnotationSize(
        current.annotation,
        current.initialWidth + dxFrame,
        current.initialHeight + dyFrame,
        displayLayout.frameCrop,
      );

      onAnnotationImageResizePreview(
        current.annotation.id,
        current.annotation.x,
        current.annotation.y,
        resized.width,
        resized.height,
      );
    };

    const handlePointerUp = () => {
      annotationResizeRef.current = null;
      setAnnotationResizing(false);
      onAnnotationPositionCommit();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [
    annotationResizing,
    displayLayout.frameCrop,
    frameSize.height,
    frameSize.width,
    isEditing,
    onAnnotationImageResizePreview,
    onAnnotationPositionCommit,
  ]);

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

  const beginAnnotationDrag = useCallback(
    (event: ReactPointerEvent, annotation: AnnotationModel) => {
      if (editingTextAnnotationId === annotation.id || annotationResizing) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (event.currentTarget.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }

      annotationDragRef.current = {
        annotation,
        startX: event.clientX,
        startY: event.clientY,
        initialX: annotation.x,
        initialY: annotation.y,
      };

      onSelectedAnnotationIdChange(annotation.id);
      setAnnotationDragging(true);
    },
    [annotationResizing, editingTextAnnotationId, onSelectedAnnotationIdChange],
  );

  const beginImageResize = useCallback(
    (event: ReactPointerEvent, annotation: Extract<AnnotationModel, { kind: 'image' }>) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.currentTarget.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }

      annotationResizeRef.current = {
        annotation,
        startX: event.clientX,
        startY: event.clientY,
        initialWidth: annotation.width,
        initialHeight: annotation.height,
      };

      onSelectedAnnotationIdChange(annotation.id);
      setAnnotationDragging(false);
      setAnnotationResizing(true);
    },
    [onSelectedAnnotationIdChange],
  );

  const startInlineTextEdit = useCallback(
    (annotation: Extract<AnnotationModel, { kind: 'text' }>) => {
      setEditingTextAnnotationId(annotation.id);
      setEditingTextValue(annotation.text);
      onSelectedAnnotationIdChange(annotation.id);
      setAnnotationDragging(false);
      setAnnotationResizing(false);
    },
    [onSelectedAnnotationIdChange],
  );

  const cancelInlineTextEdit = useCallback(() => {
    setEditingTextAnnotationId(null);
  }, []);

  const commitInlineTextEdit = useCallback(() => {
    if (!editingTextAnnotationId) {
      return;
    }

    onTextAnnotationChange(editingTextAnnotationId, editingTextValue);
    setEditingTextAnnotationId(null);
  }, [editingTextAnnotationId, editingTextValue, onTextAnnotationChange]);

  const handleTextPointerDown = useCallback(
    (event: ReactPointerEvent, annotation: Extract<AnnotationModel, { kind: 'text' }>) => {
      if (event.detail >= 2) {
        startInlineTextEdit(annotation);
        return;
      }

      if (event.pointerType === 'touch') {
        const now = Date.now();
        const previousTap = lastTapRef.current;

        if (
          previousTap &&
          previousTap.annotationId === annotation.id &&
          now - previousTap.timestamp <= DOUBLE_TAP_MS
        ) {
          lastTapRef.current = null;
          startInlineTextEdit(annotation);
          return;
        }

        lastTapRef.current = {
          annotationId: annotation.id,
          timestamp: now,
        };
      }

      beginAnnotationDrag(event, annotation);
    },
    [beginAnnotationDrag, startInlineTextEdit],
  );

  const handleTogglePlay = useCallback(() => {
    if (isEditing || totalDuration <= 0) {
      return;
    }

    if (!isPlaying && currentTime >= totalDuration) {
      timelineTimeRef.current = 0;
      onCurrentTimeChange(0);
    }

    setIsPlaying((value) => !value);
  }, [currentTime, isEditing, isPlaying, onCurrentTimeChange, totalDuration]);

  const handleRestart = useCallback(() => {
    timelineTimeRef.current = 0;
    onCurrentTimeChange(0);
    setIsPlaying(false);
  }, [onCurrentTimeChange]);

  const handleStartCropClick = useCallback(() => {
    setIsPlaying(false);
    onStartCrop();
  }, [onStartCrop]);

  const annotationScale = useMemo(() => {
    return frameSize.height / Math.max(1, displayLayout.frameCrop.h);
  }, [displayLayout.frameCrop.h, frameSize.height]);

  return (
    <section
      className={`flex flex-1 flex-col rounded-lg border border-slate-800/70 bg-slate-950/55 p-2 shadow-xl ${fillHeight ? 'min-h-0 h-full' : 'min-h-[320px]'} ${className ?? ''}`}
    >
      <div className="mb-2 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="sr-only">{t('canvas.title')}</h2>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <p className="min-w-0 max-w-[52vw] truncate text-xs text-slate-400 sm:max-w-[360px]" title={fileName}>
              {fileName}
            </p>
          </div>

          {isEditing ? (
            <div className="inline-flex items-center gap-2">
              <Button
                type="button"
                onClick={onResetEdit}
                className="inline-flex items-center gap-1 rounded-md border border-slate-600 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-100 transition hover:border-cyan-400/60 hover:text-cyan-100"
              >
                <RotateCcw size={13} />
                {t('canvas.reset')}
              </Button>
              <Button
                type="button"
                onClick={onCancelEdit}
                className="inline-flex items-center gap-1 rounded-md border border-rose-300/40 bg-rose-400/10 px-2.5 py-1.5 text-xs font-medium text-rose-100 transition hover:bg-rose-400/20"
              >
                <X size={13} />
                {t('canvas.cancel')}
              </Button>
              <Button
                type="button"
                onClick={onConfirmEdit}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-300/40 bg-emerald-400/10 px-2.5 py-1.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-400/20"
              >
                <Check size={13} />
                {t('canvas.confirm')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Toolbar.Root
                aria-label={t('canvas.previewControls')}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/90 p-1"
              >
                <Toolbar.Group className="inline-flex items-center gap-1">
                  <Toolbar.Button
                    aria-label={t('canvas.restartPreview')}
                    onClick={handleRestart}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 transition hover:bg-slate-800 hover:text-white"
                  >
                    <SkipBack size={14} />
                  </Toolbar.Button>
                  <Toolbar.Button
                    aria-label={isPlaying ? t('canvas.pausePreview') : t('canvas.playPreview')}
                    onClick={handleTogglePlay}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-100 transition hover:bg-cyan-500/15 hover:text-cyan-100"
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                  </Toolbar.Button>
                </Toolbar.Group>
                <Toolbar.Separator className="mx-1 h-5 w-px bg-slate-800" />
                <div className="min-w-[110px] px-2 text-right font-mono text-[11px] text-slate-300">
                  {formatSeconds(currentTime)} / {formatSeconds(totalDuration)}
                </div>
              </Toolbar.Root>

              <Button
                type="button"
                onClick={handleStartCropClick}
                className="inline-flex items-center gap-1 rounded-md border border-cyan-300/40 bg-cyan-400/10 px-2.5 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/20"
              >
                <Crop size={13} />
                {t('sliceEditor.crop')}
              </Button>
            </div>
          )}
        </div>

        {!isEditing ? (
          <div className="flex justify-end">
            <TextStyleToolbar
              selectedTextAnnotation={selectedTextAnnotation}
              onTextChange={(text) => {
                if (!selectedTextAnnotation) {
                  return;
                }

                onTextAnnotationChange(selectedTextAnnotation.id, text);
              }}
              onStyleChange={onTextAnnotationStyleChange}
            />
          </div>
        ) : null}

      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden rounded-md border border-slate-800 bg-black/95 p-1">
        <div
          ref={viewportRef}
          className="relative h-full w-full overflow-hidden rounded-sm border border-slate-800 bg-black"
          style={{
            aspectRatio: isEditing
              ? `${video.width} / ${video.height}`
              : `${displayLayout.frameCrop.w} / ${displayLayout.frameCrop.h}`,
            maxHeight: '100%',
          }}
          onPointerDown={(event) => {
            if (isEditing) {
              return;
            }

            const target = event.target as HTMLElement | null;
            if (target?.closest('[data-annotation-box="true"]')) {
              return;
            }

            onSelectedAnnotationIdChange(null);
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
                  syncVideoTime(videoRef.current);
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
                  aria-label={t('canvas.moveCrop')}
                />

                <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-cyan-100/60" />
                <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-cyan-100/60" />

                <button
                  type="button"
                  aria-label={t('canvas.resizeNorthWest')}
                  onPointerDown={(event) => beginDrag(event, 'nw')}
                  className="absolute -left-2 -top-2 h-4 w-4 cursor-nwse-resize rounded-full border border-cyan-200 bg-slate-950"
                />
                <button
                  type="button"
                  aria-label={t('canvas.resizeNorthEast')}
                  onPointerDown={(event) => beginDrag(event, 'ne')}
                  className="absolute -right-2 -top-2 h-4 w-4 cursor-nesw-resize rounded-full border border-cyan-200 bg-slate-950"
                />
                <button
                  type="button"
                  aria-label={t('canvas.resizeSouthWest')}
                  onPointerDown={(event) => beginDrag(event, 'sw')}
                  className="absolute -bottom-2 -left-2 h-4 w-4 cursor-nesw-resize rounded-full border border-cyan-200 bg-slate-950"
                />
                <button
                  type="button"
                  aria-label={t('canvas.resizeSouthEast')}
                  onPointerDown={(event) => beginDrag(event, 'se')}
                  className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-full border border-cyan-200 bg-slate-950"
                />

                <button
                  type="button"
                  aria-label={t('canvas.resizeNorth')}
                  onPointerDown={(event) => beginDrag(event, 'n')}
                  className="absolute left-1/2 top-0 h-4 w-8 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize rounded-full border border-cyan-200 bg-slate-950"
                />
                <button
                  type="button"
                  aria-label={t('canvas.resizeSouth')}
                  onPointerDown={(event) => beginDrag(event, 's')}
                  className="absolute bottom-0 left-1/2 h-4 w-8 -translate-x-1/2 translate-y-1/2 cursor-ns-resize rounded-full border border-cyan-200 bg-slate-950"
                />
                <button
                  type="button"
                  aria-label={t('canvas.resizeWest')}
                  onPointerDown={(event) => beginDrag(event, 'w')}
                  className="absolute left-0 top-1/2 h-8 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border border-cyan-200 bg-slate-950"
                />
                <button
                  type="button"
                  aria-label={t('canvas.resizeEast')}
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

              {hasActiveVideoSlice ? (
                displayLayout.padBox ? (
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
                      onLoadedMetadata={() => syncVideoTime(videoRef.current)}
                      style={createCropVideoStyle(video, displayLayout.contentCrop)}
                    />
                  </div>
                )
              ) : null}

              <div className="absolute inset-0 select-none">
                {activeAnnotations.map((annotation) => {
                  const left = (annotation.x / Math.max(1, displayLayout.frameCrop.w)) * frameSize.width;
                  const top = (annotation.y / Math.max(1, displayLayout.frameCrop.h)) * frameSize.height;
                  const selected = annotation.id === selectedAnnotationId;

                  if (annotation.kind === 'text') {
                    const isInlineEditing = editingTextAnnotationId === annotation.id;

                    if (isInlineEditing) {
                      return (
                        <textarea
                          key={annotation.id}
                          data-annotation-box="true"
                          ref={(node) => {
                            inlineEditorRef.current = node;
                          }}
                          value={editingTextValue}
                          onChange={(event) => setEditingTextValue(event.target.value)}
                          onBlur={commitInlineTextEdit}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              commitInlineTextEdit();
                              return;
                            }

                            if (event.key === 'Escape') {
                              event.preventDefault();
                              cancelInlineTextEdit();
                            }
                          }}
                          className="absolute max-w-[94%] border border-cyan-200 bg-slate-900/95 text-left outline-none ring-2 ring-cyan-300/80 ring-offset-2 ring-offset-black"
                          style={{
                            left: `${left}px`,
                            top: `${top}px`,
                            minWidth: `${Math.min(Math.max(140, frameSize.width * 0.24), frameSize.width * 0.94)}px`,
                            maxWidth: `${frameSize.width * 0.94}px`,
                            minHeight: `${Math.max(44, annotationScale * 28)}px`,
                            resize: 'none',
                            ...toTextStyle(annotation.style, annotationScale),
                          }}
                          aria-label={t('canvas.textContent')}
                        />
                      );
                    }

                    return (
                      <button
                        key={annotation.id}
                        data-annotation-box="true"
                        type="button"
                        onPointerDown={(event) => handleTextPointerDown(event, annotation)}
                        onDoubleClick={() => startInlineTextEdit(annotation)}
                        className={`absolute max-w-[94%] cursor-move select-none text-left transition ${
                          selected ? 'ring-2 ring-cyan-300/80 ring-offset-2 ring-offset-black' : ''
                        }`}
                        style={{
                          left: `${left}px`,
                          top: `${top}px`,
                          ...toTextStyle(annotation.style, annotationScale),
                        }}
                      >
                        {annotation.text || t('canvas.textPlaceholder')}
                      </button>
                    );
                  }

                  const width = (annotation.width / Math.max(1, displayLayout.frameCrop.w)) * frameSize.width;
                  const height = (annotation.height / Math.max(1, displayLayout.frameCrop.h)) * frameSize.height;

                  return (
                    <div
                      key={annotation.id}
                      data-annotation-box="true"
                      className="absolute"
                      style={{
                        left: `${left}px`,
                        top: `${top}px`,
                        width: `${Math.max(10, width)}px`,
                        height: `${Math.max(10, height)}px`,
                      }}
                    >
                      <button
                        type="button"
                        onPointerDown={(event) => beginAnnotationDrag(event, annotation)}
                        className={`h-full w-full cursor-move select-none overflow-hidden border transition ${
                          selected
                            ? 'border-cyan-200 ring-2 ring-cyan-300/80 ring-offset-2 ring-offset-black'
                            : 'border-slate-200/50'
                        }`}
                      >
                        <img src={annotation.imageUrl} alt="" className="h-full w-full object-fill" />
                      </button>

                      {selected ? (
                        <button
                          type="button"
                          onPointerDown={(event) => beginImageResize(event, annotation)}
                          className="absolute bottom-1 right-1 h-3.5 w-3.5 cursor-nwse-resize rounded-full border border-cyan-200 bg-slate-950"
                          aria-label={t('canvas.resizeSouthEast')}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
