// Equirectangular projection for the lightweight selection preview.
// Pure math: lng [-180,180] -> x [0,w], lat [-90,90] -> y [0,h] (north up).
export function project(
  latitude: number,
  longitude: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const x = ((longitude + 180) / 360) * width;
  const y = ((90 - latitude) / 180) * height;
  return { x, y };
}
