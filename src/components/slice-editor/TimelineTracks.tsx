import { useMemo, useRef } from 'react';
import { motion, type PanInfo } from 'framer-motion';
import { Crop, Image as ImageIcon, Type } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type {
  DerivedAnnotation,
  DerivedSlice,
  ImageAnnotation,
  TextAnnotation,
  TimelineScrollInfo,
} from '../../types/editor';

interface TimelineTracksProps {
  slicesWithPos: DerivedSlice[];
  annotationsWithPos: DerivedAnnotation[];
  selectedSliceId: string | null;
  selectedAnnotationId: string | null;
  setSelectedSliceId: (id: string | null) => void;
  setSelectedAnnotationId: (id: string | null) => void;
  pixelsPerSecond: number;
  scrollInfo: TimelineScrollInfo;
  thumbnailUrls: Record<string, string>;
  outputAspectRatio: number;
  onResizeSlice: (sliceId: string, newDuration: number) => void;
  onResizeSliceEnd: () => void;
  onMoveSlice: (sliceId: string, nextStart: number) => void;
  onMoveSliceEnd: () => void;
  onMoveAnnotation: (annotationId: string, nextStart: number) => void;
  onMoveAnnotationEnd: () => void;
}

const VIDEO_TRACK_TOP = 28;
const VIDEO_TRACK_HEIGHT = 116;
const TEXT_TRACK_TOP = VIDEO_TRACK_TOP + VIDEO_TRACK_HEIGHT + 10;
const TEXT_TRACK_HEIGHT = 44;
const IMAGE_TRACK_TOP = TEXT_TRACK_TOP + TEXT_TRACK_HEIGHT + 8;
const IMAGE_TRACK_HEIGHT = 44;

function isTextAnnotation(annotation: DerivedAnnotation): annotation is DerivedAnnotation<TextAnnotation> {
  return annotation.kind === 'text';
}

function isImageAnnotation(annotation: DerivedAnnotation): annotation is DerivedAnnotation<ImageAnnotation> {
  return annotation.kind === 'image';
}

function LayerLabel({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="pointer-events-none absolute left-2 top-1 z-40 rounded border border-slate-700/90 bg-slate-950/90 px-2 py-0.5 text-[10px] leading-tight text-slate-400">
      <div className="font-semibold tracking-wide text-slate-300">{title}</div>
      {subtitle ? <div>{subtitle}</div> : null}
    </div>
  );
}

