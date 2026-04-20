import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';

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

interface ToolbarPosition {
  x: number;
  y: number;
}

function snapToolbarPosition(
  position: ToolbarPosition,
  bounds: { width: number; height: number },
  toolbarSize: { width: number; height: number },
): ToolbarPosition {
  const maxX = Math.max(0, bounds.width - toolbarSize.width - TOOLBAR_MARGIN);
  const maxY = Math.max(0, bounds.height - toolbarSize.height - TOOLBAR_MARGIN);

  return {
    x: position.x <= maxX / 2 ? TOOLBAR_MARGIN : maxX,
    y: position.y <= maxY / 2 ? TOOLBAR_MARGIN : maxY,
  };
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
  const [toolbarPositions, setToolbarPositions] = useState<Record<ToolbarKind, ToolbarPosition | null>>({
    text: null,
    image: null,
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

  const measureToolbarPosition = useCallback(
    (toolbarElement: HTMLDivElement | null): ToolbarPosition | null => {
      const viewportElement = viewportRef.current;
      if (!viewportElement || !toolbarElement) {
        return null;
      }

      return {
        x: Math.max(0, viewportElement.clientWidth - toolbarElement.offsetWidth - TOOLBAR_MARGIN),
        y: Math.max(0, viewportElement.clientHeight - toolbarElement.offsetHeight - TOOLBAR_MARGIN),
      };
    },
    [viewportRef],
  );

  const clampToolbarPosition = useCallback(
    (position: ToolbarPosition, toolbarElement: HTMLDivElement | null): ToolbarPosition => {
      const viewportElement = viewportRef.current;
      if (!viewportElement || !toolbarElement) {
        return position;
      }

      return {
        x: Math.max(0, Math.min(position.x, viewportElement.clientWidth - toolbarElement.offsetWidth)),
        y: Math.max(0, Math.min(position.y, viewportElement.clientHeight - toolbarElement.offsetHeight)),
      };
    },
    [viewportRef],
  );

  const updateToolbarPosition = useCallback(
    (kind: ToolbarKind, nextPosition: ToolbarPosition) => {
      const toolbarElement = kind === 'text' ? textToolbarRef.current : imageToolbarRef.current;
      const clamped = clampToolbarPosition(nextPosition, toolbarElement);
      setToolbarPositions((current) => {
        const previous = current[kind];
        if (previous && previous.x === clamped.x && previous.y === clamped.y) {
          return current;
        }

        return {
          ...current,
          [kind]: clamped,
        };
      });
    },
    [clampToolbarPosition],
  );

  const snapToolbarToCorner = useCallback(
    (kind: ToolbarKind, nextPosition: ToolbarPosition) => {
      const toolbarElement = kind === 'text' ? textToolbarRef.current : imageToolbarRef.current;
      const viewportElement = viewportRef.current;
      if (!toolbarElement || !viewportElement) {
        updateToolbarPosition(kind, nextPosition);
        return;
      }

      const snapped = snapToolbarPosition(
        nextPosition,
        {
          width: viewportElement.clientWidth,
          height: viewportElement.clientHeight,
        },
        {
          width: toolbarElement.offsetWidth,
          height: toolbarElement.offsetHeight,
        },
      );

      updateToolbarPosition(kind, snapped);
    },
    [updateToolbarPosition, viewportRef],
  );

  const previewScale = Math.min(frameSize.width / Math.max(1, baseCrop.w), frameSize.height / Math.max(1, baseCrop.h));
  const overlayWidth = baseCrop.w * previewScale;
  const overlayHeight = baseCrop.h * previewScale;
  const overlayOffsetX = (frameSize.width - overlayWidth) / 2;
  const overlayOffsetY = (frameSize.height - overlayHeight) / 2;

  useLayoutEffect(() => {
    if (isEditing || !selectedTextAnnotation || toolbarPositions.text) {
      return;
    }

    const nextPosition = measureToolbarPosition(textToolbarRef.current);
    if (nextPosition) {
      setToolbarPositions((current) => ({ ...current, text: nextPosition }));
    }
  }, [isEditing, measureToolbarPosition, selectedTextAnnotation, toolbarPositions.text]);

  useLayoutEffect(() => {
    if (isEditing || selectedTextAnnotation || !selectedImageAnnotation || toolbarPositions.image) {
      return;
    }

    const nextPosition = measureToolbarPosition(imageToolbarRef.current);
    if (nextPosition) {
      setToolbarPositions((current) => ({ ...current, image: nextPosition }));
    }
  }, [isEditing, measureToolbarPosition, selectedImageAnnotation, selectedTextAnnotation, toolbarPositions.image]);

  useEffect(() => {
    setToolbarPositions((current) => {
      let changed = false;
      const next = { ...current };

      ([
        ['text', textToolbarRef.current],
        ['image', imageToolbarRef.current],
      ] as const).forEach(([kind, toolbarElement]) => {
        const currentPosition = current[kind];
        if (!currentPosition || !toolbarElement) {
          return;
        }

        const clamped = clampToolbarPosition(currentPosition, toolbarElement);
        if (clamped.x !== currentPosition.x || clamped.y !== currentPosition.y) {
          next[kind] = clamped;
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [clampToolbarPosition, frameSize.height, frameSize.width]);

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
            <Rnd
              bounds="parent"
              enableResizing={false}
              dragHandleClassName="annotation-toolbar__drag-handle"
              position={toolbarPositions.text ?? { x: 0, y: 0 }}
              size={{ width: 'auto', height: 'auto' }}
              onDrag={(_, data) => {
                updateToolbarPosition('text', { x: data.x, y: data.y });
              }}
              onDragStop={(_, data) => {
                snapToolbarToCorner('text', { x: data.x, y: data.y });
              }}
              className="z-20"
            >
              <div
                data-annotation-box="true"
                ref={textToolbarRef}
                className="pointer-events-auto max-w-[calc(100vw-2rem)]"
                style={{ visibility: toolbarPositions.text ? 'visible' : 'hidden' }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
              >
                <TextStyleToolbar
                  dragHandleClassName="annotation-toolbar__drag-handle"
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
            </Rnd>
          ) : null}

          {!isEditing && !selectedTextAnnotation && selectedImageAnnotation ? (
            <Rnd
              bounds="parent"
              enableResizing={false}
              dragHandleClassName="annotation-toolbar__drag-handle"
              position={toolbarPositions.image ?? { x: 0, y: 0 }}
              size={{ width: 'auto', height: 'auto' }}
              onDrag={(_, data) => {
                updateToolbarPosition('image', { x: data.x, y: data.y });
              }}
              onDragStop={(_, data) => {
                snapToolbarToCorner('image', { x: data.x, y: data.y });
              }}
              className="z-20"
            >
              <div
                data-annotation-box="true"
                ref={imageToolbarRef}
                className="pointer-events-auto max-w-[calc(100vw-2rem)]"
                style={{ visibility: toolbarPositions.image ? 'visible' : 'hidden' }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
              >
                <ImageStyleToolbar
                  dragHandleClassName="annotation-toolbar__drag-handle"
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
            </Rnd>
          ) : null}
        </div>
      </div>
    </section>
  );
}
