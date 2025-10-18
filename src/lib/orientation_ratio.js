export const get_aspect_ratio_class = (orientation) => {
  if (orientation === 'landscape') return 'ratio-4-3';
  if (orientation === 'portrait')  return 'ratio-3-4';
  if (orientation === 'square')    return 'ratio-1-1';
  return 'ratio-1-1';
};