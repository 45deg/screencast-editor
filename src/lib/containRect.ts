export interface ContainRect {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export function fitRectContain(
  sourceWidth: number,
  sourceHeight: number,
  containerWidth: number,
  containerHeight: number,
): ContainRect {
  const safeSourceWidth = Math.max(1, sourceWidth);
  const safeSourceHeight = Math.max(1, sourceHeight);
  const safeContainerWidth = Math.max(1, containerWidth);
  const safeContainerHeight = Math.max(1, containerHeight);
  const scale = Math.min(safeContainerWidth / safeSourceWidth, safeContainerHeight / safeSourceHeight);
  const width = safeSourceWidth * scale;
  const height = safeSourceHeight * scale;

  return {
    width,
    height,
    offsetX: (safeContainerWidth - width) / 2,
    offsetY: (safeContainerHeight - height) / 2,
  };
}
