import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import type { AnnotationModel } from '../../types/editor';

const DOUBLE_TAP_MS = 320;

interface UseTextAnnotationEditorArgs {
  activeAnnotations: AnnotationModel[];
  isEditing: boolean;
  onSelectedAnnotationIdChange: (annotationId: string | null) => void;
  onTextAnnotationChange: (annotationId: string, text: string) => void;
  beginAnnotationDrag: (event: ReactPointerEvent, annotation: AnnotationModel) => void;
  onStartInlineEdit?: () => void;
}

export function useTextAnnotationEditor({
  activeAnnotations,
  isEditing,
  onSelectedAnnotationIdChange,
  onTextAnnotationChange,
  beginAnnotationDrag,
  onStartInlineEdit,
}: UseTextAnnotationEditorArgs) {
  const inlineEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const lastTapRef = useRef<{ annotationId: string; timestamp: number } | null>(null);
  const [editingTextAnnotationId, setEditingTextAnnotationId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');

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
          lastTapRef.current = null;
          startInlineTextEdit(annotation);
          return;
        }

        lastTapRef.current = {
          annotationId: annotation.id,
          timestamp: now,
        };
      }

      beginAnnotationDrag(event, annotation);
    },
    [beginAnnotationDrag, editingTextAnnotationId, startInlineTextEdit],
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
