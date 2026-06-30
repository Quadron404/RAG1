export function parseClass(input) {
  const s = input.trim().toLowerCase().replace(/class\s*/g, '');
  const ordinal = s.match(/^(\d{1,2})(?:st|nd|rd|th)?$/);
  if (ordinal) {
    const n = parseInt(ordinal[1], 10);
    if (n >= 1 && n <= 12) return n;
  }
  const embedded = s.match(/(\d{1,2})(?:st|nd|rd|th)?/);
  if (embedded) {
    const n = parseInt(embedded[1], 10);
    if (n >= 1 && n <= 12) return n;
  }
  return null;
}

export function parseSection(input) {
  const s = input.trim().toUpperCase();
  const match = s.match(/(?:section\s*)?([A-Z])\b/) || s.match(/^([A-Z])$/);
  if (match) return match[1];
  return null;
}
