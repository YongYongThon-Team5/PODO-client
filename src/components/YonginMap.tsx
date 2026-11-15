import { useEffect, useRef, useState } from 'react';
import mapImage from '../assets/map-yongin-real.svg';
import medalIcon from '../assets/icon-medal.svg';
import pinIcon from '../assets/icon-pin-orange.svg';
import styles from './YonginMap.module.css';

export type MarkerKind = 'done' | 'planned' | 'todo';

export type MapMarker = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  kind: MarkerKind;
};

/*
 * 실제 용인 경계(통계청 2013 시군구 경계, 수지·기흥·처인구)를 Figma 지도 그림 느낌으로 그린 그림(402 x 560) 위에
 * 같은 투영으로 위경도를 찍는다. 그림은 아래 값으로 미리 만든 SVG라, 값을 바꾸면 그림도 다시 만들어야 한다.
 * 투영: 경도는 cos(위도)를 곱해 실제 가로세로 비율을 맞춘다.
 */
const MAP_W = 402;
const MAP_H = 560;
/** 그림 속 용인의 왼쪽·위 여백 */
const PAD_X = 18;
const PAD_Y = 120;
const BOUNDS = { west: 127.015, east: 127.438, north: 37.374, south: 37.079 };
const LON_K = Math.cos((((BOUNDS.north + BOUNDS.south) / 2) * Math.PI) / 180);
const SCALE = (MAP_W - PAD_X * 2) / ((BOUNDS.east - BOUNDS.west) * LON_K);

/** 확대 단계. 1배(처음)는 용인 전체가 화면에 들어온다 */
const ZOOMS = [1, 1.6, 2.4, 3.2];
const DEFAULT_ZOOM = 1;
/** 이 거리(px) 안에 다른 장소가 있으면 눌렀을 때 목록으로 고른다 */
const NEAR_PX = 18;

/** 확대 1배 기준 그림 위 좌표 */
export function projectToMap(latitude: number, longitude: number) {
  return {
    x: PAD_X + (longitude - BOUNDS.west) * LON_K * SCALE,
    y: PAD_Y + (BOUNDS.north - latitude) * SCALE,
  };
}

