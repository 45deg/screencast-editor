import { create } from 'zustand';

import {
  cloneCrop,
  cloneSlices,
  cropEquals,
  deriveSlices,
  type CropRect,
  type EditorSnapshot,
  type ExportSettings,
  type SliceModel,
  type VideoMeta,
  getTotalDuration,
} from '../types/editor';

const MIN_SLICE_DURATION = 0.5;

const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: 'gif',
  width: 640,
  height: 360,
  keepAspectRatio: true,
  gifFps: 10,
  paletteMode: 'global',
  dither: 'none',
  mp4Fps: 30,
  speedOverlay: true,
};

type FfmpegStatus = 'idle' | 'loading' | 'ready' | 'error';

interface EditorStoreState {
  video: VideoMeta | null;
  slices: SliceModel[];
  currentTime: number;
  selectedSliceId: string | null;
  globalCrop: CropRect | null;
  exportSettings: ExportSettings;
  commandPreview: string;
  ffmpegStatus: FfmpegStatus;
  ffmpegError: string | null;
  past: EditorSnapshot[];
  future: EditorSnapshot[];
  setVideo: (video: VideoMeta) => void;
  clearVideo: () => void;
  setCurrentTime: (time: number) => void;
  setSelectedSliceId: (sliceId: string | null) => void;
  replaceSlicesPreview: (slices: SliceModel[]) => void;
  replaceSlicesCommit: (slices: SliceModel[], selectedSliceId?: string | null) => void;
  cutAtCurrentTime: () => void;
  deleteSelectedSlice: () => void;
  setSliceSpeedCommit: (sliceId: string, speed: number) => void;
  setGlobalCropPreview: (crop: CropRect) => void;
  setGlobalCropCommit: (crop: CropRect) => void;
  setSelectedSliceCropPreview: (crop: CropRect) => void;
  setSelectedSliceCropCommit: (crop: CropRect) => void;
  updateExportSettings: (next: Partial<ExportSettings>) => void;
  setCommandPreview: (commandPreview: string) => void;
  setFfmpegStatus: (status: FfmpegStatus, error?: string | null) => void;
  undo: () => void;
  redo: () => void;
}

function snapshotFromState(state: Pick<EditorStoreState, 'slices' | 'globalCrop'>): EditorSnapshot {
  return {
    slices: cloneSlices(state.slices),
    globalCrop: cloneCrop(state.globalCrop),
  };
}

