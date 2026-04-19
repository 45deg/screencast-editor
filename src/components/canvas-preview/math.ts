import type { CSSProperties } from 'react';

import type { CropRect, VideoMeta } from '../../types/editor';

export type DragMode = 'move' | 'n' | 's' | 'w' | 'e' | 'nw' | 'ne' | 'sw' | 'se';

export interface ViewportInfo {
  scale: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

interface PadBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DisplayLayout {
  frameCrop: CropRect;
  contentCrop: CropRect;
  padBox: PadBox | null;
}

const MIN_CROP_SIZE = 24;

export function clampRectToVideo(rect: CropRect, video: VideoMeta): CropRect {
  const x = Math.max(0, Math.min(video.width - 1, Math.round(rect.x)));
  const y = Math.max(0, Math.min(video.height - 1, Math.round(rect.y)));
  const maxW = Math.max(1, video.width - x);
  const maxH = Math.max(1, video.height - y);

  return {
    x,
    y,
    w: Math.max(1, Math.min(maxW, Math.round(rect.w))),
    h: Math.max(1, Math.min(maxH, Math.round(rect.h))),
  };
}

export function createCropVideoStyle(video: VideoMeta, crop: CropRect): CSSProperties {
  const safeW = Math.max(1, crop.w);
  const safeH = Math.max(1, crop.h);

  const style: CSSProperties = {
    position: 'absolute',
    width: `${(video.width / safeW) * 100}%`,
    height: `${(video.height / safeH) * 100}%`,
    left: `${-(crop.x / safeW) * 100}%`,
    top: `${-(crop.y / safeH) * 100}%`,
    maxWidth: 'none',
    maxHeight: 'none',
  };

  return style;
}

export function computeDisplayLayout(video: VideoMeta, baseCrop: CropRect, sceneCrop: CropRect | null): DisplayLayout {
  const safeBase = clampRectToVideo(baseCrop, video);
  const safeScene = sceneCrop ? clampRectToVideo(sceneCrop, video) : safeBase;

  if (safeScene.w === safeBase.w && safeScene.h === safeBase.h) {
    return {
      frameCrop: safeBase,
      contentCrop: safeScene,
      padBox: null,
    };
  }

  const scale = Math.min(safeBase.w / safeScene.w, safeBase.h / safeScene.h);
  const scaledWidth = safeScene.w * scale;
  const scaledHeight = safeScene.h * scale;

  return {
    frameCrop: safeBase,
    contentCrop: safeScene,
    padBox: {
      left: ((safeBase.w - scaledWidth) / 2 / safeBase.w) * 100,
      top: ((safeBase.h - scaledHeight) / 2 / safeBase.h) * 100,
      width: (scaledWidth / safeBase.w) * 100,
      height: (scaledHeight / safeBase.h) * 100,
    },
  };
}

export function resizeCrop(initial: CropRect, mode: DragMode, dx: number, dy: number, video: VideoMeta): CropRect {
  if (mode === 'move') {
    const maxX = Math.max(0, video.width - initial.w);
    const maxY = Math.max(0, video.height - initial.h);
    return {
      ...initial,
      x: Math.max(0, Math.min(maxX, Math.round(initial.x + dx))),
      y: Math.max(0, Math.min(maxY, Math.round(initial.y + dy))),
    };
  }

  let left = initial.x;
  let right = initial.x + initial.w;
  let top = initial.y;
  let bottom = initial.y + initial.h;

  if (mode.includes('w')) {
    left += dx;
  }
  if (mode.includes('e')) {
    right += dx;
  }
  if (mode.includes('n')) {
    top += dy;
  }
  if (mode.includes('s')) {
    bottom += dy;
  }

  if (right - left < MIN_CROP_SIZE) {
    if (mode.includes('w') && !mode.includes('e')) {
      left = right - MIN_CROP_SIZE;
    } else {
      right = left + MIN_CROP_SIZE;
    }
  }

  if (bottom - top < MIN_CROP_SIZE) {
    if (mode.includes('n') && !mode.includes('s')) {
      top = bottom - MIN_CROP_SIZE;
    } else {
      bottom = top + MIN_CROP_SIZE;
    }
  }

  if (left < 0) {
    left = 0;
    if (right - left < MIN_CROP_SIZE) {
      right = MIN_CROP_SIZE;
    }
  }
  if (top < 0) {
    top = 0;
    if (bottom - top < MIN_CROP_SIZE) {
      bottom = MIN_CROP_SIZE;
    }
  }

  if (right > video.width) {
    right = video.width;
    if (right - left < MIN_CROP_SIZE) {
      left = video.width - MIN_CROP_SIZE;
    }
  }
  if (bottom > video.height) {
    bottom = video.height;
    if (bottom - top < MIN_CROP_SIZE) {
      top = video.height - MIN_CROP_SIZE;
    }
  }

  return {
    x: Math.round(left),
    y: Math.round(top),
    w: Math.round(right - left),
    h: Math.round(bottom - top),
  };
}

export function measureViewport(container: HTMLDivElement, video: VideoMeta): ViewportInfo {
  const rect = container.getBoundingClientRect();
  const scale = Math.min(rect.width / video.width, rect.height / video.height);
  const width = video.width * scale;
  const height = video.height * scale;

  return {
    scale,
    width,
    height,
    offsetX: (rect.width - width) / 2,
    offsetY: (rect.height - height) / 2,
  };
}

export function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(2)}s`;
}
