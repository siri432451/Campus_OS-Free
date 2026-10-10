declare module 'pdf-parse' {
  function pdf(buffer: Buffer | Uint8Array): Promise<{
    numpages: number
    numrender: number
    info: Record<string, unknown>
    metadata: unknown
    text: string
    version: string
  }>
  export default pdf
}
