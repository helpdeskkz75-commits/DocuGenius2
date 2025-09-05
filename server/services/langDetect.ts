// Simple heuristic Kazakh/Russian detection
export function detectLang(text: string | undefined | null): 'kz' | 'ru' {
  if (!text) return 'ru';
  const t = text.trim().toLowerCase();
  const kzHints = /(иә|жоқ|сәлем|рахмет|қалай|түбіртек|бағасы|мерзім|мердігер|жеткізу)/i;
  const kzLetters = /[ңқәүгұһі]/i;
  if (kzHints.test(t) || kzLetters.test(t)) return 'kz';
  return 'ru';
}
