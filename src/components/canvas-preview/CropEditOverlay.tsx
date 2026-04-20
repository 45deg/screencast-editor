import { Focus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Rnd } from 'react-rnd';
import type { RefObject } from 'react';

import type { CropRect } from '../../types/editor';

interface CropEditOverlayProps {
  videoObjectUrl: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  isSceneCrop: boolean;
  videoFrame: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  safeEditCrop: CropRect;
  viewportScale: number;
  onEditCropPreview: (crop: CropRect) => void;
  onLoadedMetadata: () => void;
}

export default function CropEditOverlay({
  videoObjectUrl,
  videoRef,
  isSceneCrop,
  videoFrame,
  safeEditCrop,
  viewportScale,
  onEditCropPreview,
  onLoadedMetadata,
}: CropEditOverlayProps) {
  const { t } = useTranslation();
  const borderClassName = isSceneCrop ? 'border-amber-300/90' : 'border-cyan-300/90';
  const fillClassName = isSceneCrop ? 'bg-amber-200/10' : 'bg-cyan-200/10';
  const shadowClassName = 'shadow-[0_0_0_9999px_rgba(2,6,23,0.58)]';
  const lineClassName = isSceneCrop ? 'bg-amber-100/60' : 'bg-cyan-100/60';
  const handleClassName = `absolute rounded-full border bg-slate-950 ${isSceneCrop ? 'border-amber-200' : 'border-cyan-200'}`;
  const labelClassName = isSceneCrop ? 'text-amber-100' : 'text-cyan-100';
  const labelBgClassName = 'bg-slate-950/75';
  const minSize = Math.max(24, 24 * viewportScale);
  const cropBox = {
    x: safeEditCrop.x * viewportScale,
    y: safeEditCrop.y * viewportScale,
    width: safeEditCrop.w * viewportScale,
    height: safeEditCrop.h * viewportScale,
  };

  const publishCrop = (x: number, y: number, width: number, height: number) => {
    onEditCropPreview({
      x: Math.round(x / Math.max(0.0001, viewportScale)),
      y: Math.round(y / Math.max(0.0001, viewportScale)),
      w: Math.round(width / Math.max(0.0001, viewportScale)),
      h: Math.round(height / Math.max(0.0001, viewportScale)),
    });
  };

  return (
    <>
      <video
        ref={videoRef}
        src={videoObjectUrl}
        muted
        controls={false}
        preload="auto"
        className="absolute object-contain"
        style={{
          left: `${videoFrame.left}px`,
          top: `${videoFrame.top}px`,
          width: `${videoFrame.width}px`,
          height: `${videoFrame.height}px`,
        }}
        onLoadedMetadata={onLoadedMetadata}
      />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,transparent_45%,rgba(2,6,23,0.5)_100%)]" />

      <div
        className="absolute"
        style={{
          left: `${videoFrame.left}px`,
          top: `${videoFrame.top}px`,
          width: `${videoFrame.width}px`,
          height: `${videoFrame.height}px`,
        }}
      >
        <Rnd
          bounds="parent"
          size={{ width: cropBox.width, height: cropBox.height }}
          position={{ x: cropBox.x, y: cropBox.y }}
          minWidth={minSize}
          minHeight={minSize}
          onDrag={(_, data) => publishCrop(data.x, data.y, cropBox.width, cropBox.height)}
          onResize={(_, __, ref, ___, position) =>
            publishCrop(position.x, position.y, ref.offsetWidth, ref.offsetHeight)
          }
          className={`border-2 ${borderClassName} ${fillClassName} ${shadowClassName}`}
          dragHandleClassName="crop-rnd__drag"
          resizeHandleComponent={{
            top: <span aria-hidden="true" className={`${handleClassName} left-1/2 top-0 h-4 w-8 -translate-x-1/2 -translate-y-1/4`} />,
            right: <span aria-hidden="true" className={`${handleClassName} right-0 top-1/2 h-8 w-4 -translate-y-1/2 translate-x-1/4`} />,
            bottom: <span aria-hidden="true" className={`${handleClassName} bottom-0 left-1/2 h-4 w-8 -translate-x-1/2 translate-y-1/4`} />,
            left: <span aria-hidden="true" className={`${handleClassName} left-0 top-1/2 h-8 w-4 -translate-y-1/2 -translate-x-1/4`} />,
            topLeft: <span aria-hidden="true" className={`${handleClassName} left-0 top-0 h-4 w-4`} />,
            topRight: <span aria-hidden="true" className={`${handleClassName} right-0 top-0 h-4 w-4`} />,
            bottomLeft: <span aria-hidden="true" className={`${handleClassName} bottom-0 left-0 h-4 w-4`} />,
            bottomRight: <span aria-hidden="true" className={`${handleClassName} bottom-0 right-0 h-4 w-4`} />,
          }}
        >
          <button
            type="button"
            className="crop-rnd__drag absolute inset-0 cursor-move"
            aria-label={t('canvas.moveCrop')}
          />
          <div className={`pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 ${lineClassName}`} />
          <div className={`pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 ${lineClassName}`} />
          <div
            className={`pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded px-2 py-1 font-mono text-[10px] ${labelBgClassName} ${labelClassName}`}
          >
            <Focus size={11} />
            {safeEditCrop.w}x{safeEditCrop.h} @ {safeEditCrop.x},{safeEditCrop.y}
          </div>
        </Rnd>
      </div>
    </>
  );
}
