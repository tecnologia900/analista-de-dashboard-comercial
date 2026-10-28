import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LADO = 256;
const pixels = Buffer.alloc(LADO * LADO * 4);

function pintar(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= LADO || y >= LADO) return;
  const i = (y * LADO + x) * 4;
  pixels[i] = r;
  pixels[i + 1] = g;
  pixels[i + 2] = b;
  pixels[i + 3] = a;
}

function dentro(x, y) {
  const margem = 18;
  const raio = 48;
  const x0 = margem;
  const y0 = margem;
  const x1 = LADO - margem;
  const y1 = LADO - margem;
  if (x < x0 || y < y0 || x >= x1 || y >= y1) return false;
  const cantos = [
    [x0 + raio, y0 + raio],
    [x1 - raio, y0 + raio],
    [x0 + raio, y1 - raio],
    [x1 - raio, y1 - raio],
  ];
  const noMiolo = x >= x0 + raio && x < x1 - raio || y >= y0 + raio && y < y1 - raio;
  if (x >= x0 + raio && x < x1 - raio) return true;
  if (y >= y0 + raio && y < y1 - raio) return true;
  return cantos.some(([cx, cy]) => (x - cx) ** 2 + (y - cy) ** 2 <= raio * raio) || noMiolo;
}

for (let y = 0; y < LADO; y++) {
  for (let x = 0; x < LADO; x++) {
    if (!dentro(x, y)) continue;
    pintar(x, y, 16, 28, 46);
  }
}

function barra(x, y, largura, altura, cor) {
  for (let dy = 0; dy < altura; dy++) {
    for (let dx = 0; dx < largura; dx++) pintar(x + dx, y + dy, cor[0], cor[1], cor[2]);
  }
}

barra(78, 128, 28, 72, [47, 175, 144]);
barra(114, 88, 28, 112, [231, 236, 232]);
barra(150, 52, 28, 148, [196, 161, 90]);

function chunk(tipo, dados) {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const nome = Buffer.from(tipo);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([nome, dados])) >>> 0);
  return Buffer.concat([tamanho, nome, dados, crc]);
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c;
}

const bruto = Buffer.alloc(LADO * (1 + LADO * 4));
for (let y = 0; y < LADO; y++) {
  const inicio = y * (1 + LADO * 4);
  bruto[inicio] = 0;
  pixels.copy(bruto, inicio + 1, y * LADO * 4, (y + 1) * LADO * 4);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(LADO, 0);
ihdr.writeUInt32BE(LADO, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(bruto)),
  chunk('IEND', Buffer.alloc(0)),
]);

const destino = path.join(path.dirname(fileURLToPath(import.meta.url)), 'icone.png');
writeFileSync(destino, png);
