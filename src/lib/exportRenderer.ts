import type { AnnotationModel, AnnotationTextStyle, CropRect } from '../types/editor';

interface PreparedAnnotationAssets {
  imageBitmaps: Map<string, ImageBitmap>;
}

interface RenderFrameArgs {
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  frame: VideoFrame | null;
  baseCrop: CropRect;
  sceneCrop: CropRect;
  outputWidth: number;
  outputHeight: number;
  annotations: AnnotationModel[];
  timeSec: number;
  assets: PreparedAnnotationAssets;
}

function getTextLines(text: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.trimEnd());
  return lines.length ? lines : [''];
}

function drawTextOverlay(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  annotation: Extract<AnnotationModel, { kind: 'text' }>,
  style: AnnotationTextStyle,
  scaleX: number,
  scaleY: number,
) {
  const fontSize = Math.max(8, Math.round(style.fontSize * scaleY));
  const fontWeight = style.bold ? '700' : '500';
  const fontStyle = style.italic ? 'italic' : 'normal';
  const fontFamily = '"IBM Plex Sans JP", "Hiragino Kaku Gothic ProN", sans-serif';
  const lineHeight = Math.max(Math.round(fontSize * 1.25), fontSize + 2);
  const paddingX = Math.max(4, Math.round(fontSize * 0.24));
  const paddingY = Math.max(2, Math.round(fontSize * 0.14));
  const lines = getTextLines(annotation.text || '');

  context.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  context.textBaseline = 'top';

  const lineWidths = lines.map((line) => context.measureText(line || ' ').width);
  const maxLineWidth = lineWidths.length ? Math.max(...lineWidths) : 0;
  const x = annotation.x * scaleX;
  const y = annotation.y * scaleY;

  if (style.boxEnabled) {
    context.fillStyle = style.boxColor;
    context.fillRect(
      Math.max(0, x - paddingX),
      Math.max(0, y - paddingY),
      maxLineWidth + paddingX * 2,
      lineHeight * lines.length + paddingY * 2,
    );
  }

  const outlineWidth = Math.max(0, Math.round(style.outlineWidth * scaleY));
  if (outlineWidth > 0) {
    context.lineWidth = outlineWidth * 2;
    context.lineJoin = 'round';
    context.miterLimit = 2;
    context.strokeStyle = style.outlineColor;
    for (let index = 0; index < lines.length; index += 1) {
      context.strokeText(lines[index] || ' ', x, y + lineHeight * index);
    }
  }

  context.fillStyle = style.textColor;
  for (let index = 0; index < lines.length; index += 1) {
    context.fillText(lines[index] || ' ', x, y + lineHeight * index);
  }
}

function drawImageOverlay(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  annotation: Extract<AnnotationModel, { kind: 'image' }>,
  bitmap: ImageBitmap,
  scaleX: number,
  scaleY: number,
) {
  context.drawImage(
    bitmap,
    annotation.x * scaleX,
    annotation.y * scaleY,
    Math.max(1, annotation.width * scaleX),
    Math.max(1, annotation.height * scaleY),
  );
}

export async function prepareAnnotationAssets(annotations: AnnotationModel[]): Promise<PreparedAnnotationAssets> {
  const imageBitmaps = new Map<string, ImageBitmap>();

  for (const annotation of annotations) {
    if (annotation.kind !== 'image') {
      continue;
    }

    imageBitmaps.set(annotation.id, await createImageBitmap(annotation.file));
  }

  return { imageBitmaps };
}

export function releaseAnnotationAssets(assets: PreparedAnnotationAssets) {
  for (const bitmap of assets.imageBitmaps.values()) {
    bitmap.close();
  }
}

export function renderFrameToCanvas({
  context,
  frame,
  baseCrop,
  sceneCrop,
  outputWidth,
  outputHeight,
  annotations,
  timeSec,
  assets,
}: RenderFrameArgs) {
  context.save();
  context.fillStyle = '#000000';
  context.fillRect(0, 0, outputWidth, outputHeight);

  if (frame) {
    const outputScaleX = outputWidth / Math.max(1, baseCrop.w);
    const outputScaleY = outputHeight / Math.max(1, baseCrop.h);
    const containScale = Math.min(baseCrop.w / sceneCrop.w, baseCrop.h / sceneCrop.h);
    const targetWidth = sceneCrop.w * containScale * outputScaleX;
    const targetHeight = sceneCrop.h * containScale * outputScaleY;
    const targetX = ((baseCrop.w - sceneCrop.w * containScale) / 2) * outputScaleX;
    const targetY = ((baseCrop.h - sceneCrop.h * containScale) / 2) * outputScaleY;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      frame,
      sceneCrop.x,
      sceneCrop.y,
      sceneCrop.w,
      sceneCrop.h,
      targetX,
      targetY,
      targetWidth,
      targetHeight,
    );
  }

  const activeAnnotations = annotations.filter(
    (annotation) => timeSec >= annotation.start && timeSec < annotation.start + annotation.duration,
  );
  const scaleX = outputWidth / Math.max(1, baseCrop.w);
  const scaleY = outputHeight / Math.max(1, baseCrop.h);

  for (const annotation of activeAnnotations) {
    if (annotation.kind === 'text') {
      drawTextOverlay(context, annotation, annotation.style, scaleX, scaleY);
      continue;
    }

    const bitmap = assets.imageBitmaps.get(annotation.id);
    if (bitmap) {
      drawImageOverlay(context, annotation, bitmap, scaleX, scaleY);
    }
  }

  context.restore();
}
