import { cloneAnnotations, cloneCrop, cloneSlices, cloneVideoSources, getTotalDuration } from '../../types/editor';
import {
  normalizeSelectedAnnotationId,
  normalizeSelectedSliceId,
  snapshotFromState,
} from '../editorStoreHelpers';
import type { EditorStoreSet, HistoryActions } from './types';

export function createHistoryActions(set: EditorStoreSet): HistoryActions {
  return {
    undo: () => {
      set((state) => {
        const previous = state.past[state.past.length - 1];
        if (!previous) {
          return state;
        }

        const nextSlices = cloneSlices(previous.slices);
        const nextAnnotations = cloneAnnotations(previous.annotations);

        return {
          past: state.past.slice(0, -1),
          future: [snapshotFromState(state), ...state.future],
          sources: cloneVideoSources(previous.sources),
          slices: nextSlices,
          annotations: nextAnnotations,
          globalCrop: cloneCrop(previous.globalCrop),
          currentTime: Math.min(state.currentTime, getTotalDuration(nextSlices, nextAnnotations)),
          selectedSliceId: normalizeSelectedSliceId(previous.selectedSliceId, nextSlices),
          selectedAnnotationId: normalizeSelectedAnnotationId(previous.selectedAnnotationId, nextAnnotations),
        };
      });
    },

    redo: () => {
      set((state) => {
        const [nextSnapshot, ...restFuture] = state.future;
        if (!nextSnapshot) {
          return state;
        }

        const nextSlices = cloneSlices(nextSnapshot.slices);
        const nextAnnotations = cloneAnnotations(nextSnapshot.annotations);

        return {
          past: [...state.past, snapshotFromState(state)],
          future: restFuture,
          sources: cloneVideoSources(nextSnapshot.sources),
          slices: nextSlices,
          annotations: nextAnnotations,
          globalCrop: cloneCrop(nextSnapshot.globalCrop),
          currentTime: Math.min(state.currentTime, getTotalDuration(nextSlices, nextAnnotations)),
          selectedSliceId: normalizeSelectedSliceId(nextSnapshot.selectedSliceId, nextSlices),
          selectedAnnotationId: normalizeSelectedAnnotationId(nextSnapshot.selectedAnnotationId, nextAnnotations),
        };
      });
    },
  };
}
