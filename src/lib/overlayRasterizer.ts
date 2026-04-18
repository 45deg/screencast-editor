import type { AnnotationModel, AnnotationTextStyle, CropRect } from '../types/editor';

export interface RasterizedOverlay {
  annotationId: string;
  fileName: string;
  start: number;
  end: number;
  blob: Blob;
}

function toCanvasBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to rasterize overlay.'));
        return;
      }

      resolve(blob);
    }, type);
  });
}

function getTextLines(text: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.trimEnd());
  return lines.length ? lines : [''];
}

function drawTextOverlay(
  context: CanvasRenderingContext2D,
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
    // Canvas text stroke is centered on the glyph path and the following fill
    // pass hides the inner half, so we compensate to better match preview/export.
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

async function drawImageOverlay(
  context: CanvasRenderingContext2D,
  annotation: Extract<AnnotationModel, { kind: 'image' }>,
  scaleX: number,
  scaleY: number,
): Promise<void> {
  const bitmap = await createImageBitmap(annotation.file);

  try {
    const targetWidth = Math.max(1, annotation.width * scaleX);
    const targetHeight = Math.max(1, annotation.height * scaleY);

    context.drawImage(
      bitmap,
      annotation.x * scaleX,
      annotation.y * scaleY,
      targetWidth,
      targetHeight,
    );
  } finally {
    bitmap.close();
  }
}

export async function rasterizeAnnotationsToOverlays(
  annotations: AnnotationModel[],
  baseCrop: CropRect,
  outputWidth: number,
  outputHeight: number,
): Promise<RasterizedOverlay[]> {
  const safeWidth = Math.max(1, Math.round(outputWidth));
  const safeHeight = Math.max(1, Math.round(outputHeight));
  const scaleX = safeWidth / Math.max(1, baseCrop.w);
  const scaleY = safeHeight / Math.max(1, baseCrop.h);
  const overlays: RasterizedOverlay[] = [];

  for (const annotation of annotations) {
    if (annotation.duration <= 0.0001) {
      continue;
    }

    const canvas = document.createElement('canvas');
    canvas.width = safeWidth;
    canvas.height = safeHeight;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Failed to initialize overlay canvas context.');
    }

    if (annotation.kind === 'text') {
      drawTextOverlay(context, annotation, annotation.style, scaleX, scaleY);
    } else {
      await drawImageOverlay(context, annotation, scaleX, scaleY);
    }

    const blob = await toCanvasBlob(canvas, 'image/png');
    overlays.push({
      annotationId: annotation.id,
      fileName: `overlay-${annotation.id}.png`,
      start: annotation.start,
      end: annotation.start + annotation.duration,
      blob,
    });
  }

  return overlays;
}
