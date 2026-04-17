export interface VideoThumbnailOptions {
  videoUrl: string;
  time: number;
  width: number;
  height: number;
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

export async function captureVideoThumbnail({ videoUrl, time, width, height }: VideoThumbnailOptions): Promise<string> {
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
      fail('サムネイルの生成に失敗しました。');
    };

    video.onloadedmetadata = () => {
      const captureTime = getSafeCaptureTime(time, video.duration);
      try {
        video.currentTime = captureTime;
      } catch {
        fail('サムネイルのシークに失敗しました。');
      }
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width));
        canvas.height = Math.max(1, Math.round(height));

        const context = canvas.getContext('2d');
        if (!context) {
          fail('サムネイル描画用のキャンバスを初期化できませんでした。');
          return;
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        cleanup();
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      } catch {
        fail('サムネイルの描画に失敗しました。');
      }
    };

    video.src = videoUrl;
  });
}
