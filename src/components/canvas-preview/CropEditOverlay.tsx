import { Focus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RefObject, PointerEvent as ReactPointerEvent } from 'react';

import type { CropRect } from '../../types/editor';
import type { DragMode } from './math';

interface CropEditOverlayProps {
  videoObjectUrl: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  isSceneCrop: boolean;
  displayCrop: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  safeEditCrop: CropRect;
  beginDrag: (event: ReactPointerEvent, mode: DragMode) => void;
  onLoadedMetadata: () => void;
}

export default function CropEditOverlay({
  videoObjectUrl,
  videoRef,
  isSceneCrop,
  displayCrop,
  safeEditCrop,
  beginDrag,
  onLoadedMetadata,
}: CropEditOverlayProps) {
  const { t } = useTranslation();
  const borderClassName = isSceneCrop ? 'border-amber-300/90' : 'border-cyan-300/90';
  const fillClassName = isSceneCrop ? 'bg-amber-200/10' : 'bg-cyan-200/10';
  const shadowClassName = 'shadow-[0_0_0_9999px_rgba(2,6,23,0.58)]';
  const lineClassName = isSceneCrop ? 'bg-amber-100/60' : 'bg-cyan-100/60';
  const handleBorderClassName = isSceneCrop ? 'border-amber-200' : 'border-cyan-200';
  const labelClassName = isSceneCrop ? 'text-amber-100' : 'text-cyan-100';
  const labelBgClassName = 'bg-slate-950/75';

  return (
    <>
      <video
        ref={videoRef}
        src={videoObjectUrl}
        muted
        controls={false}
        preload="auto"
        className="h-full w-full object-contain"
        onLoadedMetadata={onLoadedMetadata}
      />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,transparent_45%,rgba(2,6,23,0.5)_100%)]" />

      <div
        className={`absolute border-2 ${borderClassName} ${fillClassName} ${shadowClassName}`}
        style={{
          left: `${displayCrop.left}px`,
          top: `${displayCrop.top}px`,
          width: `${displayCrop.width}px`,
          height: `${displayCrop.height}px`,
        }}
      >
        <button
          type="button"
          onPointerDown={(event) => beginDrag(event, 'move')}
          className="absolute inset-0 cursor-move"
          aria-label={t('canvas.moveCrop')}
        />

        <div className={`pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 ${lineClassName}`} />
        <div className={`pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 ${lineClassName}`} />

        <button
          type="button"
          aria-label={t('canvas.resizeNorthWest')}
          onPointerDown={(event) => beginDrag(event, 'nw')}
          className={`absolute -left-2 -top-2 h-4 w-4 cursor-nwse-resize rounded-full border ${handleBorderClassName} bg-slate-950`}
        />
        <button
          type="button"
          aria-label={t('canvas.resizeNorthEast')}
          onPointerDown={(event) => beginDrag(event, 'ne')}
          className={`absolute -right-2 -top-2 h-4 w-4 cursor-nesw-resize rounded-full border ${handleBorderClassName} bg-slate-950`}
        />
        <button
          type="button"
          aria-label={t('canvas.resizeSouthWest')}
          onPointerDown={(event) => beginDrag(event, 'sw')}
          className={`absolute -bottom-2 -left-2 h-4 w-4 cursor-nesw-resize rounded-full border ${handleBorderClassName} bg-slate-950`}
        />
        <button
          type="button"
          aria-label={t('canvas.resizeSouthEast')}
          onPointerDown={(event) => beginDrag(event, 'se')}
          className={`absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-full border ${handleBorderClassName} bg-slate-950`}
        />

        <button
          type="button"
          aria-label={t('canvas.resizeNorth')}
          onPointerDown={(event) => beginDrag(event, 'n')}
          className={`absolute left-1/2 top-0 h-4 w-8 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize rounded-full border ${handleBorderClassName} bg-slate-950`}
        />
        <button
          type="button"
          aria-label={t('canvas.resizeSouth')}
          onPointerDown={(event) => beginDrag(event, 's')}
          className={`absolute bottom-0 left-1/2 h-4 w-8 -translate-x-1/2 translate-y-1/2 cursor-ns-resize rounded-full border ${handleBorderClassName} bg-slate-950`}
        />
        <button
          type="button"
          aria-label={t('canvas.resizeWest')}
          onPointerDown={(event) => beginDrag(event, 'w')}
          className={`absolute left-0 top-1/2 h-8 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border ${handleBorderClassName} bg-slate-950`}
        />
        <button
          type="button"
          aria-label={t('canvas.resizeEast')}
          onPointerDown={(event) => beginDrag(event, 'e')}
          className={`absolute right-0 top-1/2 h-8 w-4 translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border ${handleBorderClassName} bg-slate-950`}
        />

        <div className={`pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded px-2 py-1 font-mono text-[10px] ${labelBgClassName} ${labelClassName}`}>
          <Focus size={11} />
          {safeEditCrop.w}x{safeEditCrop.h} @ {safeEditCrop.x},{safeEditCrop.y}
        </div>
      </div>
    </>
  );
}
