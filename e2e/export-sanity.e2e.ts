import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const fixturePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../tests/fixtures/export-sample.mp4');

async function loadFixture(page: Page) {
  await page.goto('/sanity-check.html');
  await page.getByTestId('video-input').setInputFiles(fixturePath);
}

test.describe('export sanity page', () => {
  test('keeps all four corners when captured frame resolution changes', async ({ page }) => {
    await page.goto('/sanity-check.html');
    const samples = await page.evaluate(async () => {
      const modulePath = '/src/lib/exportRenderer.ts';
      const { renderFrameToCanvas } = await import(/* @vite-ignore */ modulePath);
      const output = document.createElement('canvas');
      output.width = 100;
      output.height = 60;
      const context = output.getContext('2d')!;
      const results: number[][][] = [];
      for (const scale of [1, 2, 0.5]) {
        const input = document.createElement('canvas');
        input.width = 100 * scale;
        input.height = 60 * scale;
        const inputContext = input.getContext('2d')!;
        for (const [index, color] of ['#ff0000', '#00ff00', '#0000ff', '#ffffff'].entries()) {
          inputContext.fillStyle = color;
          inputContext.fillRect((index % 2) * 50 * scale, Math.floor(index / 2) * 30 * scale, 50 * scale, 30 * scale);
        }
        const frame = new VideoFrame(input, { timestamp: 0 });
        try {
          renderFrameToCanvas({
            context, frame,
            sourceSize: { width: 100, height: 60 },
            baseCrop: { x: 0, y: 0, w: 100, h: 60 },
            sceneCrop: { x: 0, y: 0, w: 100, h: 60 },
            outputWidth: 100, outputHeight: 60,
            annotations: [], timeSec: 0,
            assets: { imageBitmaps: new Map() },
          });
          results.push([[10, 10], [90, 10], [10, 50], [90, 50]].map(([x, y]) =>
            Array.from(context.getImageData(x, y, 1, 1).data),
          ));
        } finally {
          frame.close();
        }
      }
      return results;
    });
    for (const corners of samples) {
      expect(corners).toEqual([
        [255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 255, 255],
      ]);
    }
  });

  test('is served in dev/test mode', async ({ page }) => {
    await page.goto('/sanity-check.html');
    await expect(page.getByRole('heading', { name: 'Export Sanity Check' })).toBeVisible();
  });

  test('exports an mp4 successfully', async ({ page }) => {
    await loadFixture(page);

    await page.getByTestId('start-export').click();

    await expect(page.getByTestId('runtime-status')).toHaveText('ready');
    await expect(page.getByTestId('export-result')).toContainText('Exported MP4');
    await expect(page.getByTestId('export-error')).toHaveText('');
    await expect
      .poll(async () => Number(await page.getByTestId('export-progress').textContent()))
      .toBeGreaterThan(0);
  });

  test('cancel during runtime preparation does not leave runtime ready and can retry', async ({ page }) => {
    await loadFixture(page);
    await page.getByTestId('runtime-delay-ms').fill('1500');

    await page.getByTestId('start-export').click();
    await expect(page.getByTestId('runtime-status')).toHaveText('loading');

    await page.getByTestId('cancel-export').click();
    await expect(page.getByTestId('runtime-status')).toHaveText('idle');

    await page.getByTestId('runtime-delay-ms').fill('0');
    await page.getByTestId('start-export').click();

    await expect(page.getByTestId('runtime-status')).toHaveText('ready');
    await expect(page.getByTestId('export-result')).toContainText('Exported MP4');
  });

  test('destroys the input after repeated export attempts including cancellation', async ({ page }) => {
    await loadFixture(page);

    await page.getByTestId('input-delay-ms').fill('1200');
    await page.getByTestId('start-export').click();
    await expect(page.getByTestId('runtime-status')).toHaveText('loading');
    await page.getByTestId('cancel-export').click();

    await expect
      .poll(async () => ({
        created: Number(await page.getByTestId('input-created-count').textContent()),
        destroyed: Number(await page.getByTestId('input-destroyed-count').textContent()),
      }))
      .toEqual({ created: 1, destroyed: 1 });

    await page.getByTestId('input-delay-ms').fill('0');
    await page.getByTestId('start-export').click();
    await expect(page.getByTestId('export-result')).toContainText('Exported MP4');

    await expect
      .poll(async () => ({
        created: Number(await page.getByTestId('input-created-count').textContent()),
        destroyed: Number(await page.getByTestId('input-destroyed-count').textContent()),
      }))
      .toEqual({ created: 2, destroyed: 2 });
  });
});
