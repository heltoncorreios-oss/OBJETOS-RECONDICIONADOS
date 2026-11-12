import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { build } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const EXT_DIR = path.resolve(ROOT_DIR, 'extension');
const OUT_DIR = path.resolve(ROOT_DIR, 'dist-extension');
const PUBLIC_ZIP_PATH = path.resolve(ROOT_DIR, 'public', 'extensao-sro-piloto.zip');

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function getDosTimeDate(date) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((date.getSeconds() >> 1) & 0x1f);
  const dosDate =
    (((year - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f);
  return { dosTime, dosDate };
}

function createZipBuffer(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const now = new Date();
  const { dosTime, dosDate } = getDosTimeDate(now);

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const rawBuf = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
    const compressedBuf = zlib.deflateRawSync(rawBuf);
    const crc = crc32(rawBuf);

    // Local File Header (30 bytes + filename)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed to extract
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    localHeader.writeUInt16LE(8, 8); // compression method: deflate
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedBuf.length, 18);
    localHeader.writeUInt32LE(rawBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length

    localParts.push(localHeader, nameBuf, compressedBuf);

    // Central Directory File Header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0x0800, 8); // UTF-8 flag
    centralHeader.writeUInt16LE(8, 10); // deflate
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressedBuf.length, 20);
    centralHeader.writeUInt32LE(rawBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra len
    centralHeader.writeUInt16LE(0, 32); // comment len
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(offset, 42); // relative offset

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compressedBuf.length;
  }

  const centralDirBuffer = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirBuffer, eocd]);
}

async function buildExtension() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Service Worker MV3 (type: "module")
  await build({
    entryPoints: [path.join(EXT_DIR, 'src', 'background.ts')],
    outdir: OUT_DIR,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['chrome114', 'edge114'],
    sourcemap: false,
    minify: false,
  });

  // Content scripts e popup (scripts clássicos sem export top-level)
  await build({
    entryPoints: [
      path.join(EXT_DIR, 'src', 'appBridge.ts'),
      path.join(EXT_DIR, 'src', 'sroContentScript.ts'),
      path.join(EXT_DIR, 'src', 'sroMainClickHelper.ts'),
      path.join(EXT_DIR, 'src', 'buscaCepContentScript.ts'),
      path.join(EXT_DIR, 'src', 'popup.ts'),
    ],
    outdir: OUT_DIR,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome114', 'edge114'],
    sourcemap: false,
    minify: false,
  });

  fs.copyFileSync(
    path.join(EXT_DIR, 'manifest.json'),
    path.join(OUT_DIR, 'manifest.json')
  );
  fs.copyFileSync(
    path.join(EXT_DIR, 'src', 'popup.html'),
    path.join(OUT_DIR, 'popup.html')
  );

  // Empacotar os arquivos prontos de dist-extension em public/extensao-sro-piloto.zip
  fs.mkdirSync(path.dirname(PUBLIC_ZIP_PATH), { recursive: true });
  const distFiles = fs
    .readdirSync(OUT_DIR)
    .filter((f) => fs.statSync(path.join(OUT_DIR, f)).isFile())
    .sort();

  const readmeTxt = [
    'CORREIOS SRO - CONTROLE DE RECONDICIONADOS (EXTENSAO PILOTO)',
    '============================================================',
    '',
    'Como instalar em outra estacao (nao precisa Node.js nem baixar codigo-fonte):',
    '1. Extraia este arquivo .zip (clique direito -> Extrair Tudo...).',
    '2. No Chrome ou Edge, abra: edge://extensions  ou  chrome://extensions',
    '3. Ative a chave "Modo do desenvolvedor" (canto superior direito ou menu esquerdo).',
    '4. Clique em "Carregar sem compactacao" e selecione esta pasta extraida (onde esta o manifest.json).',
    '5. Mantenha uma aba logada em https://srointranet.correios.com.br/rastreamento e recarregue (F5) o sistema.',
    '',
  ].join('\r\n');

  const zipEntries = [
    ...distFiles.map((fileName) => ({
      name: fileName,
      data: fs.readFileSync(path.join(OUT_DIR, fileName)),
    })),
    { name: 'LEIA-ME.txt', data: readmeTxt },
  ];

  fs.writeFileSync(PUBLIC_ZIP_PATH, createZipBuffer(zipEntries));

  console.log(`Extensão piloto compilada com sucesso em: ${OUT_DIR}`);
  console.log(`Pacote pronto para download gerado em: ${PUBLIC_ZIP_PATH}`);
}

buildExtension().catch((err) => {
  console.error('Erro ao compilar extensão piloto:', err);
  process.exit(1);
});
