import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { createCropVideoStyle, type DisplayLayout } from './math';
import { toTextStyle, type ImageResizeMode } from './annotationMath';
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
  beginAnnotationDrag: (event: React.PointerEvent, annotation: AnnotationModel) => void;
  selectedImageFrame:
    | {
        left: number;
        top: number;
        width: number;
        height: number;
      }
    | null;
  selectedImageAnnotation: Extract<AnnotationModel, { kind: 'image' }> | undefined;
  beginImageResize: (
    event: React.PointerEvent,
    annotation: Extract<AnnotationModel, { kind: 'image' }>,
    mode: ImageResizeMode,
  ) => void;
  previewScale: number;
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
  beginAnnotationDrag,
  selectedImageFrame,
  selectedImageAnnotation,
  beginImageResize,
  previewScale,
  overlayOffsetX,
  overlayOffsetY,
}: PreviewOverlayProps) {
  const { t } = useTranslation();

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
              onLoadedMetadata={onVideoLoadedMetadata}
              style={createCropVideoStyle(video, displayLayout.contentCrop)}
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
                    minWidth: `${Math.min(Math.max(140, baseCrop.w * 0.24), baseCrop.w * 0.94)}px`,
                    maxWidth: `${baseCrop.w * 0.94}px`,
                    minHeight: `${Math.max(44, baseCrop.h * 0.06)}px`,
                    resize: 'none',
                    ...toTextStyle(annotation.style, 1),
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
                  ...toTextStyle(annotation.style, 1),
                }}
              >
                {annotation.text || t('canvas.textPlaceholder')}
              </button>
            );
          }

          const width = annotation.width;
          const height = annotation.height;

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
                  selected ? 'border-cyan-200' : 'border-slate-200/50'
                }`}
              >
                <img src={annotation.imageUrl} alt="" className="h-full w-full object-contain" />
              </button>
            </div>
          );
        })}
      </div>

      {selectedImageFrame && selectedImageAnnotation ? (
        <div
          className="pointer-events-none absolute border-2 border-cyan-300/90 ring-1 ring-cyan-200/60"
          style={{
            left: `${selectedImageFrame.left}px`,
            top: `${selectedImageFrame.top}px`,
            width: `${Math.max(10, selectedImageFrame.width)}px`,
            height: `${Math.max(10, selectedImageFrame.height)}px`,
          }}
        >
          <button
            type="button"
            onPointerDown={(event) => beginImageResize(event, selectedImageAnnotation, 'nw')}
            className="pointer-events-auto absolute -left-2 -top-2 h-4 w-4 cursor-nwse-resize rounded-full border border-cyan-200 bg-slate-950"
            aria-label={t('canvas.resizeNorthWest')}
          />
          <button
            type="button"
            onPointerDown={(event) => beginImageResize(event, selectedImageAnnotation, 'ne')}
            className="pointer-events-auto absolute -right-2 -top-2 h-4 w-4 cursor-nesw-resize rounded-full border border-cyan-200 bg-slate-950"
            aria-label={t('canvas.resizeNorthEast')}
          />
          <button
            type="button"
            onPointerDown={(event) => beginImageResize(event, selectedImageAnnotation, 'sw')}
            className="pointer-events-auto absolute -bottom-2 -left-2 h-4 w-4 cursor-nesw-resize rounded-full border border-cyan-200 bg-slate-950"
            aria-label={t('canvas.resizeSouthWest')}
          />
          <button
            type="button"
            onPointerDown={(event) => beginImageResize(event, selectedImageAnnotation, 'se')}
            className="pointer-events-auto absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-full border border-cyan-200 bg-slate-950"
            aria-label={t('canvas.resizeSouthEast')}
          />
        </div>
      ) : null}
    </>
  );
}
