/**
 * Platform-neutral geometry for the Wayfare brand mark.
 *
 * Each app renders this definition with its native SVG renderer so the mark
 * stays visually identical without coupling the domain package to a UI runtime.
 */
export const wayfareLogo = {
  mark: {
    cornerRadius: 10,
    rotationDegrees: -7,
    size: 29,
  },
  compass: {
    circle: { cx: 12, cy: 12, r: 10 },
    path: 'm16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z',
    rotationDegrees: 7,
    size: 17,
    viewBox: '0 0 24 24',
  },
} as const;
