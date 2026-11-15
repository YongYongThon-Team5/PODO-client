import { useEffect, useRef, useState } from 'react';

type Options = {
  /**
   * 지금까지 확실히 끝난 단계만큼의 최소 진행도(0~100).
   * 예: 두 요청 중 하나가 끝나면 50. 바는 여기서부터 이어서 차오른다.
   */
  floor?: number;
  /** 보통 이 정도 걸린다고 보는 시간(ms). 이 시간쯤 남은 구간의 80%가 찬다 */
  expectedMs?: number;
};

/** 끝나기 전에는 여기까지만 찬다 (100은 실제로 끝났을 때만) */
const CAP = 97;
/** 예상 시간까지 남은 구간 중 이만큼 채운다 */
const EXPECTED_SHARE = 0.8;
/** 예상 시간이 지난 뒤에는 이만큼 느리게 찬다 */
const SLOW_TAIL = 4;
const TICK_MS = 100;

/**
 * 실제 진행률을 알 수 없는 API 대기용 진행도.
 * - 예상 시간까지는 빠르게(남은 구간의 80%), 그 뒤로는 4배 느리게 97%를 향해 계속 움직여서 멈춘 것처럼 보이지 않게 한다.
 * - floor가 오르면(단계 하나가 끝나면) 그 지점부터 다시 차오른다.
 * - done이면 100%.
 * - 바는 뒤로 가지 않는다.
 */
export function useLoadingProgress(done: boolean, { floor = 0, expectedMs = 2500 }: Options = {}) {
  const [progress, setProgress] = useState(0);
  // 단계(floor)가 바뀐 시각과 그때의 진행도부터 다시 곡선을 그린다
  const stage = useRef({ start: 0, from: 0, floor: -1 });

  useEffect(() => {
    if (done) {
      setProgress(100);
      return;
    }
    const tick = () =>
      setProgress((prev) => {
        const now = performance.now();
        const s = stage.current;
        if (s.floor !== floor) {
          stage.current = { start: now, from: Math.max(prev, floor), floor };
        }
        const { start, from } = stage.current;
        // 예상 시간에 남은 구간의 80%가 차는 지수 곡선, 그 뒤로는 4배 느리게
        const rate = -Math.log(1 - EXPECTED_SHARE) / Math.max(expectedMs, 1);
        const t = now - start;
        const share =
          t <= expectedMs
            ? 1 - Math.exp(-rate * t)
            : EXPECTED_SHARE + (1 - EXPECTED_SHARE) * (1 - Math.exp((-rate * (t - expectedMs)) / SLOW_TAIL));
        const next = from + (CAP - from) * share;
        return Math.max(prev, Math.min(CAP, next));
      });
    tick();
    const t = setInterval(tick, TICK_MS);
    return () => clearInterval(t);
  }, [done, floor, expectedMs]);

  return progress;
}
