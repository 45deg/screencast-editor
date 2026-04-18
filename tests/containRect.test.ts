import { describe, expect, it } from 'vitest';

import { fitRectContain } from '../src/lib/containRect';

describe('fitRectContain', () => {
  it('centers a landscape source inside a square container', () => {
    const rect = fitRectContain(400, 200, 100, 100);

    expect(rect.width).toBe(100);
    expect(rect.height).toBe(50);
    expect(rect.offsetX).toBe(0);
    expect(rect.offsetY).toBe(25);
  });

  it('centers a portrait source inside a wide container', () => {
    const rect = fitRectContain(200, 400, 300, 100);

    expect(rect.width).toBe(50);
    expect(rect.height).toBe(100);
    expect(rect.offsetX).toBe(125);
    expect(rect.offsetY).toBe(0);
  });
});
