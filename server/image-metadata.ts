import { IntakeError } from './intake-validation.js';

export type ImageMetadata = {
  format: 'png' | 'jpeg' | 'webp';
  width: number;
  height: number;
};

function dimensions(
  width: number,
  height: number,
  format: ImageMetadata['format'],
): ImageMetadata {
  if (!width || !height || width > 100_000 || height > 100_000)
    throw new IntakeError(
      422,
      'invalid_image',
      'The image dimensions are invalid.',
    );
  return { format, width, height };
}

export function inspectImage(bytes: Buffer): ImageMetadata {
  if (
    bytes.length >= 24 &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.toString('ascii', 12, 16) === 'IHDR'
  ) {
    return dimensions(bytes.readUInt32BE(16), bytes.readUInt32BE(20), 'png');
  }

  if (
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    let offset = 2;
    while (offset < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      if (offset >= bytes.length) break;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const segmentLength = bytes.readUInt16BE(offset);
      if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker)
      ) {
        if (segmentLength < 7) break;
        return dimensions(
          bytes.readUInt16BE(offset + 5),
          bytes.readUInt16BE(offset + 3),
          'jpeg',
        );
      }
      offset += segmentLength;
    }
    throw new IntakeError(
      422,
      'invalid_image',
      'The JPEG image could not be read.',
    );
  }

  if (
    bytes.length >= 30 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    const chunk = bytes.toString('ascii', 12, 16);
    if (chunk === 'VP8X')
      return dimensions(
        1 + bytes.readUIntLE(24, 3),
        1 + bytes.readUIntLE(27, 3),
        'webp',
      );
    if (chunk === 'VP8L' && bytes[20] === 0x2f) {
      const bits = bytes.readUInt32LE(21);
      return dimensions(
        (bits & 0x3fff) + 1,
        ((bits >>> 14) & 0x3fff) + 1,
        'webp',
      );
    }
    if (
      chunk === 'VP8 ' &&
      bytes[23] === 0x9d &&
      bytes[24] === 0x01 &&
      bytes[25] === 0x2a
    ) {
      return dimensions(
        bytes.readUInt16LE(26) & 0x3fff,
        bytes.readUInt16LE(28) & 0x3fff,
        'webp',
      );
    }
  }
  throw new IntakeError(
    415,
    'unsupported_image',
    'Upload a valid PNG, JPEG, or WebP image.',
  );
}

export function isPdf(bytes: Buffer): boolean {
  return bytes.length >= 5 && bytes.toString('ascii', 0, 5) === '%PDF-';
}
