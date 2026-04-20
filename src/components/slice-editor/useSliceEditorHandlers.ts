import { useCallback, useRef, type ChangeEvent, type DragEvent, type RefObject } from 'react';

import type {
  AnnotationModel,
  DerivedAnnotation,
  DerivedSlice,
  SliceModel,
} from '../../types/editor';
import { getFirstImageFile, getFirstVideoFile } from '../../app/appUtils';
import { useSliceEditorMutationHandlers } from './useSliceEditorMutationHandlers';
import { useSliceEditorPointerHandlers } from './useSliceEditorPointerHandlers';

interface UseSliceEditorHandlersArgs {
  slices: SliceModel[];
  slicesWithPos: DerivedSlice[];
  annotations: AnnotationModel[];
  annotationsWithPos: DerivedAnnotation[];
  currentTime: number;
  totalDuration: number;
  pixelsPerSecond: number;
  selectedSliceId: string | null;
  selectedAnnotationId: string | null;
  timelineRef: RefObject<HTMLDivElement | null>;
  onCurrentTimeChange: (time: number) => void;
  onSelectedSliceIdChange: (id: string | null) => void;
  onSelectedAnnotationIdChange: (id: string | null) => void;
  onSlicesPreview: (slices: SliceModel[]) => void;
  onSlicesCommit: (slices: SliceModel[], selectedSliceId?: string | null) => void;
  onAnnotationsPreview: (annotations: AnnotationModel[]) => void;
  onAnnotationsCommit: (annotations: AnnotationModel[], selectedAnnotationId?: string | null) => void;
  onCreateImageAnnotation: (file: File) => void;
  onCreateVideoSource: (file: File) => Promise<void>;
  onUndo: () => void;
  onRedo: () => void;
}

export function useSliceEditorHandlers({
  slices,
  slicesWithPos,
  annotations,
  annotationsWithPos,
  currentTime,
  totalDuration,
  pixelsPerSecond,
  selectedSliceId,
  selectedAnnotationId,
  timelineRef,
  onCurrentTimeChange,
  onSelectedSliceIdChange,
  onSelectedAnnotationIdChange,
  onSlicesPreview,
  onSlicesCommit,
  onAnnotationsPreview,
  onAnnotationsCommit,
  onCreateImageAnnotation,
  onCreateVideoSource,
  onUndo,
  onRedo,
}: UseSliceEditorHandlersArgs) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const mutationHandlers = useSliceEditorMutationHandlers({
    slices,
    slicesWithPos,
    annotations,
    pixelsPerSecond,
    currentTime,
    selectedSliceId,
    selectedAnnotationId,
    onSelectedAnnotationIdChange,
    onSlicesPreview,
    onSlicesCommit,
    onAnnotationsPreview,
    onAnnotationsCommit,
    onUndo,
    onRedo,
  });

  const pointerHandlers = useSliceEditorPointerHandlers({
    timelineRef,
    currentTime,
    totalDuration,
    pixelsPerSecond,
    draggingAnnotationId: mutationHandlers.draggingAnnotationId,
    slicesWithPos,
    annotationsWithPos,
    onCurrentTimeChange,
    onSelectedSliceIdChange,
    onSelectedAnnotationIdChange,
  });

  const triggerImageInput = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const triggerVideoInput = useCallback(() => {
    videoInputRef.current?.click();
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

  const handleVideoInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      if (!file || !file.type.startsWith('video/')) {
        event.target.value = '';
        return;
      }

      void onCreateVideoSource(file);
      event.target.value = '';
    },
    [onCreateVideoSource],
  );

  const handleTimelineDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) {
      return;
    }

    const imageFile = getFirstImageFile(event.dataTransfer.files);
    const videoFile = getFirstVideoFile(event.dataTransfer.files);
    if (!imageFile && !videoFile) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleTimelineDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const imageFile = getFirstImageFile(event.dataTransfer.files);
      const videoFile = getFirstVideoFile(event.dataTransfer.files);
      if (!imageFile && !videoFile) {
        return;
      }

      event.preventDefault();

      if (videoFile) {
        void onCreateVideoSource(videoFile);
        return;
      }

      if (imageFile) {
        onCreateImageAnnotation(imageFile);
      }
    },
    [onCreateImageAnnotation, onCreateVideoSource],
  );

  return {
    imageInputRef,
    videoInputRef,
    ...mutationHandlers,
    ...pointerHandlers,
    triggerImageInput,
    triggerVideoInput,
    handleImageInputChange,
    handleVideoInputChange,
    handleTimelineDragOver,
    handleTimelineDrop,
  };
}
