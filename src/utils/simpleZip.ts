/**
 * Zero-dependency Browser-native ZIP Archive Creator
 * Mengemas berkas Markdown, Gambar, dan Canvas menjadi file .zip standar
 * yang kompatibel penuh dengan Windows Explorer, macOS, Linux, dan Obsidian.
 */

// Tabel CRC32 untuk checksum integritas file ZIP
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c;
}

function calculateCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Konversi tanggal JavaScript ke format DOS date/time (16-bit time, 16-bit date)
function getDosDateTime(date: Date): { time: number; date: number } {
  const d = date || new Date();
  const time =
    ((d.getHours() & 0x1f) << 11) |
    ((d.getMinutes() & 0x3f) << 5) |
    ((Math.floor(d.getSeconds() / 2)) & 0x1f);
  const dosDate =
    (((d.getFullYear() - 1980) & 0x7f) << 9) |
    (((d.getMonth() + 1) & 0x0f) << 5) |
    (d.getDate() & 0x1f);
  return { time, date: dosDate };
}

export interface ZipEntry {
  path: string; // misal: "01 - Naskah/Bab 01.md"
  data: Uint8Array;
  date?: Date;
}

export class SimpleZip {
  private entries: ZipEntry[] = [];
  private encoder = new TextEncoder();

  /**
   * Tambahkan berkas teks (Markdown, Canvas JSON, dll) ke dalam ZIP
   */
  addTextFile(path: string, text: string, date: Date = new Date()): this {
    const data = this.encoder.encode(text);
    this.entries.push({
      path: path.replace(/\\/g, '/'),
      data,
      date,
    });
    return this;
  }

  /**
   * Tambahkan berkas binary (Gambar, Blob) ke dalam ZIP
   */
  async addBlobFile(path: string, blob: Blob, date: Date = new Date()): Promise<this> {
    const arrayBuffer = await blob.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    this.entries.push({
      path: path.replace(/\\/g, '/'),
      data,
      date,
    });
    return this;
  }

  /**
   * Bangun file ZIP dan kembalikan sebagai Blob
   */
  buildZipBlob(): Blob {
    const localHeaders: Uint8Array[] = [];
    const centralHeaders: Uint8Array[] = [];
    let currentOffset = 0;

    for (const entry of this.entries) {
      const pathBytes = this.encoder.encode(entry.path);
      const dataBytes = entry.data;
      const crc = calculateCrc32(dataBytes);
      const { time, date } = getDosDateTime(entry.date || new Date());

      // 1. Local File Header (30 byte + pathBytes.length + dataBytes.length)
      const localHeader = new Uint8Array(30 + pathBytes.length);
      const lv = new DataView(localHeader.buffer);

      lv.setUint32(0, 0x04034b50, true); // Signature PK\x03\x04
      lv.setUint16(4, 20, true);         // Version needed: 2.0
      lv.setUint16(6, 0x0800, true);     // General purpose flag: UTF-8 (bit 11)
      lv.setUint16(8, 0, true);          // Compression method: 0 (STORE)
      lv.setUint16(10, time, true);      // Last mod time
      lv.setUint16(12, date, true);      // Last mod date
      lv.setUint32(14, crc, true);       // CRC-32
      lv.setUint32(18, dataBytes.length, true); // Compressed size
      lv.setUint32(22, dataBytes.length, true); // Uncompressed size
      lv.setUint16(26, pathBytes.length, true); // Filename length
      lv.setUint16(28, 0, true);         // Extra field length
      localHeader.set(pathBytes, 30);

      localHeaders.push(localHeader, dataBytes);

      // 2. Central Directory Header (46 byte + pathBytes.length)
      const centralHeader = new Uint8Array(46 + pathBytes.length);
      const cv = new DataView(centralHeader.buffer);

      cv.setUint32(0, 0x02014b50, true); // Signature PK\x01\x02
      cv.setUint16(4, 20, true);         // Version made by: 2.0
      cv.setUint16(6, 20, true);         // Version needed: 2.0
      cv.setUint16(8, 0x0800, true);     // Flag: UTF-8
      cv.setUint16(10, 0, true);         // Compression method: 0 (STORE)
      cv.setUint16(12, time, true);      // Time
      cv.setUint16(14, date, true);      // Date
      cv.setUint32(16, crc, true);       // CRC-32
      cv.setUint32(20, dataBytes.length, true); // Compressed size
      cv.setUint32(24, dataBytes.length, true); // Uncompressed size
      cv.setUint16(28, pathBytes.length, true); // Filename length
      cv.setUint16(30, 0, true);         // Extra field length
      cv.setUint16(32, 0, true);         // File comment length
      cv.setUint16(34, 0, true);         // Disk number start
      cv.setUint16(36, 0, true);         // Internal file attributes
      cv.setUint32(38, 0, true);         // External file attributes
      cv.setUint32(42, currentOffset, true); // Relative offset of local header
      centralHeader.set(pathBytes, 46);

      centralHeaders.push(centralHeader);

      currentOffset += localHeader.length + dataBytes.length;
    }

    const centralDirOffset = currentOffset;
    let centralDirSize = 0;
    for (const ch of centralHeaders) {
      centralDirSize += ch.length;
    }

    // 3. End of Central Directory Record (22 byte)
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);         // Signature PK\x05\x06
    ev.setUint16(4, 0, true);                  // Number of this disk
    ev.setUint16(6, 0, true);                  // Disk where central directory starts
    ev.setUint16(8, this.entries.length, true); // Number of central directory records on this disk
    ev.setUint16(10, this.entries.length, true);// Total number of central directory records
    ev.setUint32(12, centralDirSize, true);    // Size of central directory
    ev.setUint32(16, centralDirOffset, true);  // Offset of start of central directory
    ev.setUint16(20, 0, true);                 // Comment length

    // Gabungkan seluruh buffer menjadi satu Blob berkas ZIP utuh
    const allParts: (Uint8Array | Blob)[] = [...localHeaders, ...centralHeaders, eocd];
    return new Blob(allParts, { type: 'application/zip' });
  }
}