function TextLayerBlock({
  annotation,
  pixelsPerSecond,
  selected,
  onSelect,
  onMove,
  onMoveEnd,
}: {
  annotation: DerivedAnnotation<TextAnnotation>;
  pixelsPerSecond: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (nextStart: number) => void;
  onMoveEnd: () => void;
}) {
  const initialStartRef = useRef(annotation.start);

  return (
    <motion.button
      type="button"
      className={`absolute top-0 h-full rounded border px-2 text-left text-xs transition ${
        selected
          ? 'z-20 border-rose-200 bg-rose-500/95 text-white'
          : 'z-10 border-rose-300/60 bg-rose-700/85 text-rose-50 hover:bg-rose-600/90'
      }`}
      style={{
        left: `${annotation.start * pixelsPerSecond}px`,
        width: `${Math.max(40, annotation.duration * pixelsPerSecond)}px`,
        touchAction: 'none',
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPanStart={() => {
        initialStartRef.current = annotation.start;
      }}
      onPan={(_event: Event, info: PanInfo) => {
        const nextStart = Math.max(0, initialStartRef.current + info.offset.x / pixelsPerSecond);
        onMove(nextStart);
      }}
      onPanEnd={onMoveEnd}
      title={annotation.text}
    >
      <span className="block truncate font-semibold tracking-wide">{annotation.text || 'Text'}</span>
    </motion.button>
  );
}

function ImageLayerBlock({
  annotation,
  pixelsPerSecond,
  selected,
  onSelect,
  onMove,
  onMoveEnd,
}: {
  annotation: DerivedAnnotation<ImageAnnotation>;
  pixelsPerSecond: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (nextStart: number) => void;
  onMoveEnd: () => void;
}) {
  const initialStartRef = useRef(annotation.start);

  return (
    <motion.button
      type="button"
      className={`absolute top-0 h-full rounded border px-2 text-left text-xs transition ${
        selected
          ? 'z-20 border-amber-200 bg-amber-400/95 text-slate-950'
          : 'z-10 border-amber-300/60 bg-amber-600/85 text-amber-50 hover:bg-amber-500/90'
      }`}
      style={{
        left: `${annotation.start * pixelsPerSecond}px`,
        width: `${Math.max(40, annotation.duration * pixelsPerSecond)}px`,
        touchAction: 'none',
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPanStart={() => {
        initialStartRef.current = annotation.start;
      }}
      onPan={(_event: Event, info: PanInfo) => {
        const nextStart = Math.max(0, initialStartRef.current + info.offset.x / pixelsPerSecond);
        onMove(nextStart);
      }}
      onPanEnd={onMoveEnd}
      title={annotation.file.name}
    >
      <span className="inline-flex max-w-full items-center gap-1 truncate font-semibold tracking-wide">
        <ImageIcon size={12} className="shrink-0" />
        <span className="truncate">{annotation.file.name}</span>
      </span>
    </motion.button>
  );
}

export default function TimelineTracks({
  slicesWithPos,
  annotationsWithPos,
  selectedSliceId,
  selectedAnnotationId,
  setSelectedSliceId,
  setSelectedAnnotationId,
  pixelsPerSecond,
  scrollInfo,
  thumbnailUrls,
  outputAspectRatio,
  onResizeSlice,
  onResizeSliceEnd,
  onMoveSlice,
  onMoveSliceEnd,
  onMoveAnnotation,
  onMoveAnnotationEnd,
}: TimelineTracksProps) {
  const { t } = useTranslation();
  const initialDurationRef = useRef<number>(0);
  const initialStartRef = useRef<number>(0);

  const safeOutputAspectRatio = Number.isFinite(outputAspectRatio) && outputAspectRatio > 0 ? outputAspectRatio : 16 / 9;
  const textAnnotations = useMemo(() => annotationsWithPos.filter(isTextAnnotation), [annotationsWithPos]);
  const imageAnnotations = useMemo(() => annotationsWithPos.filter(isImageAnnotation), [annotationsWithPos]);

  return (
    <>
      <div
        className="absolute inset-x-0 border-y border-slate-800/70 bg-black/70"
        style={{
          top: `${VIDEO_TRACK_TOP}px`,
          height: `${VIDEO_TRACK_HEIGHT}px`,
        }}
      >
        <LayerLabel title={t('sliceEditor.videoTrack')} subtitle={t('sliceEditor.gapIsBlack')} />
        {slicesWithPos.map((slice, index) => {
          const isSelected = slice.id === selectedSliceId;
          const thumbnailUrl = thumbnailUrls[slice.id];
          const startPx = slice.start * pixelsPerSecond;
          const endPx = slice.end * pixelsPerSecond;

          const visibleLeft = Math.max(scrollInfo.left, startPx);
          const visibleRight = Math.min(scrollInfo.left + scrollInfo.width, endPx);
          const isVisible = visibleLeft < visibleRight;
          const visibleCenter = (visibleLeft + visibleRight) / 2;
          const labelOffset = visibleCenter - startPx;

          return (
            <div key={slice.id} className="absolute inset-y-0">
              <motion.div
                role="button"
                tabIndex={0}
                className={`absolute inset-y-0 cursor-grab overflow-hidden transition-colors active:cursor-grabbing ${
                  isSelected
                    ? 'z-20 border-[3px] border-amber-300 bg-cyan-600'
                    : 'z-10 border border-cyan-500 bg-cyan-800 hover:bg-cyan-700'
                }`}
                style={{
                  left: `${startPx}px`,
                  width: `${slice.duration * pixelsPerSecond}px`,
                  touchAction: 'none',
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setSelectedAnnotationId(null);
                  setSelectedSliceId(slice.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedAnnotationId(null);
                    setSelectedSliceId(slice.id);
                  }
                }}
                onPanStart={() => {
                  initialStartRef.current = slice.start;
                }}
                onPan={(_event: Event, info: PanInfo) => {
                  const nextStart = Math.max(0, initialStartRef.current + info.offset.x / pixelsPerSecond);
                  onMoveSlice(slice.id, nextStart);
                }}
                onPanEnd={onMoveSliceEnd}
              >
                {isVisible ? (
                  <div
                    className="pointer-events-none absolute inset-y-0 flex w-max -translate-x-1/2 flex-col items-center gap-1 px-1.5 py-2"
                    style={{ left: `${labelOffset}px` }}
                  >
                    <div
                      className="w-[118px] max-w-[calc(100%-4px)] overflow-hidden rounded-md border border-slate-700 bg-slate-950/85 shadow-lg"
                      style={{ aspectRatio: `${safeOutputAspectRatio} / 1` }}
                    >
                      {thumbnailUrl ? (
                        <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="h-full w-full animate-pulse bg-slate-800/70" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm font-bold tracking-wider text-white drop-shadow">
                      {slice.crop ? <Crop size={13} className="shrink-0 text-amber-200" /> : null}
                      {t('sliceEditor.sceneNumber', { index: index + 1 })}
                    </div>
                    <div className="font-mono text-[10px] leading-tight text-center text-cyan-100 drop-shadow">
                      <span className="text-white">{slice.duration.toFixed(1)}s</span>
                      <br />
                      <span className="text-amber-200">x{slice.speed.toFixed(2)}</span>
                    </div>
                  </div>
                ) : null}
              </motion.div>

              <motion.div
                className="group absolute inset-y-0 z-30 -ml-2 flex w-4 cursor-col-resize items-center justify-center"
                style={{ left: `${endPx}px`, touchAction: 'none' }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setSelectedAnnotationId(null);
                  setSelectedSliceId(slice.id);
                }}
                onPanStart={() => {
                  initialDurationRef.current = slice.duration;
                }}
                onPan={(_event: Event, info: PanInfo) => {
                  const deltaSeconds = info.offset.x / pixelsPerSecond;
                  onResizeSlice(slice.id, initialDurationRef.current + deltaSeconds);
                }}
                onPanEnd={onResizeSliceEnd}
              >
                <div className="h-full w-1.5 bg-black/10 transition-colors group-hover:bg-amber-300/80" />
              </motion.div>
            </div>
          );
        })}
      </div>

      <div
        className="absolute inset-x-0 border border-rose-950/60 bg-rose-950/35"
        style={{
          top: `${TEXT_TRACK_TOP}px`,
          height: `${TEXT_TRACK_HEIGHT}px`,
        }}
      >
        <LayerLabel title={t('sliceEditor.textTrack')} />
        {textAnnotations.map((annotation) => (
          <TextLayerBlock
            key={annotation.id}
            annotation={annotation}
            pixelsPerSecond={pixelsPerSecond}
            selected={annotation.id === selectedAnnotationId}
            onSelect={() => {
              setSelectedSliceId(null);
              setSelectedAnnotationId(annotation.id);
            }}
            onMove={(nextStart) => onMoveAnnotation(annotation.id, nextStart)}
            onMoveEnd={onMoveAnnotationEnd}
          />
        ))}
      </div>

      <div
        className="absolute inset-x-0 border border-amber-900/60 bg-amber-900/35"
        style={{
          top: `${IMAGE_TRACK_TOP}px`,
          height: `${IMAGE_TRACK_HEIGHT}px`,
        }}
      >
        <LayerLabel title={t('sliceEditor.imageTrack')} />
        {imageAnnotations.map((annotation) => (
          <ImageLayerBlock
            key={annotation.id}
            annotation={annotation}
            pixelsPerSecond={pixelsPerSecond}
            selected={annotation.id === selectedAnnotationId}
            onSelect={() => {
              setSelectedSliceId(null);
              setSelectedAnnotationId(annotation.id);
            }}
            onMove={(nextStart) => onMoveAnnotation(annotation.id, nextStart)}
            onMoveEnd={onMoveAnnotationEnd}
          />
        ))}
      </div>

      <div className="pointer-events-none absolute left-2 text-[10px] text-slate-500" style={{ top: `${IMAGE_TRACK_TOP + IMAGE_TRACK_HEIGHT + 7}px` }}>
        <span className="inline-flex items-center gap-1">
          <Type size={11} />
          {t('sliceEditor.layerHint')}
        </span>
      </div>
    </>
  );
}
