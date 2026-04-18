import { describe, expect, it } from 'vitest';

import {
  buildUnifiedAnnotationLayout,
  canMoveAnnotationLayer,
  moveAnnotationLayer,
  resizeAnnotationDuration,
} from '../src/lib/annotationTimeline';
import {
  deriveAnnotations,
  findSliceAtTimelineTime,
  type AnnotationModel,
  type SliceModel,
} from '../src/types/editor';

function createAnnotations(): AnnotationModel[] {
  return [
    {
      id: 'text-a',
      kind: 'text',
      start: 0,
      duration: 2,
      x: 10,
      y: 10,
      text: 'A',
      style: {
        boxEnabled: true,
        boxColor: '#111111',
        textColor: '#ffffff',
        bold: false,
        italic: false,
        fontSize: 24,
        outlineWidth: 0,
        outlineColor: '#000000',
      },
    },
    {
      id: 'image-b',
      kind: 'image',
      start: 0.5,
      duration: 1.2,
      x: 20,
      y: 20,
      width: 120,
      height: 80,
      file: { name: 'b.png' } as File,
      imageUrl: 'blob:b',
    },
    {
      id: 'text-c',
      kind: 'text',
      start: 3,
      duration: 1,
      x: 30,
      y: 30,
      text: 'C',
      style: {
        boxEnabled: false,
        boxColor: '#111111',
        textColor: '#ffffff',
        bold: false,
        italic: false,
        fontSize: 24,
        outlineWidth: 0,
        outlineColor: '#000000',
      },
    },
  ];
}

describe('annotation timeline helpers', () => {
  it('places overlapping higher-priority annotations on lower rows', () => {
    const derived = deriveAnnotations(createAnnotations());
    const layout = buildUnifiedAnnotationLayout(derived);

    const byId = new Map(layout.placements.map((placement) => [placement.annotation.id, placement]));

    expect(byId.get('text-a')?.row).toBe(0);
    expect(byId.get('image-b')?.row).toBe(1);
    expect(byId.get('text-c')?.row).toBe(0);

    expect((byId.get('image-b')?.zIndex ?? 0)).toBeGreaterThan(byId.get('text-a')?.zIndex ?? 0);
  });

  it('moves annotation layer up and down', () => {
    const annotations = createAnnotations();

    expect(canMoveAnnotationLayer(annotations, 'image-b', 'up')).toBe(true);
    expect(canMoveAnnotationLayer(annotations, 'image-b', 'down')).toBe(false);
    expect(canMoveAnnotationLayer(annotations, 'text-c', 'up')).toBe(false);

    const up = moveAnnotationLayer(annotations, 'image-b', 'up');
    expect(up.map((annotation) => annotation.id)).toEqual(['image-b', 'text-a', 'text-c']);

    const down = moveAnnotationLayer(annotations, 'image-b', 'down');
    expect(down).toBe(annotations);

    const unchanged = moveAnnotationLayer(annotations, 'text-a', 'up');
    expect(unchanged).toBe(annotations);
  });

  it('resizes annotation duration with minimum clamp', () => {
    const annotations = createAnnotations();
    const resized = resizeAnnotationDuration(annotations, 'text-a', 0.01);

    const target = resized.find((annotation) => annotation.id === 'text-a');
    expect(target?.duration).toBe(0.1);
  });
});

describe('timeline gaps', () => {
  it('returns null when timeline time is inside a gap or after end', () => {
    const slices: SliceModel[] = [
      {
        id: 's0',
        timelineStart: 0,
        sourceStart: 0,
        sourceEnd: 2,
        duration: 2,
        crop: null,
      },
      {
        id: 's1',
        timelineStart: 4,
        sourceStart: 2,
        sourceEnd: 4,
        duration: 2,
        crop: null,
      },
    ];

    expect(findSliceAtTimelineTime(slices, 1)?.id).toBe('s0');
    expect(findSliceAtTimelineTime(slices, 3)).toBeNull();
    expect(findSliceAtTimelineTime(slices, 6)).toBeNull();
  });
});
