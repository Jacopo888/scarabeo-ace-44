export function normalizeNewlines(input: string): string {
  // Remove BOM if present and unify CRLF/CR/LF and literal "\n" to LF
  const s = input.startsWith('\uFEFF') ? input.slice(1) : input
  // Also convert literal backslash-n sequences to real newlines
  return s.replace(/\\n|\r\n|\r|\n/g, '\n')
}
