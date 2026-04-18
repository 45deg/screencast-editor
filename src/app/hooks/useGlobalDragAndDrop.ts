import { useEffect } from 'react';

import { getFirstImageFile, getFirstVideoFile } from '../appUtils';
import type { VideoMeta } from '../../types/editor';

interface UseGlobalDragAndDropArgs {
  hasVideo: boolean;
  video: VideoMeta | null;
  t: (key: string) => string;
  onImportVideo: (file: File) => Promise<void>;
  onCreateImageAnnotation: (file: File) => void | Promise<void>;
}

export function useGlobalDragAndDrop({
  hasVideo,
  video,
  t,
  onImportVideo,
  onCreateImageAnnotation,
}: UseGlobalDragAndDropArgs) {
  useEffect(() => {
    const handleWindowDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) {
        return;
      }

      const hasVideoFile = getFirstVideoFile(event.dataTransfer.files) !== null;
      const hasImageFile = getFirstImageFile(event.dataTransfer.files) !== null;
      if (!hasVideoFile && !(hasVideo && hasImageFile)) {
        return;
      }

      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleWindowDrop = (event: DragEvent) => {
      if (!event.dataTransfer?.files?.length) {
        return;
      }

      const nextFile = getFirstVideoFile(event.dataTransfer.files);
      const nextImage = getFirstImageFile(event.dataTransfer.files);
      if (!nextFile && !(hasVideo && nextImage)) {
        return;
      }

      event.preventDefault();

      if (hasVideo && nextImage && !nextFile) {
        void onCreateImageAnnotation(nextImage);
        return;
      }

      if (video && !window.confirm(t('app.replaceVideoConfirm'))) {
        return;
      }

      if (nextFile) {
        void onImportVideo(nextFile);
      }
    };

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [hasVideo, onCreateImageAnnotation, onImportVideo, t, video]);
}