type Props = {
  markers: MapMarker[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** 이 장소가 가운데 오도록 스크롤 (없으면 선택한 장소) */
  focusId?: string | null;
  /** 범례 (다녀온 곳 · 방문 예정 · 아직 안 간 곳) */
  legend?: boolean;
  /** 확대·축소 버튼 */
  zoomControls?: boolean;
  /** 처음 확대 배율 */
  initialZoom?: number;
  /** 아래쪽을 가리는 카드 높이. 그만큼 더 끌어 올릴 수 있게 하고, 가운데 계산에서 뺀다 */
  bottomInset?: number;
  className?: string;
};

/** 손가락으로 끌어 움직이는 용인 탐험 지도. 다녀온 곳(보라 ✓) · 방문 예정(주황) · 아직 안 간 곳(흰 점) */
export default function YonginMap({
  markers,
  selectedId,
  onSelect,
  focusId,
  legend,
  zoomControls,
  initialZoom = DEFAULT_ZOOM,
  bottomInset = 0,
  className,
}: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(initialZoom);
  /** 겹친 장소 목록: 누른 자리와 그 근처 장소들 */
  const [near, setNear] = useState<{ x: number; y: number; ids: string[] } | null>(null);

  const target = focusId ?? selectedId;
  const focus = markers.find((m) => m.id === target);
  const fLat = focus?.latitude;
  const fLng = focus?.longitude;

  const scrolledOnce = useRef(false);

  useEffect(() => {
    const el = viewport.current;
    if (!el || fLat == null || fLng == null) return;
    const { x, y } = projectToMap(fLat, fLng);
    // 아래 장소 카드에 가리지 않는 영역의 가운데 쯤(라벨 자리 포함)에 둔다. 처음엔 바로, 이후엔 부드럽게
    el.scrollTo({
      left: x * zoom - el.clientWidth / 2,
      top: y * zoom - (el.clientHeight - bottomInset) / 2 - 10,
      behavior: scrolledOnce.current ? 'smooth' : 'auto',
    });
    scrolledOnce.current = true;
    // 확대가 바뀔 때는 아래 changeZoom이 가운데를 지킨다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fLat, fLng, bottomInset]);

  /** 화면 가운데를 지키면서 확대 단계를 바꾼다 */
  const changeZoom = (step: number) => {
    const el = viewport.current;
    const i = ZOOMS.indexOf(zoom);
    const next = ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, (i < 0 ? 0 : i) + step))];
    if (!el || next === zoom) return;
    const cx = (el.scrollLeft + el.clientWidth / 2) / zoom;
    const cy = (el.scrollTop + el.clientHeight / 2) / zoom;
    setNear(null);
    setZoom(next);
    requestAnimationFrame(() =>
      el.scrollTo({ left: cx * next - el.clientWidth / 2, top: cy * next - el.clientHeight / 2 }),
    );
  };

  const pick = (m: MapMarker) => {
    if (!onSelect) return;
    const p = projectToMap(m.latitude, m.longitude);
    const ids = markers
      .filter((o) => {
        const q = projectToMap(o.latitude, o.longitude);
        return Math.hypot((q.x - p.x) * zoom, (q.y - p.y) * zoom) <= NEAR_PX;
      })
      .map((o) => o.id);
    if (ids.length > 1) {
      setNear({ x: p.x * zoom, y: p.y * zoom, ids });
      return;
    }
    setNear(null);
    onSelect(m.id);
  };

  // 겹칠 때 중요한 마커가 위로: 아직 안 간 곳 → 다녀온 곳 → 방문 예정 → 선택
  const order: Record<MarkerKind, number> = { todo: 0, done: 1, planned: 2 };
  const sorted = [...markers].sort((a, b) => order[a.kind] - order[b.kind]);
  const byId = new Map(markers.map((m) => [m.id, m]));

  return (
    <div className={`${styles.wrap} ${className ?? ''}`}>
      <div
        ref={viewport}
        className={styles.viewport}
        onClick={() => {
          setNear(null);
          onSelect?.(null);
        }}
      >
        <div
          className={styles.canvas}
          style={{
            width: MAP_W * zoom,
            height: MAP_H * zoom + bottomInset,
            backgroundImage: `url(${mapImage})`,
            backgroundSize: `${MAP_W * zoom}px ${MAP_H * zoom}px`,
          }}
        >
          {sorted.map((m) => {
            const { x, y } = projectToMap(m.latitude, m.longitude);
            const selected = m.id === selectedId;
            const showLabel = selected || m.kind !== 'todo';
            return (
              <button
                key={m.id}
                type="button"
                className={`${styles.marker} ${styles[m.kind]} ${selected ? styles.selected : ''}`}
                style={{ left: x * zoom, top: y * zoom, zIndex: selected ? 5 : order[m.kind] + 1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  pick(m);
                }}
                aria-label={`${m.name} (${m.kind === 'done' ? '다녀온 곳' : m.kind === 'planned' ? '방문 예정' : '아직 안 간 곳'})`}
                aria-pressed={selected}
                tabIndex={onSelect ? 0 : -1}
              >
                <span className={styles.dot}>{m.kind === 'done' ? '✓' : ''}</span>
                {showLabel && (
                  <span className={styles.tag}>
                    {m.kind === 'done' ? (
                      <img src={medalIcon} width={14} height={14} alt="" />
                    ) : m.kind === 'planned' ? (
                      <img src={pinIcon} width={12} height={12} alt="" />
                    ) : null}
                    {m.name}
                  </span>
                )}
              </button>
            );
          })}

          {near && (
            <div
              className={styles.near}
              style={{ left: near.x, top: near.y }}
              role="dialog"
              aria-label="이 근처 장소"
              onClick={(e) => e.stopPropagation()}
            >
              <p>이 근처 장소 {near.ids.length}곳</p>
              <ul>
                {near.ids.map((id) => {
                  const m = byId.get(id);
                  if (!m) return null;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className={styles[`near_${m.kind}`]}
                        onClick={() => {
                          setNear(null);
                          onSelect?.(id);
                        }}
                      >
                        {m.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {legend && (
        <ul className={styles.legend} aria-label="범례">
          <li className={styles.legendDone}>● 다녀온 곳</li>
          <li className={styles.legendPlanned}>● 방문 예정</li>
          <li className={styles.legendTodo}>○ 아직 안 간 곳</li>
        </ul>
      )}

      {zoomControls && (
        <div className={styles.zoom}>
          <button type="button" aria-label="지도 확대" onClick={() => changeZoom(1)} disabled={zoom === ZOOMS[ZOOMS.length - 1]}>
            +
          </button>
          <button type="button" aria-label="지도 축소" onClick={() => changeZoom(-1)} disabled={zoom === ZOOMS[0]}>
            −
          </button>
        </div>
      )}
    </div>
  );
}
