import { writeFileSync } from 'fs'
import { deflateSync } from 'zlib'

function crc32(data) {
  const table = []
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  let crc = 0xffffffff
  for (const byte of data) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const t = Buffer.from(type)
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data)
  const len = Buffer.allocUnsafe(4)
  len.writeUInt32BE(d.length)
  const crcBuf = Buffer.allocUnsafe(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, d])))
  return Buffer.concat([len, t, d, crcBuf])
}

// SVG path: M300 80L180 280h100L220 432 380 200H270L300 80z
// Bolt polygon vertices (in 512×512 space)
const BOLT = [[300,80],[180,280],[280,280],[220,432],[380,200],[270,200]]

function pointInPolygon(px, py, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}

function inRoundedRect(x, y, w, h, r) {
  if (x < 0 || x >= w || y < 0 || y >= h) return false
  const inMiddleCol = x >= r && x < w - r
  const inMiddleRow = y >= r && y < h - r
  if (inMiddleCol || inMiddleRow) return true
  const cx = x < r ? r : w - r - 1
  const cy = y < r ? r : h - r - 1
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

function generatePNG(size) {
  const sig = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])

  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  const radius = Math.round(100 / 512 * size)
  const rows = []

  for (let y = 0; y < size; y++) {
    const row = Buffer.allocUnsafe(1 + size * 4)
    row[0] = 0 // filter: None
    for (let x = 0; x < size; x++) {
      const i = 1 + x * 4
      const inRect = inRoundedRect(x, y, size, size, radius)
      if (!inRect) {
        row[i] = 0; row[i+1] = 0; row[i+2] = 0; row[i+3] = 0
      } else {
        const sx = (x + 0.5) / size * 512
        const sy = (y + 0.5) / size * 512
        const onBolt = pointInPolygon(sx, sy, BOLT)
        if (onBolt) {
          row[i] = 255; row[i+1] = 255; row[i+2] = 255; row[i+3] = 255
        } else {
          row[i] = 0x6b; row[i+1] = 0x38; row[i+2] = 0xd4; row[i+3] = 255
        }
      }
    }
    rows.push(row)
  }

  const compressed = deflateSync(Buffer.concat(rows))

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

writeFileSync('public/icon-192.png', generatePNG(192))
writeFileSync('public/icon-512.png', generatePNG(512))
console.log('Generated public/icon-192.png and public/icon-512.png')
