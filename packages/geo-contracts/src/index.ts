export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  point: GeoPoint;
  label: string;
}

export interface RouteLeg {
  distanceMeters: number;
  durationSeconds: number;
}

export interface GeoProvider {
  readonly name: string;
  geocode(query: string): Promise<GeocodeResult[]>;
  route(waypoints: GeoPoint[]): Promise<RouteLeg[]>;
}
