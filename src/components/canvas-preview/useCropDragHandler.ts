import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { resizeCrop, type DragMode } from './math';
import type { CropRect, VideoMeta } from '../../types/editor';

interface DragState {
  mode: DragMode;
  startX: number;
  startY: number;
  initialCrop: CropRect;
  latestCrop: CropRect;
}

interface UseCropDragHandlerArgs {
  isEditing: boolean;
  safeEditCrop: CropRect;
  viewportScale: number;
  video: VideoMeta;
  onEditCropPreview: (crop: CropRect) => void;
}

export function useCropDragHandler({
  isEditing,
  safeEditCrop,
  viewportScale,
  video,
  onEditCropPreview,
}: UseCropDragHandlerArgs) {
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging || !isEditing) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || viewportScale <= 0) {
        return;
      }

      const dx = (event.clientX - current.startX) / viewportScale;
      const dy = (event.clientY - current.startY) / viewportScale;
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
  }, [dragging, isEditing, onEditCropPreview, video, viewportScale]);

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

  return {
    dragging,
    beginDrag,
  };
}
