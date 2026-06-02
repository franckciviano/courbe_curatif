export const CURVE_COLORS = [
  '#60A5FA', '#A78BFA', '#F472B6', '#34D399',
  '#FBBF24', '#FB923C', '#F87171', '#2DD4BF',
  '#C084FC', '#E879F9', '#FACC15', '#4ADE80',
];

export function pickColor(usedColors) {
  for (const c of CURVE_COLORS) {
    if (!usedColors.includes(c)) return c;
  }
  return CURVE_COLORS[usedColors.length % CURVE_COLORS.length];
}
