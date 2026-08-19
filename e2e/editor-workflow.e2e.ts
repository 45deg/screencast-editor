import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const fixturePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../tests/fixtures/export-sample.mp4');

test.describe('main editor workflow', () => {
  test('loads the export code on demand and supports the main desktop and mobile flow', async ({ page }) => {
    const exportModuleRequests: string[] = [];
    const drawerErrors: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/src/lib/browserExport.ts')) {
        exportModuleRequests.push(request.url());
      }
    });
    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().includes('Drawer.Popup')) {
        drawerErrors.push(message.text());
      }
    });

    await page.goto('/');
    await expect(page.getByRole('main')).toBeVisible();
    expect(exportModuleRequests).toHaveLength(0);

    await page.locator('input[type="file"][accept="video/*"]').setInputFiles(fixturePath);
    await expect(page.getByText('export-sample.mp4')).toBeVisible();
    await expect.poll(() => exportModuleRequests.length).toBeGreaterThan(0);

    await page.getByRole('button', { name: /Add text|テキスト追加/ }).click();
    await expect(page.getByRole('button', { name: /New text|新しいテキスト/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'sliceEditor.deleteSelected' })).toHaveCount(0);
    await expect(page.getByLabel(/Output width|出力幅/)).toBeVisible();
    await expect(page.getByLabel(/Output height|出力高さ/)).toBeVisible();
    await expect(page.getByLabel(/Timeline zoom|タイムライン拡大率/)).toBeVisible();

    const scene = page.locator('[data-timeline-slice-block="true"]');
    await scene.focus();
    await scene.press('ArrowRight');
    await expect(page.getByRole('button', { name: /Undo|元に戻す/ })).toBeEnabled();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /^(Export|出力)$/ }).click();
    await expect(page.getByRole('dialog', { name: /Output settings|出力設定/ })).toBeVisible();
    expect(drawerErrors).toEqual([]);
  });

  test('clears the landing file input so the same failed file can be selected again', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('input[type="file"][accept="video/*"]');
    const invalidVideo = {
      name: 'invalid.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('not a video'),
    };

    await input.setInputFiles(invalidVideo);
    await expect(input).toHaveValue('');
    await expect(page.getByText(/Failed to read the video metadata|動画メタデータの読み込みに失敗/)).toBeVisible();

    await input.setInputFiles(invalidVideo);
    await expect(input).toHaveValue('');
    await expect(page.getByText(/Failed to read the video metadata|動画メタデータの読み込みに失敗/)).toBeVisible();
  });
});
