import { cloneCrop, cloneSlices, cropEquals } from '../../types/editor';
import { snapshotFromState } from '../editorStoreHelpers';
import type { CropActions, EditorStoreSet } from './types';

export function createCropActions(set: EditorStoreSet): CropActions {
  return {
    setGlobalCropPreview: (crop) => {
      set({ globalCrop: cloneCrop(crop) });
    },

    setGlobalCropCommit: (crop) => {
      set((state) => {
        if (cropEquals(state.globalCrop, crop)) {
          return state;
        }

        return {
          past: [...state.past, snapshotFromState(state)],
          future: [],
          globalCrop: cloneCrop(crop),
        };
      });
    },

    setSliceCropPreview: (sliceId, crop) => {
      set((state) => {
        const targetSlice = state.slices.find((slice) => slice.id === sliceId);
        if (!targetSlice || cropEquals(targetSlice.crop, crop)) {
          return state;
        }

        const nextSlices = cloneSlices(state.slices).map((slice) => {
          if (slice.id !== sliceId) {
            return slice;
          }

          return {
            ...slice,
            crop: cloneCrop(crop),
          };
        });

        return { slices: nextSlices };
      });
    },

    setSliceCropCommit: (sliceId, crop) => {
      set((state) => {
        const currentSlice = state.slices.find((slice) => slice.id === sliceId);
        if (!currentSlice || cropEquals(currentSlice.crop, crop)) {
          return state;
        }

        const nextSlices = cloneSlices(state.slices).map((slice) => {
          if (slice.id !== sliceId) {
            return slice;
          }

          return {
            ...slice,
            crop: cloneCrop(crop),
          };
        });

        return {
          past: [...state.past, snapshotFromState(state)],
          future: [],
          slices: nextSlices,
        };
      });
    },
  };
}
