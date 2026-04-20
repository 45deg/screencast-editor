import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import ImageStyleToolbar from './annotation/ImageStyleToolbar';
import CanvasPreviewHeader from './canvas-preview/CanvasPreviewHeader';
import CropEditOverlay from './canvas-preview/CropEditOverlay';
import PreviewOverlay from './canvas-preview/PreviewOverlay';
import TextStyleToolbar from './annotation/TextStyleToolbar';
import { clampRectToVideo, computeDisplayLayout } from './canvas-preview/math';
import { useCanvasPlayback } from './canvas-preview/useCanvasPlayback';
import { useCanvasViewport } from './canvas-preview/useCanvasViewport';
import { useTextAnnotationEditor } from './canvas-preview/useTextAnnotationEditor';
import type { AnnotationModel, AnnotationTextStyle, CropRect, ImageAnnotation, TextAnnotation, VideoMeta } from '../types/editor';
import type { LayerEdgeDirection } from '../lib/annotationTimeline';

const TOOLBAR_MARGIN = 12;

type ToolbarKind = 'image' | 'text';
type ToolbarPlacement = 'top' | 'bottom';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function hasRectIntersection(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function resolveToolbarPlacement(
  viewportSize: { width: number; height: number },
  toolbarSize: { width: number; height: number },
  targetRect: Rect | null,
): ToolbarPlacement {
  if (!targetRect) {
    return 'bottom';
  }

  const x = Math.max(TOOLBAR_MARGIN, viewportSize.width - toolbarSize.width - TOOLBAR_MARGIN);
  const topRect: Rect = {
    x,
    y: TOOLBAR_MARGIN,
    width: toolbarSize.width,
    height: toolbarSize.height,
  };
  const bottomRect: Rect = {
    x,
    y: Math.max(TOOLBAR_MARGIN, viewportSize.height - toolbarSize.height - TOOLBAR_MARGIN),
    width: toolbarSize.width,
    height: toolbarSize.height,
  };

  const topIntersects = hasRectIntersection(topRect, targetRect);
  const bottomIntersects = hasRectIntersection(bottomRect, targetRect);

  if (bottomIntersects && !topIntersects) {
    return 'top';
  }

  if (topIntersects && !bottomIntersects) {
    return 'bottom';
  }

  if (!topIntersects && !bottomIntersects) {
    return 'bottom';
  }

  const targetCenterY = targetRect.y + targetRect.height / 2;
  return targetCenterY >= viewportSize.height / 2 ? 'top' : 'bottom';
}

function formatCropRect(crop: CropRect | null) {
  if (!crop) {
    return null;
  }

  return `x=${crop.x}, y=${crop.y}, w=${crop.w}, h=${crop.h}`;
}

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
  selectedImageAnnotation: ImageAnnotation | null;
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
  onSelectedImageOpacityChange: (opacity: number) => void;
  hasSelectedAnnotationLayerOverlap: boolean;
  canBringSelectedAnnotationToFront: boolean;
  canSendSelectedAnnotationToBack: boolean;
  onMoveSelectedAnnotationLayer: (direction: LayerEdgeDirection) => void;
  onDeleteSelectedAnnotation: () => void;
  outputHeight: number;
  className?: string;
  fillHeight?: boolean;
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
  selectedImageAnnotation,
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
  onSelectedImageOpacityChange,
  hasSelectedAnnotationLayerOverlap,
  canBringSelectedAnnotationToFront,
  canSendSelectedAnnotationToBack,
  onMoveSelectedAnnotationLayer,
  onDeleteSelectedAnnotation,
  outputHeight,
  className,
  fillHeight = false,
}: CanvasPreviewProps) {
  const isEditing = editMode !== 'idle';
  const textToolbarRef = useRef<HTMLDivElement>(null);
  const imageToolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarPlacements, setToolbarPlacements] = useState<Record<ToolbarKind, ToolbarPlacement>>({
    text: 'bottom',
    image: 'bottom',
  });

  const { videoRef, viewportRef, viewport, frameSize, syncVideoTime, handleVideoLoadedMetadata } =
    useCanvasViewport({
      video,
      sourceTime,
      hasActiveVideoSlice,
      isEditing,
    });

  const displayLayout = useMemo(() => {
    return computeDisplayLayout(video, baseCrop, activeSceneCrop);
  }, [activeSceneCrop, baseCrop, video]);
  const outlinePreviewScaleY = useMemo(() => {
    return outputHeight / Math.max(1, baseCrop.h);
  }, [baseCrop.h, outputHeight]);

  useEffect(() => {
    if (editMode !== 'idle') {
      return;
    }

    const sceneRelativeToBase = activeSceneCrop
      ? {
          x: activeSceneCrop.x - baseCrop.x,
          y: activeSceneCrop.y - baseCrop.y,
          w: activeSceneCrop.w,
          h: activeSceneCrop.h,
        }
      : null;
    const sceneWithinBase = activeSceneCrop
      ? activeSceneCrop.x >= baseCrop.x &&
        activeSceneCrop.y >= baseCrop.y &&
        activeSceneCrop.x + activeSceneCrop.w <= baseCrop.x + baseCrop.w &&
        activeSceneCrop.y + activeSceneCrop.h <= baseCrop.y + baseCrop.h
      : null;

    console.debug('[crop-debug] preview layout input', {
      currentTime,
      sourceTime,
      videoSize: `${video.width}x${video.height}`,
      baseCrop: formatCropRect(baseCrop),
      activeSceneCrop: formatCropRect(activeSceneCrop),
      sceneRelativeToBase: formatCropRect(sceneRelativeToBase),
      sceneWithinBase,
      frameCrop: formatCropRect(displayLayout.frameCrop),
      contentCrop: formatCropRect(displayLayout.contentCrop),
      padBox: displayLayout.padBox,
    });
  }, [activeSceneCrop, baseCrop, currentTime, displayLayout, editMode, sourceTime, video]);

  const safeEditCrop = useMemo(() => {
    const initial = editCrop ?? {
      x: 0,
      y: 0,
      w: video.width,
      h: video.height,
    };

    return clampRectToVideo(initial, video);
  }, [editCrop, video]);

  const displayCrop = useMemo(() => {
    return {
      x: safeEditCrop.x * viewport.scale,
      y: safeEditCrop.y * viewport.scale,
      width: safeEditCrop.w * viewport.scale,
      height: safeEditCrop.h * viewport.scale,
    };
  }, [safeEditCrop, viewport]);

  const {
    inlineEditorRef,
    editingTextAnnotationId,
    editingTextValue,
    setEditingTextValue,
    startInlineTextEdit,
    cancelInlineTextEdit,
    commitInlineTextEdit,
    handleTextPointerDown,
  } = useTextAnnotationEditor({
    activeAnnotations,
    isEditing,
    onSelectedAnnotationIdChange,
    onTextAnnotationChange,
  });

  const { isPlaying, handleTogglePlay, handleRestart, stopPlayback } = useCanvasPlayback({
    currentTime,
    totalDuration,
    isEditing,
    onCurrentTimeChange,
  });

  const handleStartCropClick = useCallback(() => {
    stopPlayback();
    onStartCrop();
  }, [onStartCrop, stopPlayback]);

  const resolveSelectedAnnotationRect = useCallback((): Rect | null => {
    const viewportElement = viewportRef.current;
    if (!viewportElement || !selectedAnnotationId) {
      return null;
    }

    const targetElement = viewportElement.querySelector<HTMLElement>(
      `[data-annotation-id="${selectedAnnotationId}"]`,
    );
    if (!targetElement) {
      return null;
    }

    const viewportBounds = viewportElement.getBoundingClientRect();
    const targetBounds = targetElement.getBoundingClientRect();
    return {
      x: targetBounds.left - viewportBounds.left,
      y: targetBounds.top - viewportBounds.top,
      width: targetBounds.width,
      height: targetBounds.height,
    };
  }, [selectedAnnotationId, viewportRef]);

  const computeToolbarPlacement = useCallback(
    (kind: ToolbarKind): ToolbarPlacement | null => {
      const viewportElement = viewportRef.current;
      const toolbarElement = kind === 'text' ? textToolbarRef.current : imageToolbarRef.current;
      if (!viewportElement || !toolbarElement) {
        return null;
      }

      return resolveToolbarPlacement(
        {
          width: viewportElement.clientWidth,
          height: viewportElement.clientHeight,
        },
        {
          width: toolbarElement.offsetWidth,
          height: toolbarElement.offsetHeight,
        },
        resolveSelectedAnnotationRect(),
      );
    },
    [resolveSelectedAnnotationRect, viewportRef],
  );

  const previewScale = Math.min(frameSize.width / Math.max(1, baseCrop.w), frameSize.height / Math.max(1, baseCrop.h));
  const overlayWidth = baseCrop.w * previewScale;
  const overlayHeight = baseCrop.h * previewScale;
  const overlayOffsetX = (frameSize.width - overlayWidth) / 2;
  const overlayOffsetY = (frameSize.height - overlayHeight) / 2;

  useLayoutEffect(() => {
    if (isEditing) {
      return;
    }

    setToolbarPlacements((current) => {
      let changed = false;
      const next = { ...current };

      if (!selectedTextAnnotation && !selectedImageAnnotation) {
        if (next.text !== 'bottom') {
          next.text = 'bottom';
          changed = true;
        }
        if (next.image !== 'bottom') {
          next.image = 'bottom';
          changed = true;
        }
      }

      if (selectedTextAnnotation) {
        const placement = computeToolbarPlacement('text');
        if (placement && placement !== next.text) {
          next.text = placement;
          changed = true;
        }
      }

      if (selectedImageAnnotation && !selectedTextAnnotation) {
        const placement = computeToolbarPlacement('image');
        if (placement && placement !== next.image) {
          next.image = placement;
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [computeToolbarPlacement, frameSize.height, frameSize.width, isEditing, selectedImageAnnotation, selectedTextAnnotation]);

  const getToolbarStyle = useCallback(
    (kind: ToolbarKind) => {
      if (toolbarPlacements[kind] === 'top') {
        return {
          right: TOOLBAR_MARGIN,
          top: TOOLBAR_MARGIN,
        };
      }

      return {
        right: TOOLBAR_MARGIN,
        bottom: TOOLBAR_MARGIN,
      };
    },
    [toolbarPlacements],
  );

  useEffect(() => {
    console.debug('[crop-debug] canvas frame metrics', {
      editMode,
      videoSize: `${video.width}x${video.height}`,
      baseCrop: formatCropRect(baseCrop),
      frameSize,
      viewport,
      previewScale,
      overlayWidth,
      overlayHeight,
      overlayOffsetX,
      overlayOffsetY,
      displayCrop,
    });
  }, [
    baseCrop,
    displayCrop,
    editMode,
    frameSize,
    overlayHeight,
    overlayOffsetX,
    overlayOffsetY,
    overlayWidth,
    previewScale,
    video,
    viewport,
  ]);

  return (
    <section
      className={`flex flex-1 flex-col rounded-lg border border-slate-800/70 bg-slate-950/55 p-2 shadow-xl ${
        fillHeight ? 'min-h-0 h-full' : 'min-h-[320px]'
      } ${className ?? ''}`}
    >
      <CanvasPreviewHeader
        fileName={fileName}
        isEditing={isEditing}
        onResetEdit={onResetEdit}
        onCancelEdit={onCancelEdit}
        onConfirmEdit={onConfirmEdit}
        isPlaying={isPlaying}
        currentTime={currentTime}
        totalDuration={totalDuration}
        onRestart={handleRestart}
        onTogglePlay={handleTogglePlay}
        onStartCrop={handleStartCropClick}
      />

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
            <CropEditOverlay
              videoObjectUrl={video.objectUrl}
              videoRef={videoRef}
              isSceneCrop={editMode === 'scene'}
              videoFrame={{
                left: viewport.offsetX,
                top: viewport.offsetY,
                width: viewport.width,
                height: viewport.height,
              }}
              safeEditCrop={safeEditCrop}
              viewportScale={viewport.scale}
              onEditCropPreview={onEditCropPreview}
              onLoadedMetadata={handleVideoLoadedMetadata}
            />
          ) : (
            <PreviewOverlay
              hasActiveVideoSlice={hasActiveVideoSlice}
              displayLayout={displayLayout}
              video={video}
              videoRef={videoRef}
              onVideoLoadedMetadata={() => syncVideoTime(videoRef.current)}
              baseCrop={baseCrop}
              activeAnnotations={activeAnnotations}
              selectedAnnotationId={selectedAnnotationId}
              editingTextAnnotationId={editingTextAnnotationId}
              editingTextValue={editingTextValue}
              setEditingTextValue={setEditingTextValue}
              inlineEditorRef={inlineEditorRef}
              commitInlineTextEdit={commitInlineTextEdit}
              cancelInlineTextEdit={cancelInlineTextEdit}
              handleTextPointerDown={handleTextPointerDown}
              startInlineTextEdit={startInlineTextEdit}
              onSelectedAnnotationIdChange={onSelectedAnnotationIdChange}
              onAnnotationPositionPreview={onAnnotationPositionPreview}
              onAnnotationImageResizePreview={onAnnotationImageResizePreview}
              onAnnotationPositionCommit={onAnnotationPositionCommit}
              previewScale={previewScale}
              overlayWidth={overlayWidth}
              overlayHeight={overlayHeight}
              overlayOffsetX={overlayOffsetX}
              overlayOffsetY={overlayOffsetY}
            />
          )}

          {!isEditing && selectedTextAnnotation ? (
            <div className="absolute z-20" style={getToolbarStyle('text')}>
              <div
                data-annotation-box="true"
                ref={textToolbarRef}
                className="pointer-events-auto max-w-[calc(100vw-2rem)]"
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
              >
                <TextStyleToolbar
                  selectedTextAnnotation={selectedTextAnnotation}
                  outlinePreviewScaleY={outlinePreviewScaleY}
                  showLayerMoveControls={hasSelectedAnnotationLayerOverlap}
                  canBringToFront={canBringSelectedAnnotationToFront}
                  canSendToBack={canSendSelectedAnnotationToBack}
                  onStyleChange={onTextAnnotationStyleChange}
                  onBringToFront={() => onMoveSelectedAnnotationLayer('front')}
                  onSendToBack={() => onMoveSelectedAnnotationLayer('back')}
                  onDelete={onDeleteSelectedAnnotation}
                />
              </div>
            </div>
          ) : null}

          {!isEditing && !selectedTextAnnotation && selectedImageAnnotation ? (
            <div className="absolute z-20" style={getToolbarStyle('image')}>
              <div
                data-annotation-box="true"
                ref={imageToolbarRef}
                className="pointer-events-auto max-w-[calc(100vw-2rem)]"
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
              >
                <ImageStyleToolbar
                  selectedImageAnnotation={selectedImageAnnotation}
                  showLayerMoveControls={hasSelectedAnnotationLayerOverlap}
                  canBringToFront={canBringSelectedAnnotationToFront}
                  canSendToBack={canSendSelectedAnnotationToBack}
                  onOpacityChange={onSelectedImageOpacityChange}
                  onBringToFront={() => onMoveSelectedAnnotationLayer('front')}
                  onSendToBack={() => onMoveSelectedAnnotationLayer('back')}
                  onDelete={onDeleteSelectedAnnotation}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