function normalizeSelectedSliceId(selectedSliceId: string | null, slices: SliceModel[]): string | null {
  if (!selectedSliceId) {
    return null;
  }

  return slices.some((slice) => slice.id === selectedSliceId) ? selectedSliceId : null;
}

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  video: null,
  slices: [],
  currentTime: 0,
  selectedSliceId: null,
  globalCrop: null,
  exportSettings: DEFAULT_EXPORT_SETTINGS,
  commandPreview: '',
  ffmpegStatus: 'idle',
  ffmpegError: null,
  past: [],
  future: [],

  setVideo: (video) => {
    const initialWidth = Math.min(DEFAULT_EXPORT_SETTINGS.width, video.width);
    const initialHeight = Math.max(16, Math.round((initialWidth * video.height) / Math.max(1, video.width)));

    const initialSlice: SliceModel = {
      id: crypto.randomUUID(),
      sourceStart: 0,
      sourceEnd: video.duration,
      duration: video.duration,
      crop: null,
    };

    set({
      video,
      slices: [initialSlice],
      currentTime: 0,
      selectedSliceId: null,
      globalCrop: {
        x: 0,
        y: 0,
        w: video.width,
        h: video.height,
      },
      exportSettings: {
        ...DEFAULT_EXPORT_SETTINGS,
        width: initialWidth,
        height: initialHeight,
      },
      commandPreview: '',
      ffmpegStatus: 'idle',
      ffmpegError: null,
      past: [],
      future: [],
    });
  },

  clearVideo: () => {
    set({
      video: null,
      slices: [],
      currentTime: 0,
      selectedSliceId: null,
      globalCrop: null,
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      commandPreview: '',
      ffmpegStatus: 'idle',
      ffmpegError: null,
      past: [],
      future: [],
    });
  },

  setCurrentTime: (time) => {
    const totalDuration = getTotalDuration(get().slices);
    const clamped = Math.max(0, Math.min(totalDuration, time));
    set({ currentTime: clamped });
  },

  setSelectedSliceId: (sliceId) => {
    const nextId = normalizeSelectedSliceId(sliceId, get().slices);
    set({ selectedSliceId: nextId });
  },

  replaceSlicesPreview: (slices) => {
    const nextSlices = cloneSlices(slices);
    set((state) => ({
      slices: nextSlices,
      currentTime: Math.min(state.currentTime, getTotalDuration(nextSlices)),
      selectedSliceId: normalizeSelectedSliceId(state.selectedSliceId, nextSlices),
    }));
  },

  replaceSlicesCommit: (slices, selectedSliceId) => {
    const nextSlices = cloneSlices(slices);
    set((state) => ({
      past: [...state.past, snapshotFromState(state)],
      future: [],
      slices: nextSlices,
      currentTime: Math.min(state.currentTime, getTotalDuration(nextSlices)),
      selectedSliceId: normalizeSelectedSliceId(
        selectedSliceId === undefined ? state.selectedSliceId : selectedSliceId,
        nextSlices,
      ),
    }));
  },

  cutAtCurrentTime: () => {
    set((state) => {
      const withPos = deriveSlices(state.slices);
      const targetIndex = withPos.findIndex((slice) => state.currentTime > slice.start && state.currentTime < slice.end);

      if (targetIndex === -1) {
        return state;
      }

      const target = withPos[targetIndex];
      const leftDuration = state.currentTime - target.start;
      const rightDuration = target.end - state.currentTime;

      if (leftDuration < MIN_SLICE_DURATION || rightDuration < MIN_SLICE_DURATION) {
        return state;
      }

      const ratio = leftDuration / target.duration;
      const splitSource = target.sourceStart + target.sourceDuration * ratio;

      const leftSlice: SliceModel = {
        id: crypto.randomUUID(),
        sourceStart: target.sourceStart,
        sourceEnd: splitSource,
        duration: leftDuration,
        crop: cloneCrop(target.crop),
      };
      const rightSlice: SliceModel = {
        id: crypto.randomUUID(),
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
        currentTime: Math.min(state.currentTime, getTotalDuration(nextSlices)),
        selectedSliceId: null,
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
        currentTime: Math.min(state.currentTime, getTotalDuration(nextSlices)),
      };
    });
  },

  setGlobalCropPreview: (crop) => {
    set({ globalCrop: { ...crop } });
  },

  setGlobalCropCommit: (crop) => {
    set((state) => {
      if (cropEquals(state.globalCrop, crop)) {
        return state;
      }

      return {
        past: [...state.past, snapshotFromState(state)],
        future: [],
        globalCrop: { ...crop },
      };
    });
  },

  setSelectedSliceCropPreview: (crop) => {
    set((state) => {
      if (!state.selectedSliceId) {
        return state;
      }

      const nextSlices = cloneSlices(state.slices).map((slice) => {
        if (slice.id !== state.selectedSliceId) {
          return slice;
        }

        return {
          ...slice,
          crop: { ...crop },
        };
      });

      return { slices: nextSlices };
    });
  },

  setSelectedSliceCropCommit: (crop) => {
    set((state) => {
      if (!state.selectedSliceId) {
        return state;
      }

      const currentSlice = state.slices.find((slice) => slice.id === state.selectedSliceId);
      if (!currentSlice || cropEquals(currentSlice.crop, crop)) {
        return state;
      }

      const nextSlices = cloneSlices(state.slices).map((slice) => {
        if (slice.id !== state.selectedSliceId) {
          return slice;
        }

        return {
          ...slice,
          crop: { ...crop },
        };
      });

      return {
        past: [...state.past, snapshotFromState(state)],
        future: [],
        slices: nextSlices,
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

  setCommandPreview: (commandPreview) => {
    set({ commandPreview });
  },

  setFfmpegStatus: (status, error = null) => {
    set({ ffmpegStatus: status, ffmpegError: error });
  },

  undo: () => {
    set((state) => {
      const previous = state.past[state.past.length - 1];
      if (!previous) {
        return state;
      }

      const nextSlices = cloneSlices(previous.slices);

      return {
        past: state.past.slice(0, -1),
        future: [snapshotFromState(state), ...state.future],
        slices: nextSlices,
        globalCrop: cloneCrop(previous.globalCrop),
        currentTime: Math.min(state.currentTime, getTotalDuration(nextSlices)),
        selectedSliceId: normalizeSelectedSliceId(state.selectedSliceId, nextSlices),
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

      return {
        past: [...state.past, snapshotFromState(state)],
        future: restFuture,
        slices: nextSlices,
        globalCrop: cloneCrop(nextSnapshot.globalCrop),
        currentTime: Math.min(state.currentTime, getTotalDuration(nextSlices)),
        selectedSliceId: normalizeSelectedSliceId(state.selectedSliceId, nextSlices),
      };
    });
  },
}));

export const editorConstants = {
  MIN_SLICE_DURATION,
};
