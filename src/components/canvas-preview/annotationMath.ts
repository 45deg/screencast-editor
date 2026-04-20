import type { CSSProperties } from 'react';

import type { AnnotationTextStyle } from '../../types/editor';

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
    whiteSpace: 'pre',
    backgroundColor: style.boxEnabled ? style.boxColor : 'transparent',
    padding: style.boxEnabled ? `${paddingY}px ${paddingX}px` : '0',
    WebkitTextStroke: outlineWidth > 0 ? `${outlineWidth}px ${style.outlineColor}` : undefined,
  };
}
