import { customType } from "drizzle-orm/pg-core";

type GeographyPoint = [number, number];
type GeographyLineString = GeographyPoint[];

export const geographyPointColumnType = customType<{
  data: GeographyPoint;
  notNull: false;
  default: false;
}>({
  dataType() {
    return "geography";
  },
  toDriver(value): string {
    const [lon, lat] = value;
    return `SRID=4326;POINT(${lon} ${lat})`;
  },
  fromDriver(value) {
    // Note: this may be less performant than directly formatting on DB side
    return parseEWKBPoint(value as string);
  },
});

export const geographyLineStringColumnType = customType<{
  data: GeographyLineString;
  notNull: false;
  default: false;
}>({
  dataType() {
    return "geography";
  },
  toDriver(value: [number, number][]): string {
    const pointsStr = value.map(([lon, lat]) => `${lon} ${lat}`).join(", ");
    return `SRID=4326;LINESTRING(${pointsStr})`;
  },
  fromDriver(value) {
    // Note: this may be less performant than directly formatting on DB side
    return parseEWKBLineString(value as string);
  },
});

function parseEWKBPoint(hex: string): GeographyPoint {
  const bytes = hexToBytes(hex);
  let offset = 1; // Skip byte order

  const view = new DataView(bytes.buffer);
  const geomType = view.getUint32(offset, true);
  offset += 4;

  if (geomType & 0x20000000) {
    // SRID flag
    offset += 4; // Skip SRID
  }

  const x = bytesToFloat64(bytes, offset);
  offset += 8;
  const y = bytesToFloat64(bytes, offset);

  return [x, y];
}

function parseEWKBLineString(hex: string): GeographyLineString {
  const bytes = hexToBytes(hex);
  let offset = 1; // Skip byte order

  const view = new DataView(bytes.buffer);
  const geomType = view.getUint32(offset, true);
  offset += 4;

  if (geomType & 0x20000000) {
    // SRID flag
    offset += 4; // Skip SRID
  }

  const numPoints = view.getUint32(offset, true);
  offset += 4;

  const points: GeographyPoint[] = [];
  for (let i = 0; i < numPoints; i++) {
    const x = bytesToFloat64(bytes, offset);
    offset += 8;
    const y = bytesToFloat64(bytes, offset);
    offset += 8;
    points.push([x, y]);
  }

  return points;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes: number[] = [];
  for (let c = 0; c < hex.length; c += 2) {
    bytes.push(Number.parseInt(hex.slice(c, c + 2), 16));
  }
  return new Uint8Array(bytes);
}

function bytesToFloat64(bytes: Uint8Array, offset: number): number {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  for (let i = 0; i < 8; i++) {
    view.setUint8(i, bytes[offset + i]!);
  }
  return view.getFloat64(0, true);
}
