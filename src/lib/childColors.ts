/**
 * 아이 색은 Figma 색이 기준이다 (Figma "회원가입" 좋아하는 색깔: 파스텔 4가지).
 * 서버(profile-options)는 진한 색 7가지를 주므로, 서버 색 코드에 Figma 색을 짝지어 화면에는 Figma 색을 그린다.
 * 서버에 저장하는 값은 그대로 색 코드(colorCode)다.
 */
export const FIGMA_CHILD_COLORS = [
  { code: 'RED', hex: '#f6a99f' },
  { code: 'BLUE', hex: '#9feaf6' },
  { code: 'ORANGE', hex: '#f6c99f' },
  { code: 'GREEN', hex: '#bff69f' },
] as const;

const BY_CODE = new Map<string, string>(FIGMA_CHILD_COLORS.map((c) => [c.code, c.hex]));

/** 화면에 그릴 아이 색. Figma에 없는 색 코드(예전에 고른 노랑·남색·보라)는 서버 색을 그대로 쓴다 */
export function childColorHex(code: string | null | undefined, serverHex?: string | null) {
  return (code && BY_CODE.get(code)) ?? serverHex ?? FIGMA_CHILD_COLORS[1].hex;
}

type ServerColor = { code?: string; label?: string; hex?: string; active?: boolean };

/**
 * 회원가입 색 고르기 목록: Figma 순서의 4가지 중 서버에서 쓸 수 있는 색만.
 * 서버 목록에 4가지가 하나도 없으면(서버 색 코드가 바뀐 경우) 서버 목록을 그대로 쓴다.
 */
export function figmaColorOptions(server: ServerColor[]) {
  const byCode = new Map(server.filter((c) => c.code).map((c) => [c.code!, c]));
  const list = FIGMA_CHILD_COLORS.filter((c) => byCode.has(c.code)).map((c) => ({
    ...byCode.get(c.code)!,
    hex: c.hex,
  }));
  return list.length > 0 ? list : server;
}
