// Formatters shared by the pane and the band, pure.

export function elapsed(ms: number): string {
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m${String(secs % 60).padStart(2, '0')}s`

  return `${Math.floor(secs / 3600)}h${Math.floor((secs % 3600) / 60)}m`
}

/** `claude-opus-5-5` → `opus-5.5`, `claude-haiku-4-5-20251001` → `haiku-4.5`. */
export function shortModel(model: string): string {
  return model
    .replace(/^claude-/, '')
    .replace(/-\d{8}$/, '')
    .replace(/-(\d+)-(\d+)$/, '-$1.$2')
}

/** Abbreviated token count: `0k`, `54k`, `1.9M`. */
export function tokens(n: number): string {
  const thousands = Math.round(n / 1000)

  return thousands < 1000 ? `${thousands}k` : `${(n / 1_000_000).toFixed(1)}M`
}

export const usd = (cents: number): string => `$${(cents / 100).toFixed(2)}`
