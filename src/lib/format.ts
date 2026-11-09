const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 'YYYY-MM-DD'를 로컬 날짜로 (UTC로 해석되어 하루 밀리는 것 방지) */
export function parseDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toIsoDate(date: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** 11/8(토) */
export function formatShortDate(iso: string) {
  const d = parseDate(iso);
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

/** 2026.11.08 */
export function formatDotDate(iso: string) {
  return iso.replace(/-/g, '.');
}

/** 오늘이 토요일이면 오늘, 아니면 다가오는 토요일 */
export function upcomingSaturday(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  return toIsoDate(d);
}

/** 받침이 있으면 '과', 없으면 '와' (하늘이와, 민준과) */
export function withJosaWa(word: string) {
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return `${word}와`;
  return (last - 0xac00) % 28 === 0 ? `${word}와` : `${word}과`;
}

/**
 * 구 + 동네 이름
 * "경기도 용인시 처인구 원삼면 농촌파크로 80" → "처인구 원삼면"
 * "경기도 용인시 기흥구 상갈로 6 (상갈동)" → "기흥구 상갈동"
 */
export function shortAddress(address: string) {
  const parts = address.replace(/[()]/g, ' ').split(/\s+/).filter(Boolean);
  const gu = parts.find((p) => p.endsWith('구'));
  const town = parts.find((p) => /[읍면동]$/.test(p) && p !== gu);
  return [gu, town].filter(Boolean).join(' ') || parts.slice(0, 2).join(' ');
}

export const ENVIRONMENT_LABEL: Record<string, string> = {
  INDOOR: '실내',
  OUTDOOR: '야외',
  MIXED: '실내·야외',
};
