/** Deep link that opens captain select with this seed prefilled. */
export function seedLink(seedText: string): string {
  const base = typeof location !== 'undefined' ? location.origin + location.pathname : 'https://hokyz.vercel.app/';
  return `${base}?seed=${encodeURIComponent(seedText)}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
