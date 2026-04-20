import { useEffect, useMemo, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Rnd } from 'react-rnd';

import { createCropVideoStyle, type DisplayLayout } from './math';
import { toTextStyle } from './annotationMath';
import { clampAnnotationPosition, clampImageAnnotationRect } from '../../app/appUtils';
import type { AnnotationModel, CropRect, VideoMeta } from '../../types/editor';

interface PreviewOverlayProps {
  hasActiveVideoSlice: boolean;
  displayLayout: DisplayLayout;
  video: VideoMeta;
  videoRef: RefObject<HTMLVideoElement | null>;
  onVideoLoadedMetadata: () => void;
  baseCrop: CropRect;
  activeAnnotations: AnnotationModel[];
  selectedAnnotationId: string | null;
  editingTextAnnotationId: string | null;
  editingTextValue: string;
  setEditingTextValue: (value: string) => void;
  inlineEditorRef: RefObject<HTMLTextAreaElement | null>;
  commitInlineTextEdit: () => void;
  cancelInlineTextEdit: () => void;
  handleTextPointerDown: (event: React.PointerEvent, annotation: Extract<AnnotationModel, { kind: 'text' }>) => void;
  startInlineTextEdit: (annotation: Extract<AnnotationModel, { kind: 'text' }>) => void;
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
  previewScale: number;
  overlayWidth: number;
  overlayHeight: number;
  overlayOffsetX: number;
  overlayOffsetY: number;
}

