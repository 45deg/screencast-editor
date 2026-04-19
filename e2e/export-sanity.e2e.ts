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

  test('destroys the demuxer after repeated export attempts including cancellation', async ({ page }) => {
    await loadFixture(page);

    await page.getByTestId('demuxer-delay-ms').fill('1200');
    await page.getByTestId('start-export').click();
    await expect(page.getByTestId('runtime-status')).toHaveText('loading');
    await page.getByTestId('cancel-export').click();

    await expect
      .poll(async () => ({
        created: Number(await page.getByTestId('demuxer-created-count').textContent()),
        destroyed: Number(await page.getByTestId('demuxer-destroyed-count').textContent()),
      }))
      .toEqual({ created: 1, destroyed: 1 });

    await page.getByTestId('demuxer-delay-ms').fill('0');
    await page.getByTestId('start-export').click();
    await expect(page.getByTestId('export-result')).toContainText('Exported MP4');

    await expect
      .poll(async () => ({
        created: Number(await page.getByTestId('demuxer-created-count').textContent()),
        destroyed: Number(await page.getByTestId('demuxer-destroyed-count').textContent()),
      }))
      .toEqual({ created: 2, destroyed: 2 });
  });
});
