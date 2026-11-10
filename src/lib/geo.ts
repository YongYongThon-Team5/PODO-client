import { useEffect, useState } from 'react';
import { readPrefs, writePrefs } from './prefs';

/** 방문 확인 반경 (Figma "현재 위치가 장소 반경 500m 안이에요") */
export const ARRIVAL_RADIUS_M = 500;

/** 두 좌표 사이 거리(m), 하버사인 */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatDistance(m: number) {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
}

export type ArrivalCheck =
  | { status: 'checking' }
  | { status: 'unsupported' | 'denied' | 'failed' }
  | { status: 'near' | 'far'; distance: number };

/**
 * 현재 위치가 장소 반경 안인지 확인한다. 서버는 위치 인증을 하지 않으므로 안내용이고, 흐름을 막지 않는다.
 * 좌표는 저장하지 않는다. retry를 바꾸면 다시 확인한다.
 */
export function useArrivalCheck(place: { latitude: number; longitude: number } | null | undefined, retry = 0) {
  const [check, setCheck] = useState<ArrivalCheck>({ status: 'checking' });
  const lat = place?.latitude;
  const lng = place?.longitude;

  useEffect(() => {
    if (lat == null || lng == null) return;
    if (!('geolocation' in navigator)) {
      setCheck({ status: 'unsupported' });
      return;
    }
    let alive = true;
    setCheck({ status: 'checking' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!alive) return;
        writePrefs({ locationAllowed: true });
        const distance = distanceMeters(pos.coords.latitude, pos.coords.longitude, lat, lng);
        setCheck({ status: distance <= ARRIVAL_RADIUS_M ? 'near' : 'far', distance });
      },
      (err) => {
        if (!alive) return;
        if (err.code === err.PERMISSION_DENIED) writePrefs({ locationAllowed: false });
        setCheck({ status: err.code === err.PERMISSION_DENIED ? 'denied' : 'failed' });
      },
      { timeout: 10_000, maximumAge: 60_000, enableHighAccuracy: true },
    );
    return () => {
      alive = false;
    };
  }, [lat, lng, retry]);

  return check;
}

/** 위치 확인 결과 → 화면 문구 */
export function arrivalMessage(check: ArrivalCheck) {
  switch (check.status) {
    case 'checking':
      return '현재 위치를 확인하는 중이에요';
    case 'near':
      return `현재 위치가 장소 반경 ${ARRIVAL_RADIUS_M}m 안이에요`;
    case 'far':
      return `장소에서 ${formatDistance(check.distance)} 떨어져 있어요`;
    case 'denied':
      return readPrefs().locationAllowed === false
        ? '위치 권한이 꺼져 있어 확인하지 못했어요'
        : '위치 권한을 허용하면 자동으로 확인해요';
    default:
      return '현재 위치를 확인하지 못했어요';
  }
}
