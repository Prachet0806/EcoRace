// Great-circle interpolation for route rendering (P0-10).
// Returns [lng, lat] pairs; endpoints exact, intermediate points on the sphere.

export function greatCirclePoints(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  n = 50,
): Array<[number, number]> {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const [p1, p2] = [toRad(lat1), toRad(lat2)];
  const [l1, l2] = [toRad(lng1), toRad(lng2)];

  const sinP1 = Math.sin(p1);
  const cosP1 = Math.cos(p1);
  const dLng = l2 - l1;
  const cosSigma =
    Math.min(1, Math.max(-1, sinP1 * Math.sin(p2) + cosP1 * Math.cos(p2) * Math.cos(dLng)));
  const sigma = Math.acos(cosSigma);

  if (sigma < 1e-12) return [[lng1, lat1]];
  const sinSigma = Math.sin(sigma);

  const points: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const a = Math.sin((1 - f) * sigma) / sinSigma;
    const b = Math.sin(f * sigma) / sinSigma;
    const x = a * cosP1 * Math.cos(l1) + b * Math.cos(p2) * Math.cos(l2);
    const y = a * cosP1 * Math.sin(l1) + b * Math.cos(p2) * Math.sin(l2);
    const z = a * sinP1 + b * Math.sin(p2);
    points.push([toDeg(Math.atan2(y, x)), toDeg(Math.asin(Math.min(1, Math.max(-1, z))))]);
  }
  return points;
}
