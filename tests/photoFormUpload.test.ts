import { describe, expect, it } from 'vitest'
import { sniffImageExt, readPhotoFormFile } from '@/lib/photoFormUpload'

function jpegBytes(): Buffer {
  // minimal JPEG SOI + EOI
  return Buffer.from([0xff, 0xd8, 0xff, 0xd9, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
}

describe('photoFormUpload', () => {
  it('sniffs jpeg', () => {
    expect(sniffImageExt(jpegBytes())).toBe('.jpg')
  })

  it('accepts empty declared MIME when bytes are jpeg', async () => {
    const file = new File([jpegBytes()], 'scan.jpg', { type: '' })
    const r = await readPhotoFormFile(file)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.ext).toBe('.jpg')
  })

  it('accepts application/octet-stream when bytes are jpeg', async () => {
    const file = new File([jpegBytes()], 'scan.bin', { type: 'application/octet-stream' })
    const r = await readPhotoFormFile(file)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.ext).toBe('.jpg')
  })

  it('rejects missing file', async () => {
    const r = await readPhotoFormFile(null)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(400)
  })
})
