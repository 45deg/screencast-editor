import type { VideoMeta } from '../types/editor';
import { i18n } from '../i18n';

export async function readVideoMetadata(file: File): Promise<VideoMeta> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const meta = await new Promise<{ width: number; height: number; duration: number }>((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;

      const cleanup = () => {
        video.removeAttribute('src');
        video.load();
      };

      video.onloadedmetadata = () => {
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: Number.isFinite(video.duration) ? video.duration : 0,
        });
        cleanup();
      };

      video.onerror = () => {
        reject(new Error(i18n.t('video.metadataLoadFailed')));
        cleanup();
      };

      video.src = objectUrl;
    });

    return {
      file,
      objectUrl,
      width: meta.width,
      height: meta.height,
      duration: meta.duration,
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export function revokeVideoObjectUrl(video: VideoMeta | null): void {
  if (!video?.objectUrl) {
    return;
  }

  URL.revokeObjectURL(video.objectUrl);
}
