/*
 * 이 기기에만 남기는 선택값 (서버에 보내지 않음).
 * 저장소가 막힌 환경(사생활 보호 모드 등)에서도 앱이 멈추지 않게 실패는 무시한다.
 */
const KEY = 'podo.prefs';

type Prefs = {
  /** 위치 권한 화면에서 고른 지역 (recommendation-options의 district code) */
  districtCode?: string | null;
  /** 위치 권한 허용 여부 */
  locationAllowed?: boolean;
  /** 마이페이지에서 "전환"으로 고른 아이 */
  childProfileId?: string | null;
};

export function readPrefs(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Prefs;
  } catch {
    return {};
  }
}

export function writePrefs(patch: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readPrefs(), ...patch }));
  } catch {
    // 저장 못 해도 화면 흐름은 그대로 진행
  }
}
