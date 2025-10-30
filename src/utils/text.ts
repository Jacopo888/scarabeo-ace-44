export function normalizeNewlines(input: string): string {
  // Remove BOM if present and unify CRLF/CR/LF to LF
  const s = input.startsWith('\uFEFF') ? input.slice(1) : input
  return s.replace(/\r\n|\r|\n/g, '\n')
}
