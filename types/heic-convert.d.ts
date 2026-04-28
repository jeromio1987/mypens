declare module 'heic-convert' {
  interface HeicConvertOptions {
    buffer: ArrayBuffer | Buffer | Uint8Array
    format: 'JPEG' | 'PNG'
    quality?: number
  }
  function heicConvert(opts: HeicConvertOptions): Promise<ArrayBuffer>
  export default heicConvert
}
