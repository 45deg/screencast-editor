import { describe, expect, it } from 'vitest';

import { getOutputFrameDurationUs, getTargetBitrate, getTotalFrameCount } from '../src/lib/exportVideoUtils';

describe('exportVideoUtils', () => {
  it('derives a stable frame duration from fps', () => {
    expect(getOutputFrameDurationUs(30)).toBe(33_333);
    expect(getOutputFrameDurationUs(24)).toBe(41_667);
  });

  it('computes total frame count from duration and fps', () => {
    expect(getTotalFrameCount(3, 30)).toBe(90);
    expect(getTotalFrameCount(0.2, 10)).toBe(2);
  });

  it('raises bitrate for slower presets', () => {
    const lightweight = getTargetBitrate(1280, 720, 30, 'veryfast');
    const balanced = getTargetBitrate(1280, 720, 30, 'medium');
    const quality = getTargetBitrate(1280, 720, 30, 'slow');

    expect(lightweight).toBeLessThan(balanced);
    expect(balanced).toBeLessThan(quality);
  });
});
