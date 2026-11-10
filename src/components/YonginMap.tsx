import { useEffect, useRef } from 'react';
import mapImage from '../assets/map-yongin.svg';
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
 * Figma "탐험 지도"의 용인 그림(402 x 704) 위에 위경도를 그대로 비례해 찍는다.
 * 그림은 실제 행정 경계가 아니라서, 공개 장소 범위(위도 37.09~37.36, 경도 127.04~127.41)가
 * 그림 속 용인 모양 안에 들어오도록 맞춘 값이다.
 */
const MAP_W = 402;
const MAP_H = 704;
const BOUNDS = { west: 127.03, east: 127.43, north: 37.37, south: 37.085 };
const AREA = { left: 20, right: 382, top: 85, bottom: 595 };

export function projectToMap(latitude: number, longitude: number) {
  const x = AREA.left + ((longitude - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * (AREA.right - AREA.left);
  const y = AREA.top + ((BOUNDS.north - latitude) / (BOUNDS.north - BOUNDS.south)) * (AREA.bottom - AREA.top);
  return {
    x: Math.min(MAP_W - 12, Math.max(12, x)),
    y: Math.min(MAP_H - 12, Math.max(12, y)),
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
  /** 아래쪽을 가리는 카드 높이. 그만큼 더 끌어 올릴 수 있게 하고, 가운데 계산에서 뺀다 */
  bottomInset?: number;
  className?: string;
};

/** 손가락으로 끌어 움직이는 용인 탐험 지도. 다녀온 곳(보라 ✓) · 방문 예정(주황) · 아직 안 간 곳(흰 점) */
export default function YonginMap({ markers, selectedId, onSelect, focusId, legend, bottomInset = 0, className }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const target = focusId ?? selectedId;
  const focus = markers.find((m) => m.id === target);
  const fx = focus?.latitude;
  const fy = focus?.longitude;

  const scrolledOnce = useRef(false);

  useEffect(() => {
    const el = viewport.current;
    if (!el || fx == null || fy == null) return;
    const { x, y } = projectToMap(fx, fy);
    // 아래 장소 카드에 가리지 않는 영역의 가운데 쯤(라벨 자리 포함)에 둔다. 처음엔 바로, 이후엔 부드럽게
    el.scrollTo({
      left: x - el.clientWidth / 2,
      top: y - (el.clientHeight - bottomInset) / 2 - 10,
      behavior: scrolledOnce.current ? 'smooth' : 'auto',
    });
    scrolledOnce.current = true;
  }, [fx, fy, bottomInset]);

  // 겹칠 때 중요한 마커가 위로: 아직 안 간 곳 → 다녀온 곳 → 방문 예정 → 선택
  const order: Record<MarkerKind, number> = { todo: 0, done: 1, planned: 2 };
  const sorted = [...markers].sort((a, b) => order[a.kind] - order[b.kind]);

  return (
    <div className={`${styles.wrap} ${className ?? ''}`}>
      <div ref={viewport} className={styles.viewport} onClick={() => onSelect?.(null)}>
        <div className={styles.canvas} style={{ width: MAP_W, height: MAP_H + bottomInset, backgroundImage: `url(${mapImage})` }}>
          {sorted.map((m) => {
            const { x, y } = projectToMap(m.latitude, m.longitude);
            const selected = m.id === selectedId;
            const showLabel = selected || m.kind !== 'todo';
            return (
              <button
                key={m.id}
                type="button"
                className={`${styles.marker} ${styles[m.kind]} ${selected ? styles.selected : ''}`}
                style={{ left: x, top: y, zIndex: selected ? 5 : order[m.kind] + 1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect?.(m.id);
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
        </div>
      </div>

      {legend && (
        <ul className={styles.legend} aria-label="범례">
          <li className={styles.legendDone}>● 다녀온 곳</li>
          <li className={styles.legendPlanned}>● 방문 예정</li>
          <li className={styles.legendTodo}>○ 아직 안 간 곳</li>
        </ul>
      )}
    </div>
  );
}
