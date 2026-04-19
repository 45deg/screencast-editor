import { useCallback, useEffect, useMemo, useState } from 'react';

import { clampCropToVideo, findSliceIdAtTimelineTime, normalizeCropForStorage } from '../appUtils';
import type { CropRect, SliceModel, VideoMeta } from '../../types/editor';

function formatCropRect(crop: CropRect | null) {
  if (!crop) {
    return null;
  }

  return `x=${crop.x}, y=${crop.y}, w=${crop.w}, h=${crop.h}`;
}

interface UseCropEditHandlersArgs {
  video: VideoMeta | null;
  videoObjectUrl: string | undefined;
  slices: SliceModel[];
  selectedSliceId: string | null;
  currentTime: number;
  globalCrop: CropRect | null;
  fullCrop: CropRect | null;
  baseCrop: CropRect | null;
  setSelectedAnnotationId: (annotationId: string | null) => void;
  setSelectedSliceId: (sliceId: string | null) => void;
  setGlobalCropCommit: (crop: CropRect | null) => void;
  setSliceCropCommit: (sliceId: string, crop: CropRect | null) => void;
}

export function useCropEditHandlers({
  video,
  videoObjectUrl,
  slices,
  selectedSliceId,
  currentTime,
  globalCrop,
  fullCrop,
  baseCrop,
  setSelectedAnnotationId,
  setSelectedSliceId,
  setGlobalCropCommit,
  setSliceCropCommit,
}: UseCropEditHandlersArgs) {
  const [cropEditMode, setCropEditMode] = useState<'idle' | 'crop' | 'scene'>('idle');
  const [cropEditDraft, setCropEditDraft] = useState<CropRect | null>(null);
  const [sceneCropTargetSliceId, setSceneCropTargetSliceId] = useState<string | null>(null);

  const isCropEditing = cropEditMode !== 'idle';

  const effectiveEditCrop = useMemo(() => {
    if (!video || !isCropEditing || !fullCrop) {
      return null;
    }

    return clampCropToVideo(cropEditDraft ?? fullCrop, video);
  }, [cropEditDraft, fullCrop, isCropEditing, video]);

  const closeCropEditor = useCallback(() => {
    setCropEditMode('idle');
    setCropEditDraft(null);
    setSceneCropTargetSliceId(null);
  }, []);

  const handleStartCropEdit = useCallback(() => {
    if (!video || !fullCrop) {
      return;
    }

    const initial = globalCrop ? clampCropToVideo(globalCrop, video) : fullCrop;
    setSelectedAnnotationId(null);
    setCropEditMode('crop');
    setSceneCropTargetSliceId(null);
    setCropEditDraft(initial);
  }, [fullCrop, globalCrop, setSelectedAnnotationId, video]);

  const handleStartSceneCropEdit = useCallback(() => {
    if (!video || !slices.length || !baseCrop) {
      return;
    }

    const targetSliceId = selectedSliceId ?? findSliceIdAtTimelineTime(slices, currentTime);
    if (!targetSliceId) {
      return;
    }

    const targetSlice = slices.find((slice) => slice.id === targetSliceId);
    if (!targetSlice) {
      return;
    }

    setSelectedAnnotationId(null);
    setSelectedSliceId(targetSliceId);
    setCropEditMode('scene');
    setSceneCropTargetSliceId(targetSliceId);
    setCropEditDraft(targetSlice.crop ? clampCropToVideo(targetSlice.crop, video) : baseCrop);
  }, [baseCrop, currentTime, selectedSliceId, setSelectedAnnotationId, setSelectedSliceId, slices, video]);

  const handleEditCropPreview = useCallback(
    (crop: CropRect) => {
      if (!video) {
        return;
      }

      setCropEditDraft(clampCropToVideo(crop, video));
    },
    [video],
  );

  const handleConfirmCropEdit = useCallback(() => {
    if (!video || !effectiveEditCrop) {
      closeCropEditor();
      return;
    }

    const nextCrop = normalizeCropForStorage(effectiveEditCrop, video);

    console.debug('[crop-debug] confirm requested', {
      mode: cropEditMode,
      sceneCropTargetSliceId,
      videoSize: `${video.width}x${video.height}`,
      globalCrop: formatCropRect(globalCrop),
      baseCrop: formatCropRect(baseCrop),
      fullCrop: formatCropRect(fullCrop),
      effectiveEditCrop: formatCropRect(effectiveEditCrop),
      nextCrop: formatCropRect(nextCrop),
    });

    if (cropEditMode === 'crop') {
      setGlobalCropCommit(nextCrop);
      closeCropEditor();
      return;
    }

    if (cropEditMode === 'scene' && sceneCropTargetSliceId) {
      setSliceCropCommit(sceneCropTargetSliceId, nextCrop);
    }

    closeCropEditor();
  }, [
    closeCropEditor,
    cropEditMode,
    effectiveEditCrop,
    sceneCropTargetSliceId,
    setGlobalCropCommit,
    setSliceCropCommit,
    video,
  ]);

  const handleCancelCropEdit = useCallback(() => {
    closeCropEditor();
  }, [closeCropEditor]);

  const handleResetCropEdit = useCallback(() => {
    if (!fullCrop) {
      return;
    }

    setCropEditDraft(fullCrop);
  }, [fullCrop]);

  useEffect(() => {
    setCropEditMode('idle');
    setCropEditDraft(null);
    setSceneCropTargetSliceId(null);
  }, [videoObjectUrl]);

  return {
    cropEditMode,
    cropEditDraft,
    sceneCropTargetSliceId,
    isCropEditing,
    effectiveEditCrop,
    setCropEditMode,
    setCropEditDraft,
    setSceneCropTargetSliceId,
    closeCropEditor,
    handleStartCropEdit,
    handleStartSceneCropEdit,
    handleEditCropPreview,
    handleConfirmCropEdit,
    handleCancelCropEdit,
    handleResetCropEdit,
  };
}
