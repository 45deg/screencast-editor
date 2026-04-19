import {
  cloneAnnotations,
  cloneCrop,
  cloneSlices,
  deriveSlices,
  type SliceModel,
  getTotalDuration,
} from '../../types/editor';
import {
  MIN_SLICE_DURATION,
  normalizeSelectedAnnotationId,
  normalizeSelectedSliceId,
  snapshotFromState,
} from '../editorStoreHelpers';
import type { EditorStoreSet, TimelineActions } from './types';

export function createTimelineActions(set: EditorStoreSet): TimelineActions {
  return {
    replaceSlicesPreview: (slices) => {
      const nextSlices = cloneSlices(slices);
      set((state) => ({
        slices: nextSlices,
        currentTime: Math.min(state.currentTime, getTotalDuration(nextSlices, state.annotations)),
        selectedSliceId: normalizeSelectedSliceId(state.selectedSliceId, nextSlices),
      }));
    },

    replaceSlicesCommit: (slices, selectedSliceId) => {
      const nextSlices = cloneSlices(slices);
      set((state) => ({
        past: [...state.past, snapshotFromState(state)],
        future: [],
        slices: nextSlices,
        currentTime: Math.min(state.currentTime, getTotalDuration(nextSlices, state.annotations)),
        selectedSliceId: normalizeSelectedSliceId(
          selectedSliceId === undefined ? state.selectedSliceId : selectedSliceId,
          nextSlices,
        ),
        selectedAnnotationId:
          selectedSliceId === undefined
            ? state.selectedAnnotationId
            : selectedSliceId
              ? null
              : state.selectedAnnotationId,
      }));
    },

    replaceAnnotationsPreview: (annotations) => {
      const nextAnnotations = cloneAnnotations(annotations);
      set((state) => ({
        annotations: nextAnnotations,
        currentTime: Math.min(state.currentTime, getTotalDuration(state.slices, nextAnnotations)),
        selectedAnnotationId: normalizeSelectedAnnotationId(state.selectedAnnotationId, nextAnnotations),
      }));
    },

    replaceAnnotationsCommit: (annotations, selectedAnnotationId) => {
      const nextAnnotations = cloneAnnotations(annotations);
      set((state) => ({
        past: [...state.past, snapshotFromState(state)],
        future: [],
        annotations: nextAnnotations,
        currentTime: Math.min(state.currentTime, getTotalDuration(state.slices, nextAnnotations)),
        selectedAnnotationId: normalizeSelectedAnnotationId(
          selectedAnnotationId === undefined ? state.selectedAnnotationId : selectedAnnotationId,
          nextAnnotations,
        ),
        selectedSliceId:
          selectedAnnotationId === undefined
            ? state.selectedSliceId
            : selectedAnnotationId
              ? null
              : state.selectedSliceId,
      }));
    },

    cutAtCurrentTime: () => {
      set((state) => {
        const withPos = deriveSlices(state.slices);
        const target = withPos.find((slice) => state.currentTime > slice.start && state.currentTime < slice.end);

        if (!target) {
          return state;
        }

        const targetIndex = state.slices.findIndex((slice) => slice.id === target.id);
        if (targetIndex === -1) {
          return state;
        }

        const leftDuration = state.currentTime - target.start;
        const rightDuration = target.end - state.currentTime;

        if (leftDuration < MIN_SLICE_DURATION || rightDuration < MIN_SLICE_DURATION) {
          return state;
        }

        const ratio = leftDuration / target.duration;
        const splitSource = target.sourceStart + target.sourceDuration * ratio;

        const leftSlice: SliceModel = {
          id: crypto.randomUUID(),
          timelineStart: target.start,
          sourceStart: target.sourceStart,
          sourceEnd: splitSource,
          duration: leftDuration,
          crop: cloneCrop(target.crop),
        };
        const rightSlice: SliceModel = {
          id: crypto.randomUUID(),
          timelineStart: state.currentTime,
          sourceStart: splitSource,
          sourceEnd: target.sourceEnd,
          duration: rightDuration,
          crop: cloneCrop(target.crop),
        };

        const nextSlices = cloneSlices(state.slices);
        nextSlices.splice(targetIndex, 1, leftSlice, rightSlice);

        return {
          past: [...state.past, snapshotFromState(state)],
          future: [],
          slices: nextSlices,
          selectedSliceId: rightSlice.id,
          selectedAnnotationId: null,
        };
      });
    },

    deleteSelectedSlice: () => {
      set((state) => {
        if (!state.selectedSliceId) {
          return state;
        }

        const nextSlices = state.slices.filter((slice) => slice.id !== state.selectedSliceId);
        if (nextSlices.length === state.slices.length) {
          return state;
        }

        return {
          past: [...state.past, snapshotFromState(state)],
          future: [],
          slices: cloneSlices(nextSlices),
          currentTime: Math.min(state.currentTime, getTotalDuration(nextSlices, state.annotations)),
          selectedSliceId: null,
        };
      });
    },

    deleteSelectedAnnotation: () => {
      set((state) => {
        if (!state.selectedAnnotationId) {
          return state;
        }

        const nextAnnotations = state.annotations.filter(
          (annotation) => annotation.id !== state.selectedAnnotationId,
        );
        if (nextAnnotations.length === state.annotations.length) {
          return state;
        }

        return {
          past: [...state.past, snapshotFromState(state)],
          future: [],
          annotations: cloneAnnotations(nextAnnotations),
          currentTime: Math.min(state.currentTime, getTotalDuration(state.slices, nextAnnotations)),
          selectedAnnotationId: null,
        };
      });
    },

    setSliceSpeedCommit: (sliceId, speed) => {
      if (!Number.isFinite(speed) || speed <= 0) {
        return;
      }

      set((state) => {
        const nextSlices = cloneSlices(state.slices).map((slice) => {
          if (slice.id !== sliceId) {
            return slice;
          }

          const sourceDuration = slice.sourceEnd - slice.sourceStart;
          return {
            ...slice,
            duration: Math.max(MIN_SLICE_DURATION, sourceDuration / speed),
          };
        });

        return {
          past: [...state.past, snapshotFromState(state)],
          future: [],
          slices: nextSlices,
          currentTime: Math.min(state.currentTime, getTotalDuration(nextSlices, state.annotations)),
        };
      });
    },

    updateExportSettings: (next) => {
      set((state) => ({
        exportSettings: {
          ...state.exportSettings,
          ...next,
        },
      }));
    },

    setExportRuntimeStatus: (status, error = null) => {
      set({ exportRuntimeStatus: status, exportRuntimeError: error });
    },
  };
}
