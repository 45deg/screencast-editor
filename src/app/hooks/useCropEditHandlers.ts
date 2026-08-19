import { useCallback, useMemo, useState } from 'react';

import {
  clampCropToVideo,
  findSliceIdAtTimelineTime,
  getDefaultSceneCrop,
  normalizeCropForStorage,
} from '../appUtils';
import type { CropRect, SliceModel, VideoMeta } from '../../types/editor';

interface CropEditSession {
  videoObjectUrl: string | undefined;
  mode: 'idle' | 'crop' | 'scene';
  draft: CropRect | null;
  sceneTargetSliceId: string | null;
}

function createIdleCropEditSession(videoObjectUrl: string | undefined): CropEditSession {
  return {
    videoObjectUrl,
    mode: 'idle',
    draft: null,
    sceneTargetSliceId: null,
  };
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
  const [cropEditSession, setCropEditSession] = useState<CropEditSession>(() =>
    createIdleCropEditSession(videoObjectUrl),
  );
  const isCurrentVideoSession = cropEditSession.videoObjectUrl === videoObjectUrl;
  const cropEditMode = isCurrentVideoSession ? cropEditSession.mode : 'idle';
  const cropEditDraft = isCurrentVideoSession ? cropEditSession.draft : null;
  const sceneCropTargetSliceId = isCurrentVideoSession ? cropEditSession.sceneTargetSliceId : null;

  const isCropEditing = cropEditMode !== 'idle';

  const effectiveEditCrop = useMemo(() => {
    if (!video || !isCropEditing || !fullCrop) {
      return null;
    }

    return clampCropToVideo(cropEditDraft ?? fullCrop, video);
  }, [cropEditDraft, fullCrop, isCropEditing, video]);

  const closeCropEditor = useCallback(() => {
    setCropEditSession(createIdleCropEditSession(videoObjectUrl));
  }, [videoObjectUrl]);

  const handleStartCropEdit = useCallback(() => {
    if (!video || !fullCrop) {
      return;
    }

    const initial = globalCrop ? clampCropToVideo(globalCrop, video) : fullCrop;
    setSelectedAnnotationId(null);
    setCropEditSession({
      videoObjectUrl,
      mode: 'crop',
      draft: initial,
      sceneTargetSliceId: null,
    });
  }, [fullCrop, globalCrop, setSelectedAnnotationId, video, videoObjectUrl]);

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
    const referenceAspectRatio = baseCrop.w / Math.max(1, baseCrop.h);
    setCropEditSession({
      videoObjectUrl,
      mode: 'scene',
      sceneTargetSliceId: targetSliceId,
      draft: targetSlice.crop
        ? clampCropToVideo(targetSlice.crop, video)
        : getDefaultSceneCrop(video, referenceAspectRatio),
    });
  }, [baseCrop, currentTime, selectedSliceId, setSelectedAnnotationId, setSelectedSliceId, slices, video, videoObjectUrl]);

  const handleEditCropPreview = useCallback(
    (crop: CropRect) => {
      if (!video) {
        return;
      }

      setCropEditSession((current) => ({
        ...current,
        videoObjectUrl,
        draft: clampCropToVideo(crop, video),
      }));
    },
    [video, videoObjectUrl],
  );

  const handleConfirmCropEdit = useCallback(() => {
    if (!video || !effectiveEditCrop) {
      closeCropEditor();
      return;
    }

    const nextCrop = normalizeCropForStorage(effectiveEditCrop, video);

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

    setCropEditSession((current) => ({
      ...current,
      videoObjectUrl,
      draft: fullCrop,
    }));
  }, [fullCrop, videoObjectUrl]);

  return {
    cropEditMode,
    cropEditDraft,
    sceneCropTargetSliceId,
    isCropEditing,
    effectiveEditCrop,
    closeCropEditor,
    handleStartCropEdit,
    handleStartSceneCropEdit,
    handleEditCropPreview,
    handleConfirmCropEdit,
    handleCancelCropEdit,
    handleResetCropEdit,
  };
}
