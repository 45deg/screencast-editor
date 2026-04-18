export interface ImageMeta {
  width: number;
  height: number;
}

export async function readImageMetaFromObjectUrl(objectUrl: string): Promise<ImageMeta> {
  return new Promise<ImageMeta>((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve({
        width: Math.max(1, Math.round(image.naturalWidth || image.width || 1)),
        height: Math.max(1, Math.round(image.naturalHeight || image.height || 1)),
      });
    };

    image.onerror = () => {
      reject(new Error('Failed to load image metadata.'));
    };

    image.src = objectUrl;
  });
}
