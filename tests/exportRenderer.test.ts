import { describe, expect, it, vi } from 'vitest';

import { renderFrameToCanvas } from '../src/lib/exportRenderer';
import type { CropRect } from '../src/types/editor';

function render(width: number, height: number, crop: CropRect) {
  const context = {
    save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(),
  };
  // Include padded coded dimensions: canvas uses display dimensions instead.
  const frame = { displayWidth: width, displayHeight: height, codedWidth: width + 16, codedHeight: height + 16 };
  renderFrameToCanvas({
    context: context as unknown as CanvasRenderingContext2D,
    frame: frame as VideoFrame,
    sourceSize: { width: 1066, height: 678 },
    baseCrop: { x: 0, y: 0, w: 1066, h: 678 },
    sceneCrop: crop,
    outputWidth: 1066,
    outputHeight: 678,
    annotations: [],
    timeSec: 0,
    assets: { imageBitmaps: new Map() },
  });
  return context.drawImage.mock.calls[0].slice(1);
}

describe('export rendering of variable-resolution recordings', () => {
  it('keeps the whole tab visible before and after resolution changes', () => {
    const crop = { x: 0, y: 0, w: 1066, h: 678 };
    for (const scale of [1, 2, 0.5, 1]) {
      expect(render(1066 * scale, 678 * scale, crop)).toEqual([
        0, 0, 1066 * scale, 678 * scale, 0, 0, 1066, 678,
      ]);
    }
  });

  it('preserves the selected crop and output placement when resolution doubles', () => {
    const crop = { x: 100, y: 50, w: 400, h: 300 };
    const initial = render(1066, 678, crop);
    const retina = render(2132, 1356, crop);
    expect(initial.slice(0, 4)).toEqual([100, 50, 400, 300]);
    expect(retina.slice(0, 4)).toEqual([200, 100, 800, 600]);
    expect(retina.slice(4)).toEqual(initial.slice(4));
  });
});
