import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildFfmpegCommand } from '../src/lib/ffmpegCommand';
import type { CropRect, ExportSettings, SliceModel, VideoMeta } from '../src/types/editor';

interface FfmpegRunResult {
  code: number;
  stdout: string;
  stderr: string;
}

const ffmpegAvailable = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
const describeIfFfmpeg = ffmpegAvailable ? describe : describe.skip;

function runFfmpeg(args: string[]): Promise<FfmpegRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-nostdin', '-y', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      resolve({
        code: code ?? -1,
        stdout,
        stderr,
      });
    });
  });
}

function assertFfmpegSucceeded(result: FfmpegRunResult, context: string): void {
  if (result.code === 0) {
    return;
  }

  throw new Error(`${context} failed with exit code ${result.code}\n${result.stderr}`);
}

function createVideoMeta(fileName: string): VideoMeta {
  return {
    file: { name: fileName } as File,
    objectUrl: '',
    width: 640,
    height: 360,
    duration: 4,
  };
}

function createSlices(): SliceModel[] {
  return [
    {
      id: 'slice-a',
      sourceStart: 0,
      sourceEnd: 2,
      duration: 2,
      crop: null,
    },
    {
      id: 'slice-b',
      sourceStart: 2,
      sourceEnd: 4,
      duration: 1,
      crop: {
        x: 120,
        y: 40,
        w: 320,
        h: 240,
      },
    },
  ];
}

function createExportSettings(format: 'gif' | 'mp4', overrides: Partial<ExportSettings> = {}): ExportSettings {
  return {
    format,
    width: 640,
    height: 360,
    keepAspectRatio: true,
    gifFps: 10,
    paletteMode: 'global',
    dither: 'none',
    mp4Fps: 30,
    mp4Preset: 'medium',
    speedOverlay: true,
    ...overrides,
  };
}

function getSpeedOverlayFontFile(): string {
  return join(process.cwd(), 'public', 'fonts', 'SpaceGrotesk.ttf');
}

async function supportsFilter(filterName: string): Promise<boolean> {
  const result = await runFfmpeg(['-hide_banner', '-filters']);
  assertFfmpegSucceeded(result, 'ffmpeg -filters');

  const output = `${result.stdout}\n${result.stderr}`;
  return new RegExp(`\\b${filterName}\\b`).test(output);
}

describeIfFfmpeg('FFmpeg command integration', () => {
  let tempDir = '';
  let fixtureInput = '';
  let drawtextSupported = false;

  const baseCrop: CropRect = {
    x: 0,
    y: 0,
    w: 640,
    h: 360,
  };

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'screencast-editor-ffmpeg-'));
    fixtureInput = join(tempDir, 'fixture-input.mp4');

    const fixture = await runFfmpeg([
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=4:size=640x360:rate=30',
      '-pix_fmt',
      'yuv420p',
      fixtureInput,
    ]);
    assertFfmpegSucceeded(fixture, 'fixture generation');

    drawtextSupported = await supportsFilter('drawtext');
  });

  afterAll(async () => {
    if (!tempDir) {
      return;
    }

    await rm(tempDir, { recursive: true, force: true });
  });

  it('exports GIF with crop/pad and no speed overlay', async () => {
    const output = join(tempDir, 'case-gif-no-overlay.gif');
    const built = buildFfmpegCommand({
      video: createVideoMeta('fixture-input.mp4'),
      slices: createSlices(),
      globalCrop: baseCrop,
      exportSettings: createExportSettings('gif', { speedOverlay: false }),
      inputFileName: fixtureInput,
      outputFileName: output,
    });

    expect(built.filterComplex.includes('drawtext')).toBe(false);

    const result = await runFfmpeg(built.execArgs);
    assertFfmpegSucceeded(result, 'GIF export without overlay');

    const info = await stat(output);
    expect(info.size).toBeGreaterThan(0);
  });

  it('exports MP4 with mixed-speed slices and per-slice crop', async () => {
    const output = join(tempDir, 'case-mp4-basic.mp4');
    const built = buildFfmpegCommand({
      video: createVideoMeta('fixture-input.mp4'),
      slices: createSlices(),
      globalCrop: baseCrop,
      exportSettings: createExportSettings('mp4', {
        speedOverlay: false,
        width: 480,
        height: 270,
        mp4Fps: 24,
      }),
      inputFileName: fixtureInput,
      outputFileName: output,
    });

    const result = await runFfmpeg(built.execArgs);
    assertFfmpegSucceeded(result, 'MP4 export');

    const info = await stat(output);
    expect(info.size).toBeGreaterThan(0);
  });

  it('falls back cleanly when drawtext is unavailable', async () => {
    const slices = createSlices();
    const withOverlayOutput = join(tempDir, 'case-overlay-direct.gif');
    const fontFile = getSpeedOverlayFontFile();

    const withOverlay = buildFfmpegCommand({
      video: createVideoMeta('fixture-input.mp4'),
      slices,
      globalCrop: baseCrop,
      exportSettings: createExportSettings('gif', { speedOverlay: true }),
      speedOverlayFontFile: fontFile,
      inputFileName: fixtureInput,
      outputFileName: withOverlayOutput,
    });

    expect(withOverlay.filterComplex.includes('drawtext=fontfile=')).toBe(true);

    const directResult = await runFfmpeg(withOverlay.execArgs);

    if (drawtextSupported) {
      assertFfmpegSucceeded(directResult, 'GIF export with drawtext');
      const info = await stat(withOverlayOutput);
      expect(info.size).toBeGreaterThan(0);
      return;
    }

    expect(directResult.code).not.toBe(0);

    const fallbackOutput = join(tempDir, 'case-overlay-fallback.gif');
    const fallback = buildFfmpegCommand({
      video: createVideoMeta('fixture-input.mp4'),
      slices,
      globalCrop: baseCrop,
      exportSettings: createExportSettings('gif', { speedOverlay: true }),
      enableSpeedOverlay: false,
      inputFileName: fixtureInput,
      outputFileName: fallbackOutput,
    });

    expect(fallback.filterComplex.includes('drawtext')).toBe(false);

    const fallbackResult = await runFfmpeg(fallback.execArgs);
    assertFfmpegSucceeded(fallbackResult, 'GIF export fallback without drawtext');

    const info = await stat(fallbackOutput);
    expect(info.size).toBeGreaterThan(0);
  });
});
