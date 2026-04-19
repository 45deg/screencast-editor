import { useCallback, useEffect, useMemo } from 'react';

import CanvasPreviewHeader from './canvas-preview/CanvasPreviewHeader';
import CropEditOverlay from './canvas-preview/CropEditOverlay';
import PreviewOverlay from './canvas-preview/PreviewOverlay';
import { clampRectToVideo, computeDisplayLayout } from './canvas-preview/math';
import { useAnnotationTransformHandlers } from './canvas-preview/useAnnotationTransformHandlers';
import { useCanvasPlayback } from './canvas-preview/useCanvasPlayback';
import { useCanvasViewport } from './canvas-preview/useCanvasViewport';
import { useCropDragHandler } from './canvas-preview/useCropDragHandler';
import { useTextAnnotationEditor } from './canvas-preview/useTextAnnotationEditor';
import type { AnnotationModel, AnnotationTextStyle, CropRect, TextAnnotation, VideoMeta } from '../types/editor';

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
  const isEditing = editMode !== 'idle';

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
      left: viewport.offsetX + safeEditCrop.x * viewport.scale,
      top: viewport.offsetY + safeEditCrop.y * viewport.scale,
      width: safeEditCrop.w * viewport.scale,
      height: safeEditCrop.h * viewport.scale,
    };
  }, [safeEditCrop, viewport]);

  const { beginDrag } = useCropDragHandler({
    isEditing,
    safeEditCrop,
    viewportScale: viewport.scale,
    video,
    onEditCropPreview,
  });

  const { setAnnotationDragging, setAnnotationResizing, beginAnnotationDrag, beginImageResize } =
    useAnnotationTransformHandlers({
      isEditing,
      frameSize,
      baseCrop,
      onSelectedAnnotationIdChange,
      onAnnotationPositionPreview,
      onAnnotationImageResizePreview,
      onAnnotationPositionCommit,
    });

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
    beginAnnotationDrag,
    onStartInlineEdit: () => {
      setAnnotationDragging(false);
      setAnnotationResizing(false);
    },
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

  const previewScale = Math.min(frameSize.width / Math.max(1, baseCrop.w), frameSize.height / Math.max(1, baseCrop.h));
  const overlayWidth = baseCrop.w * previewScale;
  const overlayHeight = baseCrop.h * previewScale;
  const overlayOffsetX = (frameSize.width - overlayWidth) / 2;
  const overlayOffsetY = (frameSize.height - overlayHeight) / 2;

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

  const selectedImageAnnotation = activeAnnotations.find(
    (annotation): annotation is Extract<AnnotationModel, { kind: 'image' }> =>
      annotation.id === selectedAnnotationId && annotation.kind === 'image',
  );
  const selectedImageFrame = selectedImageAnnotation
    ? {
        left: overlayOffsetX + selectedImageAnnotation.x * previewScale,
        top: overlayOffsetY + selectedImageAnnotation.y * previewScale,
        width: selectedImageAnnotation.width * previewScale,
        height: selectedImageAnnotation.height * previewScale,
      }
    : null;

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
        selectedTextAnnotation={selectedTextAnnotation}
        onTextAnnotationStyleChange={onTextAnnotationStyleChange}
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
              displayCrop={displayCrop}
              safeEditCrop={safeEditCrop}
              beginDrag={beginDrag}
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
              beginAnnotationDrag={beginAnnotationDrag}
              selectedImageFrame={selectedImageFrame}
              selectedImageAnnotation={selectedImageAnnotation}
              beginImageResize={beginImageResize}
              previewScale={previewScale}
              overlayWidth={overlayWidth}
              overlayHeight={overlayHeight}
              overlayOffsetX={overlayOffsetX}
              overlayOffsetY={overlayOffsetY}
            />
          )}
        </div>
      </div>
    </section>
  );
}
