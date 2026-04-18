import type { CSSProperties } from 'react';

import type { AnnotationModel, AnnotationTextStyle, CropRect } from '../../types/editor';

export type ImageResizeMode = 'nw' | 'ne' | 'sw' | 'se';

const MIN_IMAGE_ANNOTATION_SIZE = 24;

export function clampAnnotationPosition(
  annotation: AnnotationModel,
  nextX: number,
  nextY: number,
  frameCrop: CropRect,
) {
  if (annotation.kind === 'image') {
    return {
      x: Math.max(0, Math.min(frameCrop.w - annotation.width, Math.round(nextX))),
      y: Math.max(0, Math.min(frameCrop.h - annotation.height, Math.round(nextY))),
    };
  }

  return {
    x: Math.max(0, Math.min(frameCrop.w - 8, Math.round(nextX))),
    y: Math.max(0, Math.min(frameCrop.h - 8, Math.round(nextY))),
  };
}

function clampImageAnnotationSize(
  annotation: Extract<AnnotationModel, { kind: 'image' }>,
  nextWidth: number,
  nextHeight: number,
  frameCrop: CropRect,
) {
  const aspectRatio = Math.max(1 / 4096, annotation.naturalWidth / Math.max(1, annotation.naturalHeight));
  const maxWidth = Math.max(MIN_IMAGE_ANNOTATION_SIZE, frameCrop.w - annotation.x);
  const maxHeight = Math.max(MIN_IMAGE_ANNOTATION_SIZE, frameCrop.h - annotation.y);
  const widthChange = Math.abs(nextWidth - annotation.width) / Math.max(1, annotation.width);
  const heightChange = Math.abs(nextHeight - annotation.height) / Math.max(1, annotation.height);

  let width =
    widthChange >= heightChange
      ? Math.max(MIN_IMAGE_ANNOTATION_SIZE, Math.round(nextWidth))
      : Math.max(MIN_IMAGE_ANNOTATION_SIZE, Math.round(nextHeight * aspectRatio));
  let height = Math.max(MIN_IMAGE_ANNOTATION_SIZE, Math.round(width / aspectRatio));

  if (height > maxHeight) {
    height = maxHeight;
    width = Math.max(MIN_IMAGE_ANNOTATION_SIZE, Math.round(height * aspectRatio));
  }

  if (width > maxWidth) {
    width = maxWidth;
    height = Math.max(MIN_IMAGE_ANNOTATION_SIZE, Math.round(width / aspectRatio));
  }

  if (height > maxHeight) {
    height = maxHeight;
    width = Math.max(MIN_IMAGE_ANNOTATION_SIZE, Math.round(height * aspectRatio));
  }

  return {
    width,
    height,
  };
}

export function resizeImageAnnotationFromCorner(
  annotation: Extract<AnnotationModel, { kind: 'image' }>,
  mode: ImageResizeMode,
  dx: number,
  dy: number,
  frameCrop: CropRect,
) {
  const right = annotation.x + annotation.width;
  const bottom = annotation.y + annotation.height;

  let rawWidth = annotation.width;
  let rawHeight = annotation.height;
  let maxWidth = frameCrop.w;
  let maxHeight = frameCrop.h;

  if (mode === 'se') {
    rawWidth = annotation.width + dx;
    rawHeight = annotation.height + dy;
    maxWidth = frameCrop.w - annotation.x;
    maxHeight = frameCrop.h - annotation.y;
  } else if (mode === 'sw') {
    rawWidth = annotation.width - dx;
    rawHeight = annotation.height + dy;
    maxWidth = right;
    maxHeight = frameCrop.h - annotation.y;
  } else if (mode === 'ne') {
    rawWidth = annotation.width + dx;
    rawHeight = annotation.height - dy;
    maxWidth = frameCrop.w - annotation.x;
    maxHeight = bottom;
  } else {
    rawWidth = annotation.width - dx;
    rawHeight = annotation.height - dy;
    maxWidth = right;
    maxHeight = bottom;
  }

  const sized = clampImageAnnotationSize(
    {
      ...annotation,
      x: 0,
      y: 0,
    },
    Math.min(maxWidth, rawWidth),
    Math.min(maxHeight, rawHeight),
    {
      x: 0,
      y: 0,
      w: maxWidth,
      h: maxHeight,
    },
  );

  if (mode === 'se') {
    return {
      x: annotation.x,
      y: annotation.y,
      width: sized.width,
      height: sized.height,
    };
  }

  if (mode === 'sw') {
    return {
      x: right - sized.width,
      y: annotation.y,
      width: sized.width,
      height: sized.height,
    };
  }

  if (mode === 'ne') {
    return {
      x: annotation.x,
      y: bottom - sized.height,
      width: sized.width,
      height: sized.height,
    };
  }

  return {
    x: right - sized.width,
    y: bottom - sized.height,
    width: sized.width,
    height: sized.height,
  };
}

export function toTextStyle(style: AnnotationTextStyle, scaleY: number): CSSProperties {
  const fontSize = Math.max(8, Math.round(style.fontSize * scaleY));
  const outlineWidth = Math.max(0, Math.round(style.outlineWidth * scaleY));
  const lineHeight = Math.max(Math.round(fontSize * 1.25), fontSize + 2);
  const paddingX = Math.max(4, Math.round(fontSize * 0.24));
  const paddingY = Math.max(2, Math.round(fontSize * 0.14));

  return {
    color: style.textColor,
    fontWeight: style.bold ? 700 : 500,
    fontStyle: style.italic ? 'italic' : 'normal',
    fontSize: `${fontSize}px`,
    lineHeight: `${lineHeight}px`,
    whiteSpace: 'pre-wrap',
    backgroundColor: style.boxEnabled ? style.boxColor : 'transparent',
    padding: style.boxEnabled ? `${paddingY}px ${paddingX}px` : '0',
    WebkitTextStroke: outlineWidth > 0 ? `${outlineWidth}px ${style.outlineColor}` : undefined,
  };
}
