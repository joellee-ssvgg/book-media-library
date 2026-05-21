type ZipFileInput = {
  name: string;
  content: string;
};

const crcTable = new Uint32Array(256);

for (let index = 0; index < 256; index += 1) {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  crcTable[index] = value >>> 0;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function writeUInt16LE(buffer: Uint8Array, offset: number, value: number) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
}

function writeUInt32LE(buffer: Uint8Array, offset: number, value: number) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
  buffer[offset + 2] = (value >>> 16) & 0xff;
  buffer[offset + 3] = (value >>> 24) & 0xff;
}

function concatBytes(parts: Uint8Array[]) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function base64FromBytes(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

export function createStoredZipBase64(files: ZipFileInput[]) {
  if (files.length === 0) {
    throw new Error("ZIP requires at least one file.");
  }

  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    if (!file.name || file.name.includes("..") || file.name.startsWith("/")) {
      throw new Error(`Unsafe ZIP file name: ${file.name}`);
    }

    const nameBytes = encoder.encode(file.name);
    const contentBytes = encoder.encode(file.content);
    const checksum = crc32(contentBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeUInt32LE(localHeader, 0, 0x04034b50);
    writeUInt16LE(localHeader, 4, 20);
    writeUInt16LE(localHeader, 6, 0);
    writeUInt16LE(localHeader, 8, 0);
    writeUInt16LE(localHeader, 10, 0);
    writeUInt16LE(localHeader, 12, 0);
    writeUInt32LE(localHeader, 14, checksum);
    writeUInt32LE(localHeader, 18, contentBytes.length);
    writeUInt32LE(localHeader, 22, contentBytes.length);
    writeUInt16LE(localHeader, 26, nameBytes.length);
    writeUInt16LE(localHeader, 28, 0);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, contentBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeUInt32LE(centralHeader, 0, 0x02014b50);
    writeUInt16LE(centralHeader, 4, 20);
    writeUInt16LE(centralHeader, 6, 20);
    writeUInt16LE(centralHeader, 8, 0);
    writeUInt16LE(centralHeader, 10, 0);
    writeUInt16LE(centralHeader, 12, 0);
    writeUInt16LE(centralHeader, 14, 0);
    writeUInt32LE(centralHeader, 16, checksum);
    writeUInt32LE(centralHeader, 20, contentBytes.length);
    writeUInt32LE(centralHeader, 24, contentBytes.length);
    writeUInt16LE(centralHeader, 28, nameBytes.length);
    writeUInt16LE(centralHeader, 30, 0);
    writeUInt16LE(centralHeader, 32, 0);
    writeUInt16LE(centralHeader, 34, 0);
    writeUInt16LE(centralHeader, 36, 0);
    writeUInt32LE(centralHeader, 38, 0);
    writeUInt32LE(centralHeader, 42, offset);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + contentBytes.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const endRecord = new Uint8Array(22);
  writeUInt32LE(endRecord, 0, 0x06054b50);
  writeUInt16LE(endRecord, 4, 0);
  writeUInt16LE(endRecord, 6, 0);
  writeUInt16LE(endRecord, 8, files.length);
  writeUInt16LE(endRecord, 10, files.length);
  writeUInt32LE(endRecord, 12, centralDirectory.length);
  writeUInt32LE(endRecord, 16, offset);
  writeUInt16LE(endRecord, 20, 0);

  return base64FromBytes(concatBytes([...localParts, centralDirectory, endRecord]));
}
