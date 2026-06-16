// Regenerates the branded favicon/app-icon set from the "CO" gradient
// mark (matches the nav logo + app/icon.svg). Run: node scripts/gen-icons.mjs
// Outputs: app/favicon.ico, app/apple-icon.png, public/icon-192.png,
// public/icon-512.png. (app/icon.svg stays for crisp modern browser tabs.)
import sharp from 'sharp'
import { writeFileSync, mkdirSync } from 'node:fs'

// Master mark — violet→blue gradient rounded square + bold white "CO",
// the same brand mark used across the nav + CTAs.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#7C3AED"/><stop offset="1" stop-color="#2563EB"/></linearGradient></defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <text x="256" y="356" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="280" font-weight="bold" fill="#ffffff" letter-spacing="-10">CO</text>
</svg>`

const master = await sharp(Buffer.from(svg)).resize(512, 512).png().toBuffer()
const at = (size) => sharp(master).resize(size, size).png().toBuffer()

mkdirSync('public', { recursive: true })
writeFileSync('app/apple-icon.png', await at(180))
writeFileSync('public/icon-192.png', await at(192))
writeFileSync('public/icon-512.png', master)

// favicon.ico (16/32/48, PNG-encoded — supported by all modern browsers
// + link unfurlers). sharp can't emit .ico, so wrap the PNGs ourselves.
const sizes = [16, 32, 48]
const pngs = await Promise.all(sizes.map(at))
const count = sizes.length
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(count, 4)
const dir = Buffer.alloc(16 * count)
let offset = 6 + 16 * count
const blobs = []
sizes.forEach((s, i) => {
  const b = 16 * i, data = pngs[i]
  dir.writeUInt8(s >= 256 ? 0 : s, b)       // width
  dir.writeUInt8(s >= 256 ? 0 : s, b + 1)   // height
  dir.writeUInt8(0, b + 2); dir.writeUInt8(0, b + 3)
  dir.writeUInt16LE(1, b + 4); dir.writeUInt16LE(32, b + 6)
  dir.writeUInt32LE(data.length, b + 8); dir.writeUInt32LE(offset, b + 12)
  offset += data.length; blobs.push(data)
})
writeFileSync('app/favicon.ico', Buffer.concat([header, dir, ...blobs]))
console.log('Wrote app/favicon.ico, app/apple-icon.png, public/icon-192.png, public/icon-512.png')
