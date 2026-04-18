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

const FFMPEG_TIMEOUT_MS = 30_000;

const ffmpegAvailable = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
const describeIfFfmpeg = ffmpegAvailable ? describe : describe.skip;

function runFfmpeg(args: string[]): Promise<FfmpegRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-nostdin', '-y', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let killedForTimeout = false;

    const timeout = setTimeout(() => {
      killedForTimeout = true;
      child.kill('SIGKILL');
    }, FFMPEG_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timeout);

      if (killedForTimeout) {
        resolve({
          code: -1,
          stdout,
          stderr: `${stderr}\nffmpeg timed out after ${FFMPEG_TIMEOUT_MS}ms`,
        });
        return;
      }

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
      timelineStart: 0,
      sourceStart: 0,
      sourceEnd: 2,
      duration: 2,
      crop: null,
    },
    {
      id: 'slice-b',
      timelineStart: 2,
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
    ...overrides,
  };
}

describeIfFfmpeg('FFmpeg command integration', () => {
  let tempDir = '';
  let fixtureInput = '';
  let overlayFixture = '';

  const baseCrop: CropRect = {
    x: 0,
    y: 0,
    w: 640,
    h: 360,
  };

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'screencast-editor-ffmpeg-'));
    fixtureInput = join(tempDir, 'fixture-input.mp4');
    overlayFixture = join(tempDir, 'fixture-overlay.png');

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

    const overlay = await runFfmpeg([
      '-f',
      'lavfi',
      '-i',
      'color=c=black@0.0:s=640x360:d=0.1',
      '-vf',
      'drawbox=x=24:y=24:w=280:h=86:color=red@0.9:t=fill,drawbox=x=32:y=32:w=264:h=70:color=black@0.4:t=fill',
      '-frames:v',
      '1',
      '-pix_fmt',
      'rgba',
      overlayFixture,
    ]);
    assertFfmpegSucceeded(overlay, 'overlay fixture generation');

  });

  afterAll(async () => {
    if (!tempDir) {
      return;
    }

    await rm(tempDir, { recursive: true, force: true });
  });

  it('exports GIF with crop/pad', async () => {
    const output = join(tempDir, 'case-gif-basic.gif');
    const built = buildFfmpegCommand({
      video: createVideoMeta('fixture-input.mp4'),
      slices: createSlices(),
      globalCrop: baseCrop,
      exportSettings: createExportSettings('gif'),
      inputFileName: fixtureInput,
      outputFileName: output,
    });

    const result = await runFfmpeg(built.execArgs);
    assertFfmpegSucceeded(result, 'GIF export');

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

  it('exports MP4 with overlay input (text raster equivalent)', async () => {
    const output = join(tempDir, 'case-mp4-overlay.mp4');
    const built = buildFfmpegCommand({
      video: createVideoMeta('fixture-input.mp4'),
      slices: createSlices(),
      globalCrop: baseCrop,
      exportSettings: createExportSettings('mp4', {
        width: 640,
        height: 360,
        mp4Fps: 30,
      }),
      inputFileName: fixtureInput,
      outputFileName: output,
      overlayInputs: [
        {
          fileName: overlayFixture,
          start: 0.4,
          end: 2.6,
        },
      ],
      outputDuration: 3,
    });

    const result = await runFfmpeg(built.execArgs);
    assertFfmpegSucceeded(result, 'MP4 export with overlay input');

    const info = await stat(output);
    expect(info.size).toBeGreaterThan(0);
  });
});
