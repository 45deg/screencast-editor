import { useMemo } from 'react';

import {
  clampCropToVideo,
  formatDurationLabel,
  formatFileSize,
  getDefaultCrop,
  getDefaultSceneCrop,
} from '../appUtils';
import {
  findVideoSourceById,
  findSliceAtTimelineTime,
  getActiveVideoSourceAtTimelineTime,
  getActiveAnnotationsAtTimelineTime,
  getSourceTimeAtTimelineTime,
  getTotalDuration,
  type AnnotationModel,
  type CropRect,
  type ExportSettings,
  type ImageAnnotation,
  type SliceModel,
  type TextAnnotation,
  type VideoMeta,
} from '../../types/editor';

interface UseAppDerivedStateArgs {
  sources: VideoMeta[];
  globalCrop: CropRect | null;
  slices: SliceModel[];
  annotations: AnnotationModel[];
  currentTime: number;
  selectedAnnotationId: string | null;
  exportSettings: ExportSettings;
}

export function useAppDerivedState({
  sources,
  globalCrop,
  slices,
  annotations,
  currentTime,
  selectedAnnotationId,
  exportSettings,
}: UseAppDerivedStateArgs) {
  const previewSlice = useMemo(() => findSliceAtTimelineTime(slices, currentTime), [currentTime, slices]);
  const video = useMemo(() => {
    if (previewSlice) {
      return findVideoSourceById(sources, previewSlice.sourceId) ?? sources[0] ?? null;
    }

    return getActiveVideoSourceAtTimelineTime(sources, slices, currentTime);
  }, [currentTime, previewSlice, slices, sources]);
  const primaryVideo = sources[0] ?? null;
  const referenceBaseCrop = useMemo(() => {
    if (!primaryVideo) {
      return null;
    }

    const crop = globalCrop ? clampCropToVideo(globalCrop, primaryVideo) : getDefaultCrop(primaryVideo.width, primaryVideo.height);
    return {
      x: 0,
      y: 0,
      w: crop.w,
      h: crop.h,
    };
  }, [globalCrop, primaryVideo]);

  const fullCrop = useMemo(() => {
    if (!video) {
      return null;
    }

    return getDefaultCrop(video.width, video.height);
  }, [video]);

  const baseCrop = useMemo(() => {
    return referenceBaseCrop;
  }, [referenceBaseCrop]);

  const activeSceneCrop = useMemo(() => {
    if (!video || !baseCrop) {
      return null;
    }

    const referenceAspectRatio = baseCrop.w / Math.max(1, baseCrop.h);
    const preferredCrop = previewSlice?.crop ?? (video.id === primaryVideo?.id ? globalCrop : null);
    return getDefaultSceneCrop(video, referenceAspectRatio, preferredCrop ?? null);
  }, [baseCrop, globalCrop, previewSlice, primaryVideo, video]);

  const activeAnnotations = useMemo(
    () => getActiveAnnotationsAtTimelineTime(annotations, currentTime),
    [annotations, currentTime],
  );

  const selectedTextAnnotation = useMemo(() => {
    const selected = annotations.find((annotation) => annotation.id === selectedAnnotationId);
    if (!selected || selected.kind !== 'text') {
      return null;
    }

    return selected as TextAnnotation;
  }, [annotations, selectedAnnotationId]);

  const selectedImageAnnotation = useMemo(() => {
    const selected = activeAnnotations.find((annotation) => annotation.id === selectedAnnotationId);
    if (!selected || selected.kind !== 'image') {
      return null;
    }

    return selected as ImageAnnotation;
  }, [activeAnnotations, selectedAnnotationId]);

  const hasVideo = Boolean(primaryVideo && referenceBaseCrop);
  const totalDuration = useMemo(() => getTotalDuration(slices, annotations), [annotations, slices]);
  const previewSourceTime = useMemo(() => getSourceTimeAtTimelineTime(slices, currentTime), [currentTime, slices]);
  const videoInfoItems = useMemo(() => {
    if (!video) {
      return [];
    }

    return [
      `${video.width}x${video.height}`,
      formatDurationLabel(video.duration),
      formatFileSize(video.file.size),
    ];
  }, [video]);

  const outputAspectRatio = useMemo(
    () => exportSettings.width / Math.max(1, exportSettings.height),
    [exportSettings.height, exportSettings.width],
  );

  return {
    fullCrop,
    baseCrop,
    video,
    primaryVideo,
    previewSlice,
    activeSceneCrop,
    activeAnnotations,
    selectedTextAnnotation,
    selectedImageAnnotation,
    hasVideo,
    totalDuration,
    previewSourceTime,
    videoInfoItems,
    outputAspectRatio,
  };
}