export default function PreviewOverlay({
  hasActiveVideoSlice,
  displayLayout,
  video,
  videoRef,
  onVideoLoadedMetadata,
  baseCrop,
  activeAnnotations,
  selectedAnnotationId,
  editingTextAnnotationId,
  editingTextValue,
  setEditingTextValue,
  inlineEditorRef,
  commitInlineTextEdit,
  cancelInlineTextEdit,
  handleTextPointerDown,
  startInlineTextEdit,
  onSelectedAnnotationIdChange,
  onAnnotationPositionPreview,
  onAnnotationImageResizePreview,
  onAnnotationPositionCommit,
  previewScale,
  overlayWidth,
  overlayHeight,
  overlayOffsetX,
  overlayOffsetY,
}: PreviewOverlayProps) {
  const { t } = useTranslation();
  const videoStyle = useMemo(() => createCropVideoStyle(video, displayLayout.contentCrop), [displayLayout.contentCrop, video]);
  const imageResizeHandles = {
    top: false,
    right: false,
    bottom: false,
    left: false,
    topLeft: true,
    topRight: true,
    bottomLeft: true,
    bottomRight: true,
  } as const;
  const imageHandleClassName =
    'absolute h-5 w-5 rounded-full border border-cyan-200 bg-slate-950 shadow-[0_0_0_1px_rgba(15,23,42,0.55)]';

  useEffect(() => {
    if (!hasActiveVideoSlice) {
      return;
    }

    console.debug('[crop-debug] preview video placement', {
      baseCrop: `x=${baseCrop.x}, y=${baseCrop.y}, w=${baseCrop.w}, h=${baseCrop.h}`,
      contentCrop: `x=${displayLayout.contentCrop.x}, y=${displayLayout.contentCrop.y}, w=${displayLayout.contentCrop.w}, h=${displayLayout.contentCrop.h}`,
      padBox: displayLayout.padBox,
      videoStyle,
      previewScale,
      overlayOffsetX,
      overlayOffsetY,
    });
  }, [baseCrop, displayLayout.contentCrop, displayLayout.padBox, hasActiveVideoSlice, overlayOffsetX, overlayOffsetY, previewScale, videoStyle]);

  return (
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
              style={videoStyle}
            />
          </div>
        ) : (
          <div
            className="absolute overflow-hidden"
            style={{
              left: `${overlayOffsetX}px`,
              top: `${overlayOffsetY}px`,
              width: `${overlayWidth}px`,
              height: `${overlayHeight}px`,
            }}
          >
            <video
              ref={videoRef}
              src={video.objectUrl}
              muted
              controls={false}
              preload="auto"
              className="absolute"
              onLoadedMetadata={onVideoLoadedMetadata}
              style={videoStyle}
            />
          </div>
        )
      ) : null}

      <div
        className="absolute select-none"
        style={{
          left: `${overlayOffsetX}px`,
          top: `${overlayOffsetY}px`,
          width: `${baseCrop.w}px`,
          height: `${baseCrop.h}px`,
          transform: `scale(${previewScale})`,
          transformOrigin: 'top left',
        }}
      >
        {activeAnnotations.map((annotation) => {
          const left = annotation.x;
          const top = annotation.y;
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
                  wrap="off"
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
                  className="absolute overflow-x-auto overflow-y-hidden border border-cyan-200 bg-slate-900/95 text-left outline-none ring-2 ring-cyan-300/80 ring-offset-2 ring-offset-black"
                  style={{
                    left: `${left}px`,
                    top: `${top}px`,
                    minWidth: `${Math.min(Math.max(140, baseCrop.w * 0.24), baseCrop.w * 0.94)}px`,
                    minHeight: `${Math.max(44, baseCrop.h * 0.06)}px`,
                    resize: 'none',
                    ...toTextStyle(annotation.style, 1),
                  }}
                  aria-label={t('canvas.textContent')}
                />
              );
            }

            return (
              <Rnd
                key={annotation.id}
                bounds="parent"
                enableResizing={false}
                dragHandleClassName="annotation-rnd__drag"
                scale={previewScale}
                position={{ x: left, y: top }}
                size={{ width: 'auto', height: 'auto' }}
                onDragStart={() => {
                  onSelectedAnnotationIdChange(annotation.id);
                }}
                onDrag={(_, data) => {
                  const clamped = clampAnnotationPosition(annotation, data.x, data.y, baseCrop);
                  onAnnotationPositionPreview(annotation.id, clamped.x, clamped.y);
                }}
                onDragStop={(_, data) => {
                  const clamped = clampAnnotationPosition(annotation, data.x, data.y, baseCrop);
                  onAnnotationPositionPreview(annotation.id, clamped.x, clamped.y);
                  onAnnotationPositionCommit();
                }}
              >
                <button
                  data-annotation-box="true"
                  type="button"
                  onPointerDown={(event) => handleTextPointerDown(event, annotation)}
                  onDoubleClick={() => startInlineTextEdit(annotation)}
                  className={`annotation-rnd__drag block cursor-move select-none text-left transition ${
                    selected ? 'ring-2 ring-cyan-300/80 ring-offset-2 ring-offset-black' : ''
                  }`}
                  style={toTextStyle(annotation.style, 1)}
                >
                  {annotation.text || t('canvas.textPlaceholder')}
                </button>
              </Rnd>
            );
          }

          const width = annotation.width;
          const height = annotation.height;

          return (
            <Rnd
              key={annotation.id}
              bounds="parent"
              scale={previewScale}
              lockAspectRatio
              dragHandleClassName="annotation-rnd__drag"
              enableResizing={selected ? imageResizeHandles : false}
              position={{ x: left, y: top }}
              size={{ width: Math.max(24, width), height: Math.max(24, height) }}
              resizeHandleComponent={{
                topLeft: (
                  <span
                    aria-hidden="true"
                    data-annotation-box="true"
                    className={`${imageHandleClassName} -left-2.5 -top-2.5`}
                  />
                ),
                topRight: (
                  <span
                    aria-hidden="true"
                    data-annotation-box="true"
                    className={`${imageHandleClassName} -right-2.5 -top-2.5`}
                  />
                ),
                bottomLeft: (
                  <span
                    aria-hidden="true"
                    data-annotation-box="true"
                    className={`${imageHandleClassName} -bottom-2.5 -left-2.5`}
                  />
                ),
                bottomRight: (
                  <span
                    aria-hidden="true"
                    data-annotation-box="true"
                    className={`${imageHandleClassName} -bottom-2.5 -right-2.5`}
                  />
                ),
              }}
              onDragStart={() => {
                onSelectedAnnotationIdChange(annotation.id);
              }}
              onDrag={(_, data) => {
                const clamped = clampAnnotationPosition(annotation, data.x, data.y, baseCrop);
                onAnnotationPositionPreview(annotation.id, clamped.x, clamped.y);
              }}
              onDragStop={(_, data) => {
                const clamped = clampAnnotationPosition(annotation, data.x, data.y, baseCrop);
                onAnnotationPositionPreview(annotation.id, clamped.x, clamped.y);
                onAnnotationPositionCommit();
              }}
              onResizeStart={() => {
                onSelectedAnnotationIdChange(annotation.id);
              }}
              onResize={(_, __, ref, ___, position) => {
                const clamped = clampImageAnnotationRect(
                  baseCrop,
                  annotation,
                  position.x,
                  position.y,
                  ref.offsetWidth,
                  ref.offsetHeight,
                );
                onAnnotationImageResizePreview(
                  annotation.id,
                  clamped.x,
                  clamped.y,
                  clamped.width,
                  clamped.height,
                );
              }}
              onResizeStop={(_, __, ref, ___, position) => {
                const clamped = clampImageAnnotationRect(
                  baseCrop,
                  annotation,
                  position.x,
                  position.y,
                  ref.offsetWidth,
                  ref.offsetHeight,
                );
                onAnnotationImageResizePreview(
                  annotation.id,
                  clamped.x,
                  clamped.y,
                  clamped.width,
                  clamped.height,
                );
                onAnnotationPositionCommit();
              }}
            >
              <button
                data-annotation-box="true"
                type="button"
                onPointerDown={() => onSelectedAnnotationIdChange(annotation.id)}
                className={`annotation-rnd__drag h-full w-full cursor-move select-none overflow-hidden rounded-md border bg-slate-950/20 transition ${
                  selected ? 'border-cyan-200' : 'border-slate-200/50'
                }`}
                style={{
                  opacity: Math.max(0, Math.min(1, annotation.opacity ?? 1)),
                }}
              >
                <img
                  src={annotation.imageUrl}
                  alt=""
                  draggable={false}
                  onDragStart={(event) => {
                    event.preventDefault();
                  }}
                  className="pointer-events-none h-full w-full object-contain"
                />
              </button>
            </Rnd>
          );
        })}
      </div>
    </>
  );
}
