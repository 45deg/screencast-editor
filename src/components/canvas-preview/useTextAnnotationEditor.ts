import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import type { AnnotationModel } from '../../types/editor';

const DOUBLE_TAP_MS = 320;
const LONG_PRESS_MS = 420;
const LONG_PRESS_MOVE_THRESHOLD = 12;

interface UseTextAnnotationEditorArgs {
  activeAnnotations: AnnotationModel[];
  isEditing: boolean;
  onSelectedAnnotationIdChange: (annotationId: string | null) => void;
  onTextAnnotationChange: (annotationId: string, text: string) => void;
  onStartInlineEdit?: () => void;
}

export function useTextAnnotationEditor({
  activeAnnotations,
  isEditing,
  onSelectedAnnotationIdChange,
  onTextAnnotationChange,
  onStartInlineEdit,
}: UseTextAnnotationEditorArgs) {
  const inlineEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const lastTapRef = useRef<{ annotationId: string; timestamp: number } | null>(null);
  const cancelTouchLongPressRef = useRef<(() => void) | null>(null);
  const [editingTextAnnotationId, setEditingTextAnnotationId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');

  const clearPendingTouchLongPress = useCallback(() => {
    if (!cancelTouchLongPressRef.current) {
      return;
    }

    cancelTouchLongPressRef.current();
    cancelTouchLongPressRef.current = null;
  }, []);

  useEffect(() => {
    if (!editingTextAnnotationId) {
      return;
    }

    const input = inlineEditorRef.current;
    if (!input) {
      return;
    }

    input.focus();
    const cursor = input.value.length;
    input.setSelectionRange(cursor, cursor);
  }, [editingTextAnnotationId]);

  useEffect(() => {
    if (!editingTextAnnotationId) {
      return;
    }

    const exists = activeAnnotations.some(
      (annotation) => annotation.id === editingTextAnnotationId && annotation.kind === 'text',
    );

    if (!exists || isEditing) {
      const timer = window.setTimeout(() => {
        setEditingTextAnnotationId(null);
      }, 0);

      return () => {
        window.clearTimeout(timer);
      };
    }
  }, [activeAnnotations, editingTextAnnotationId, isEditing]);

  useEffect(() => {
    return () => {
      clearPendingTouchLongPress();
    };
  }, [clearPendingTouchLongPress]);

  const startInlineTextEdit = useCallback(
    (annotation: Extract<AnnotationModel, { kind: 'text' }>) => {
      onStartInlineEdit?.();
      setEditingTextAnnotationId(annotation.id);
      setEditingTextValue(annotation.text);
      onSelectedAnnotationIdChange(annotation.id);
    },
    [onSelectedAnnotationIdChange, onStartInlineEdit],
  );

  const cancelInlineTextEdit = useCallback(() => {
    setEditingTextAnnotationId(null);
  }, []);

  const commitInlineTextEdit = useCallback(() => {
    if (!editingTextAnnotationId) {
      return;
    }

    onTextAnnotationChange(editingTextAnnotationId, editingTextValue);
    setEditingTextAnnotationId(null);
  }, [editingTextAnnotationId, editingTextValue, onTextAnnotationChange]);

  const handleTextPointerDown = useCallback(
    (event: ReactPointerEvent, annotation: Extract<AnnotationModel, { kind: 'text' }>) => {
      if (editingTextAnnotationId === annotation.id) {
        return;
      }

      if (event.detail >= 2) {
        startInlineTextEdit(annotation);
        return;
      }

      if (event.pointerType === 'touch') {
        const now = Date.now();
        const previousTap = lastTapRef.current;

        if (
          previousTap &&
          previousTap.annotationId === annotation.id &&
          now - previousTap.timestamp <= DOUBLE_TAP_MS
        ) {
          clearPendingTouchLongPress();
          lastTapRef.current = null;
          startInlineTextEdit(annotation);
          return;
        }

        clearPendingTouchLongPress();

        lastTapRef.current = {
          annotationId: annotation.id,
          timestamp: now,
        };

        const pointerId = event.pointerId;
        const startX = event.clientX;
        const startY = event.clientY;
        let timer: number | null = window.setTimeout(() => {
          timer = null;
          startInlineTextEdit(annotation);
          cancelTouchLongPressRef.current = null;
          window.removeEventListener('pointermove', handlePointerMove);
          window.removeEventListener('pointerup', handlePointerEnd);
          window.removeEventListener('pointercancel', handlePointerEnd);
        }, LONG_PRESS_MS);

        const cancelLongPress = () => {
          if (timer !== null) {
            window.clearTimeout(timer);
            timer = null;
          }

          window.removeEventListener('pointermove', handlePointerMove);
          window.removeEventListener('pointerup', handlePointerEnd);
          window.removeEventListener('pointercancel', handlePointerEnd);
        };

        const handlePointerMove = (nativeEvent: PointerEvent) => {
          if (nativeEvent.pointerId !== pointerId || timer === null) {
            return;
          }

          const distance = Math.hypot(nativeEvent.clientX - startX, nativeEvent.clientY - startY);
          if (distance > LONG_PRESS_MOVE_THRESHOLD) {
            cancelLongPress();
            cancelTouchLongPressRef.current = null;
          }
        };

        const handlePointerEnd = (nativeEvent: PointerEvent) => {
          if (nativeEvent.pointerId !== pointerId) {
            return;
          }

          cancelLongPress();
          cancelTouchLongPressRef.current = null;
        };

        window.addEventListener('pointermove', handlePointerMove, { passive: true });
        window.addEventListener('pointerup', handlePointerEnd, { passive: true });
        window.addEventListener('pointercancel', handlePointerEnd, { passive: true });
        cancelTouchLongPressRef.current = cancelLongPress;
      }

      onSelectedAnnotationIdChange(annotation.id);
    },
    [clearPendingTouchLongPress, editingTextAnnotationId, onSelectedAnnotationIdChange, startInlineTextEdit],
  );

  return {
    inlineEditorRef,
    editingTextAnnotationId,
    editingTextValue,
    setEditingTextValue,
    startInlineTextEdit,
    cancelInlineTextEdit,
    commitInlineTextEdit,
    handleTextPointerDown,
  };
}
