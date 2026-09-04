import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMediaImportHandlers } from '../src/app/hooks/useMediaImportHandlers';
import { useScreenCapture } from '../src/app/hooks/useScreenCapture';
import { readImageMetaFromObjectUrl } from '../src/lib/image';
import { prepareAnnotationAssets, releaseAnnotationAssets } from '../src/lib/exportRenderer';
import { useEditorStore } from '../src/store/editorStore';
import { DEFAULT_TEXT_ANNOTATION_STYLE, type AnnotationModel, type VideoMeta } from '../src/types/editor';

vi.mock('../src/lib/image', () => ({ readImageMetaFromObjectUrl: vi.fn() }));

// Obtain the real hook callbacks without adding a DOM test dependency.
// These tests exercise async callbacks, not effect or UI rendering behavior.
function captureHook<T>(useHook: () => T): T {
  let result: T;
  function Harness() {
    // Test-only bridge out of a single synchronous server render.
    // eslint-disable-next-line react-hooks/globals
    result = useHook();
    return null;
  }
  renderToString(createElement(Harness));
  return result!;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const video: VideoMeta = {
  id: 'video', kind: 'video', file: new File([], 'video.mp4'),
  objectUrl: 'blob:video', width: 640, height: 480, duration: 10,
};
const textAnnotation: AnnotationModel = {
  id: 'text', kind: 'text', start: 0, duration: 3, x: 0, y: 0,
  text: 'original', style: DEFAULT_TEXT_ANNOTATION_STYLE,
};
const imageAnnotation: AnnotationModel = {
  id: 'image', kind: 'image', start: 0, duration: 3, x: 0, y: 0,
  width: 10, height: 10, naturalWidth: 10, naturalHeight: 10,
  file: new File([], 'image.png'), imageUrl: 'blob:image', opacity: 1,
};

beforeEach(() => {
  useEditorStore.getState().setVideo(video);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pending-image');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.mocked(readImageMetaFromObjectUrl).mockReset();
  useEditorStore.getState().clearVideo();
});

function importHandlers() {
  return captureHook(() => useMediaImportHandlers({
    ...useEditorStore.getState(), baseCrop: { x: 0, y: 0, w: 640, h: 480 },
    ensureExportRuntimeReady: async () => true, resetExportState: vi.fn(), t: (key) => key,
  }));
}

describe('pending image imports', () => {
  it('preserves edits made while an image is loading and undo restores the edited state', async () => {
    useEditorStore.getState().replaceAnnotationsCommit([textAnnotation]);
    const pending = deferred<{ width: number; height: number }>();
    vi.mocked(readImageMetaFromObjectUrl).mockReturnValue(pending.promise);
    const handlers = importHandlers();
    const importing = handlers.handleCreateImageAnnotation(imageAnnotation.file);
    useEditorStore.getState().replaceAnnotationsCommit([{ ...textAnnotation, text: 'edited' }]);
    pending.resolve({ width: 10, height: 10 });
    await importing;
    expect(useEditorStore.getState().annotations).toHaveLength(2);
    expect(useEditorStore.getState().annotations[0]).toMatchObject({ text: 'edited' });
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().annotations).toEqual([{ ...textAnnotation, text: 'edited' }]);
  });

  it('keeps both images when concurrent loads finish in reverse order', async () => {
    const first = deferred<{ width: number; height: number }>();
    const second = deferred<{ width: number; height: number }>();
    vi.mocked(readImageMetaFromObjectUrl)
      .mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const handlers = importHandlers();
    const firstFile = new File([], 'first.png');
    const secondFile = new File([], 'second.png');
    const importingFirst = handlers.handleCreateImageAnnotation(firstFile);
    const importingSecond = handlers.handleCreateImageAnnotation(secondFile);
    second.resolve({ width: 10, height: 10 });
    await importingSecond;
    first.resolve({ width: 10, height: 10 });
    await importingFirst;
    expect(useEditorStore.getState().annotations.map((item) => item.kind === 'image' && item.file.name))
      .toEqual(['second.png', 'first.png']);
  });

  it.each(['leave', 'replace'] as const)('discards a pending image after project %s', async (action) => {
    const pending = deferred<{ width: number; height: number }>();
    vi.mocked(readImageMetaFromObjectUrl).mockReturnValue(pending.promise);
    const handlers = importHandlers();
    const importing = handlers.handleCreateImageAnnotation(imageAnnotation.file);
    if (action === 'leave') handlers.handleReturnToLanding();
    else useEditorStore.getState().setVideo({ ...video, id: 'replacement' });
    pending.resolve({ width: 10, height: 10 });
    await importing;
    expect(useEditorStore.getState().annotations).toEqual([]);
    expect(useEditorStore.getState().past).toEqual([]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pending-image');
  });
});

describe('capture startup cleanup', () => {
  it('stops every captured track if MediaRecorder construction fails', async () => {
    const stopVideo = vi.fn();
    const stopOther = vi.fn();
    const track = { stop: stopVideo, applyConstraints: vi.fn().mockResolvedValue(undefined) };
    const stream = { getVideoTracks: () => [track], getTracks: () => [track, { stop: stopOther }] };
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: vi.fn().mockResolvedValue(stream) } });
    vi.stubGlobal('MediaRecorder', class { constructor() { throw new Error('recorder failed'); } });
    const onImportError = vi.fn();
    const handlers = captureHook(() => useScreenCapture({
      supportsScreenCapture: true, onPrepareStart: vi.fn(), onImportVideo: vi.fn(),
      onImportError, toErrorMessage: String, getScreenRecordingMimeType: () => 'video/webm',
      getScreenRecordingExtension: () => 'webm', t: (key) => key,
    }));
    await handlers.handleStartScreenCapture();
    expect(stopVideo).toHaveBeenCalledOnce();
    expect(stopOther).toHaveBeenCalledOnce();
    expect(onImportError).toHaveBeenCalledWith('Error: recorder failed');
  });
});

describe('export image cleanup', () => {
  it('closes prepared images when a later image fails and preserves the original error', async () => {
    const close = vi.fn();
    const error = new Error('image decode failed');
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValueOnce({ close }).mockRejectedValueOnce(error));
    await expect(prepareAnnotationAssets([imageAnnotation, { ...imageAnnotation, id: 'second' }]))
      .rejects.toBe(error);
    expect(close).toHaveBeenCalledOnce();
  });

  it('keeps successfully prepared images alive until released', async () => {
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close }));
    const assets = await prepareAnnotationAssets([imageAnnotation]);
    expect(close).not.toHaveBeenCalled();
    releaseAnnotationAssets(assets);
    expect(close).toHaveBeenCalledOnce();
  });
});
