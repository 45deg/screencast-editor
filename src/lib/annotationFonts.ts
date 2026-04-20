import type { AnnotationFontFamily } from '../types/editor';

export interface AnnotationFontOption {
  value: AnnotationFontFamily;
  label: string;
  group: string;
  fontFamily: string;
}

export const ANNOTATION_FONT_OPTIONS: AnnotationFontOption[] = [
  {
    value: 'bebas-neue',
    label: 'Bebas Neue',
    group: 'Display',
    fontFamily: '"Bebas Neue", sans-serif',
  },
  {
    value: 'anton',
    label: 'Anton',
    group: 'Display',
    fontFamily: 'Anton, sans-serif',
  },
  {
    value: 'dela-gothic-one',
    label: 'Dela Gothic One',
    group: 'Display',
    fontFamily: '"Dela Gothic One", sans-serif',
  },
  {
    value: 'oswald',
    label: 'Oswald',
    group: 'Display',
    fontFamily: 'Oswald, sans-serif',
  },
  {
    value: 'roboto',
    label: 'Roboto',
    group: 'Sans',
    fontFamily: 'Roboto, sans-serif',
  },
  {
    value: 'roboto-flex',
    label: 'Roboto Flex',
    group: 'Sans',
    fontFamily: '"Roboto Flex", sans-serif',
  },
  {
    value: 'inter',
    label: 'Inter',
    group: 'Sans',
    fontFamily: 'Inter, sans-serif',
  },
  {
    value: 'montserrat',
    label: 'Montserrat',
    group: 'Sans',
    fontFamily: 'Montserrat, sans-serif',
  },
  {
    value: 'google-sans-flex',
    label: 'Google Sans Flex',
    group: 'Sans',
    fontFamily: '"Google Sans Flex", sans-serif',
  },
  {
    value: 'noto-sans-jp',
    label: 'Noto Sans JP',
    group: 'Japanese',
    fontFamily: '"Noto Sans JP", sans-serif',
  },
  {
    value: 'zen-maru-gothic',
    label: 'Zen Maru Gothic',
    group: 'Japanese',
    fontFamily: '"Zen Maru Gothic", sans-serif',
  },
  {
    value: 'yusei-magic',
    label: 'Yusei Magic',
    group: 'Japanese',
    fontFamily: '"Yusei Magic", sans-serif',
  },
  {
    value: 'kaisei-opti',
    label: 'Kaisei Opti',
    group: 'Serif',
    fontFamily: '"Kaisei Opti", serif',
  },
];

const FONT_OPTION_BY_VALUE = new Map(ANNOTATION_FONT_OPTIONS.map((option) => [option.value, option]));

export function resolveAnnotationFontFamily(fontFamily: AnnotationFontFamily): string {
  return FONT_OPTION_BY_VALUE.get(fontFamily)?.fontFamily ?? ANNOTATION_FONT_OPTIONS[0].fontFamily;
}

export function resolveAnnotationFontLabel(fontFamily: AnnotationFontFamily): string {
  return FONT_OPTION_BY_VALUE.get(fontFamily)?.label ?? ANNOTATION_FONT_OPTIONS[0].label;
}
