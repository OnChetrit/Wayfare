import { wayfareLogo } from '@wayfare/domain';

type WayfareLogoIconProps = {
  size?: number;
  strokeWidth?: number;
};

/** Renders the shared Wayfare compass geometry in the web SVG runtime. */
export function WayfareLogoIcon({ size = 17, strokeWidth = 2.5 }: WayfareLogoIconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox={wayfareLogo.compass.viewBox}
      width={size}
    >
      <path d={wayfareLogo.compass.path} />
      <circle {...wayfareLogo.compass.circle} />
    </svg>
  );
}
