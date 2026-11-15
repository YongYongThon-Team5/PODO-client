import { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Gnb from '../components/Gnb';
import LoadError from '../components/LoadError';
import LoadingGate from '../components/LoadingGate';
import PageHeader from '../components/PageHeader';
import YonginMap, { type MapMarker } from '../components/YonginMap';
import type { LoadingType } from '../components/LoadingScreen';
import {
  useActiveVisit,
  useAllPlaces,
  useCompletedPlaces,
  useCompletedVisitOf,
  usePlace,
  type PlaceSummary,
} from '../api/queries';
import { shortAddress } from '../lib/format';
import { visitPath } from '../lib/quiz';
import { toPlaceUrl } from './PlaceDetail';
import styles from './MapPage.module.css';

export type MapPageState = { loading?: LoadingType };

/** 아래 장소 카드 높이 (Figma 495~772 중 GNB 위 부분) — 고른 장소가 카드에 가리지 않게 지도를 그만큼 올린다 */
const SHEET_HEIGHT = 300;

/**
 * Figma "지도" / "지도 탐색"(장소를 누르면 아래 카드).
 * /map?place=ID 로 들어오면 그 장소를 골라 둔다 (장소 상세 "지도 탐색", 탐험 완료 "탐방 지도 보기").
 */
export default function MapPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const places = useAllPlaces();
  const completed = useCompletedPlaces();
  const active = useActiveVisit();
  const selectedId = params.get('place');

  const markers = useMemo(() => {
    const doneIds = new Set(completed.data?.items.map((c) => c.placeId));
    const plannedId = active.data?.placeId;
    const list: MapMarker[] = (places.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      latitude: p.latitude,
      longitude: p.longitude,
      kind: p.id === plannedId ? 'planned' : doneIds.has(p.id) ? 'done' : 'todo',
    }));
    // 지금은 비공개가 된 장소도 다녀온 기록은 지도에 남긴다 (좌표가 지워졌으면 생략)
    for (const c of completed.data?.items ?? []) {
      if (c.latitude == null || c.longitude == null || list.some((m) => m.id === c.placeId)) continue;
      list.push({ id: c.placeId, name: c.name, latitude: c.latitude, longitude: c.longitude, kind: 'done' });
    }
    return list;
  }, [places.data, completed.data, active.data]);

  const select = (id: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('place', id);
        else next.delete('place');
        return next;
      },
      { replace: true },
    );

  const selected = markers.find((m) => m.id === selectedId);
  // 처음에는 방문 예정 → 가장 최근에 다녀온 곳 순으로 화면 가운데 둔다
  const focusId = selectedId ?? active.data?.placeId ?? completed.data?.items[0]?.placeId ?? null;
  const loading = (location.state as MapPageState | null)?.loading ?? 'map';

  return (
    <LoadingGate type={loading} pending={places.isPending}>
      <main className="screen">
        <PageHeader title="탐험 지도" onBack={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/home'))} />
        <div className={styles.body}>
          {places.isError ? (
            <div className={styles.error}>
              <LoadError message={places.error.message} onRetry={() => places.refetch()} />
            </div>
          ) : (
            <YonginMap
              className={styles.map}
              markers={markers}
              selectedId={selectedId}
              focusId={focusId}
              onSelect={select}
              bottomInset={selected ? SHEET_HEIGHT : 0}
              legend
              zoomControls
            />
          )}
          {selected && (
            <PlaceSheet
              key={selected.id}
              summary={places.data?.find((p) => p.id === selected.id)}
              placeId={selected.id}
              name={selected.name}
              kind={selected.kind}
              onClose={() => select(null)}
            />
          )}
        </div>
        <Gnb />
      </main>
    </LoadingGate>
  );
}

type SheetProps = {
  placeId: string;
  name: string;
  summary?: PlaceSummary;
  kind: MapMarker['kind'];
  onClose: () => void;
};

/** Figma "지도 장소 팝업": 사진 · 이름 · 주소 · 태그 → 운영 정보 → 네이버 지도 길찾기 / 기록 다시보기 */
function PlaceSheet({ placeId, name, summary, kind, onClose }: SheetProps) {
  const navigate = useNavigate();
  const detail = usePlace(placeId);
  const active = useActiveVisit();
  const lastVisit = useCompletedVisitOf(kind === 'done' ? placeId : null);
  const p = detail.data;

  const photo = p?.images[0]?.url ?? p?.thumbnailUrl ?? summary?.thumbnailUrl;
  const address = p?.address ?? summary?.address;
  const tags = (p?.mainActivities ?? summary?.mainActivities ?? []).slice(0, 2);
  const directions =
    p?.mapLinks.directionsUrl ?? p?.mapLinks.placeUrl ?? `https://map.naver.com/p/search/${encodeURIComponent(name)}`;

  const isActive = active.data?.placeId === placeId;
  // Figma 메모: 기록 다시보기 → 미션 (중간에 나갔다가 다시 들어오는 곳)
  const record = () => {
    if (isActive) navigate('/mission');
    else if (lastVisit.data) navigate(visitPath.complete(lastVisit.data.id));
    else navigate(toPlaceUrl(placeId, { source: 'MAP' }));
  };
  const recordLabel = isActive
    ? active.data?.status === 'PLANNED'
      ? '방문 미션 보기'
      : '기록 다시보기'
    : kind === 'done'
      ? '기록 다시보기'
      : '장소 자세히 보기';

  return (
    <section className={styles.sheet} aria-label={`${name} 정보`}>
      <button type="button" className={styles.handle} onClick={onClose} aria-label="장소 카드 닫기" />
      <div className={styles.head}>
        {photo ? <img className={styles.thumb} src={photo} alt="" /> : <span className={styles.thumb} aria-hidden />}
        <div className={styles.headText}>
          <h2 className={styles.name}>{name}</h2>
          {address && <p className={styles.address}>{shortAddress(address)}</p>}
          {tags.length > 0 && (
            <ul className={styles.tags}>
              {tags.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={styles.hours}>
        <strong>{p?.openingHours ? `운영 ${p.openingHours}` : detail.isPending ? '운영 정보를 확인하는 중…' : '운영 정보를 준비 중이에요'}</strong>
        {(p?.feeInfo || p?.amenities?.length) && (
          <span>{[p?.amenities?.join(' · '), p?.feeInfo].filter(Boolean).join(' · ')}</span>
        )}
      </div>

      <div className={styles.buttons}>
        <a className={styles.naver} href={directions} target="_blank" rel="noreferrer">
          네이버 지도 길찾기
        </a>
        <button
          type="button"
          className={styles.record}
          onClick={record}
        >
          {recordLabel}
        </button>
      </div>
    </section>
  );
}
