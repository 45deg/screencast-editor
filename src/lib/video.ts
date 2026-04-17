import type { VideoMeta } from '../types/editor';

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
        reject(new Error('動画メタデータの読み込みに失敗しました。対応形式か確認してください。'));
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
