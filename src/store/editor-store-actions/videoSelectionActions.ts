import { getTotalDuration, type SliceModel } from '../../types/editor';
import { nanoid } from 'nanoid';
import { getDefaultSceneCrop, normalizeCropForStorage } from '../../app/appUtils';
import {
  DEFAULT_EXPORT_SETTINGS,
  normalizeSelectedAnnotationId,
  normalizeSelectedSliceId,
  snapshotFromState,
} from '../editorStoreHelpers';
import type { EditorStoreGet, EditorStoreSet, VideoSelectionActions } from './types';

export function createVideoSelectionActions(
  set: EditorStoreSet,
  get: EditorStoreGet,
): VideoSelectionActions {
  return {
    setVideo: (video) => {
      const initialWidth = Math.max(1, Math.round(video.width));
      const initialHeight = Math.max(1, Math.round(video.height));

      const initialSlice: SliceModel = {
        id: nanoid(),
        sourceId: video.id,
        timelineStart: 0,
        sourceStart: 0,
        sourceEnd: video.duration,
        duration: video.duration,
        crop: null,
      };

      set({
        sources: [video],
        slices: [initialSlice],
        annotations: [],
        currentTime: 0,
        selectedSliceId: null,
        selectedAnnotationId: null,
        globalCrop: null,
        exportSettings: {
          ...DEFAULT_EXPORT_SETTINGS,
          width: initialWidth,
          height: initialHeight,
        },
        exportRuntimeStatus: 'idle',
        exportRuntimeError: null,
        past: [],
        future: [],
      });
    },

    addVideoSource: (video) => {
      set((state) => {
        const timelineStart = getTotalDuration(state.slices, state.annotations);
        const referenceSource = state.sources[0] ?? video;
        const referenceCrop = state.globalCrop;
        const referenceAspectRatio = referenceCrop
          ? referenceCrop.w / Math.max(1, referenceCrop.h)
          : referenceSource.width / Math.max(1, referenceSource.height);
        const nextSlice: SliceModel = {
          id: nanoid(),
          sourceId: video.id,
          timelineStart,
          sourceStart: 0,
          sourceEnd: video.duration,
          duration: video.duration,
          crop: normalizeCropForStorage(
            getDefaultSceneCrop(video, referenceAspectRatio),
            video,
          ),
        };

        return {
          past: [...state.past, snapshotFromState(state)],
          future: [],
          sources: [...state.sources, video],
          slices: [...state.slices, nextSlice],
          selectedSliceId: nextSlice.id,
          selectedAnnotationId: null,
        };
      });
    },

    clearVideo: () => {
      set({
        sources: [],
        slices: [],
        annotations: [],
        currentTime: 0,
        selectedSliceId: null,
        selectedAnnotationId: null,
        globalCrop: null,
        exportSettings: DEFAULT_EXPORT_SETTINGS,
        exportRuntimeStatus: 'idle',
        exportRuntimeError: null,
        past: [],
        future: [],
      });
    },

    setCurrentTime: (time) => {
      const state = get();
      const totalDuration = getTotalDuration(state.slices, state.annotations);
      const clamped = Math.max(0, Math.min(totalDuration, time));
      set({ currentTime: clamped });
    },

    setSelectedSliceId: (sliceId) => {
      const nextId = normalizeSelectedSliceId(sliceId, get().slices);
      set({
        selectedSliceId: nextId,
        selectedAnnotationId: nextId ? null : get().selectedAnnotationId,
      });
    },

    setSelectedAnnotationId: (annotationId) => {
      const nextId = normalizeSelectedAnnotationId(annotationId, get().annotations);
      set({
        selectedAnnotationId: nextId,
        selectedSliceId: nextId ? null : get().selectedSliceId,
      });
    },
  };
}
