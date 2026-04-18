import type { CropRect } from '../types/editor';
import { i18n } from '../i18n';

export interface VideoThumbnailOptions {
  videoUrl: string;
  time: number;
  width: number;
  height: number;
  baseCrop?: CropRect | null;
  sceneCrop?: CropRect | null;
}

function getSafeCaptureTime(time: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) {
    return Math.max(0, time);
  }

  const maxTime = Math.max(0, duration - 0.001);
  const safeTime = Math.max(0, Math.min(time, maxTime));

  if (safeTime === 0 && maxTime > 0) {
    return Math.min(0.001, maxTime);
  }

  return safeTime;
}

function clampCropToFrame(crop: CropRect, width: number, height: number): CropRect {
  const x = Math.max(0, Math.min(width - 1, Math.round(crop.x)));
  const y = Math.max(0, Math.min(height - 1, Math.round(crop.y)));
  const maxW = Math.max(1, width - x);
  const maxH = Math.max(1, height - y);

  return {
    x,
    y,
    w: Math.max(1, Math.min(maxW, Math.round(crop.w))),
    h: Math.max(1, Math.min(maxH, Math.round(crop.h))),
  };
}

function drawFrameWithCrop(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  outputWidth: number,
  outputHeight: number,
  baseCrop: CropRect | null | undefined,
  sceneCrop: CropRect | null | undefined,
): void {
  const sourceWidth = Math.max(1, Math.round(video.videoWidth));
  const sourceHeight = Math.max(1, Math.round(video.videoHeight));
  const fullCrop: CropRect = {
    x: 0,
    y: 0,
    w: sourceWidth,
    h: sourceHeight,
  };

  const safeBase = baseCrop ? clampCropToFrame(baseCrop, sourceWidth, sourceHeight) : fullCrop;
  const safeScene = sceneCrop ? clampCropToFrame(sceneCrop, sourceWidth, sourceHeight) : safeBase;

  const stageCanvas = document.createElement('canvas');
  stageCanvas.width = safeBase.w;
  stageCanvas.height = safeBase.h;

  const stageContext = stageCanvas.getContext('2d');
  if (!stageContext) {
    throw new Error(i18n.t('thumbnail.stageCanvasInitFailed'));
  }

  stageContext.fillStyle = '#000000';
  stageContext.fillRect(0, 0, stageCanvas.width, stageCanvas.height);

  if (safeScene.w === safeBase.w && safeScene.h === safeBase.h) {
    stageContext.drawImage(
      video,
      safeScene.x,
      safeScene.y,
      safeScene.w,
      safeScene.h,
      0,
      0,
      safeBase.w,
      safeBase.h,
    );
  } else {
    const scale = Math.min(safeBase.w / safeScene.w, safeBase.h / safeScene.h);
    const drawW = safeScene.w * scale;
    const drawH = safeScene.h * scale;
    const drawX = (safeBase.w - drawW) / 2;
    const drawY = (safeBase.h - drawH) / 2;

    stageContext.drawImage(
      video,
      safeScene.x,
      safeScene.y,
      safeScene.w,
      safeScene.h,
      drawX,
      drawY,
      drawW,
      drawH,
    );
  }

  context.fillStyle = '#000000';
  context.fillRect(0, 0, outputWidth, outputHeight);
  context.drawImage(stageCanvas, 0, 0, outputWidth, outputHeight);
}

export async function captureVideoThumbnail({
  videoUrl,
  time,
  width,
  height,
  baseCrop,
  sceneCrop,
}: VideoThumbnailOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };

    const fail = (message: string) => {
      cleanup();
      reject(new Error(message));
    };

    video.onerror = () => {
      fail(i18n.t('thumbnail.generationFailed'));
    };

    video.onloadedmetadata = () => {
      const captureTime = getSafeCaptureTime(time, video.duration);
      try {
        video.currentTime = captureTime;
      } catch {
        fail(i18n.t('thumbnail.seekFailed'));
      }
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width));
        canvas.height = Math.max(1, Math.round(height));

        const context = canvas.getContext('2d');
        if (!context) {
          fail(i18n.t('thumbnail.renderCanvasInitFailed'));
          return;
        }

        drawFrameWithCrop(context, video, canvas.width, canvas.height, baseCrop, sceneCrop);
        cleanup();
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      } catch {
        fail(i18n.t('thumbnail.drawFailed'));
      }
    };

    video.src = videoUrl;
  });
}
