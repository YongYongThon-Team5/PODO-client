import { useEffect, useRef, useState } from 'react';

type Options = {
  /**
   * 지금까지 확실히 끝난 단계만큼의 최소 진행도(0~100).
   * 예: 두 요청 중 하나가 끝나면 50. 바는 여기서부터 이어서 차오른다.
   */
  floor?: number;
  /** 보통 이 정도 걸린다고 보는 시간(ms). 이 시간쯤 남은 구간의 80%가 찬다 */
  expectedMs?: number;
  /** 로딩 화면이 보일 때만 true. false면 0으로 돌아가 멈춰 있다 (화면 뒤에서 미리 차오르지 않게) */
  active?: boolean;
};

/** 끝나기 전에는 여기까지만 찬다 (100은 실제로 끝났을 때만) */
const CAP = 97;
/** 예상 시간까지 남은 구간 중 이만큼 채운다 */
const EXPECTED_SHARE = 0.8;
/** 예상 시간이 지난 뒤에는 이만큼 느리게 찬다 */
const SLOW_TAIL = 4;
const TICK_MS = 100;
/** 단계(floor)가 올라갈 때 그 지점까지 따라붙는 시간 */
const CATCH_UP_MS = 800;

/**
 * 실제 진행률을 알 수 없는 API 대기용 진행도.
 * - 예상 시간까지는 빠르게(남은 구간의 80%), 그 뒤로는 4배 느리게 97%를 향해 계속 움직여서 멈춘 것처럼 보이지 않게 한다.
 * - floor가 오르면(단계 하나가 끝나면) 0.8초 동안 그 지점까지 따라붙고, 거기서 다시 차오른다.
 * - done이면 100%.
 * - 바는 뒤로 가지 않는다.
 */
export function useLoadingProgress(done: boolean, { floor = 0, expectedMs = 2500, active = true }: Options = {}) {
  const [progress, setProgress] = useState(0);
  // 단계(floor)가 바뀐 시각과 그때의 진행도부터 다시 곡선을 그린다
  const stage = useRef({ start: 0, from: 0, floor: -1 });

  useEffect(() => {
    if (!active) {
      stage.current = { start: 0, from: 0, floor: -1 };
      setProgress(0);
      return;
    }
    if (done) {
      setProgress(100);
      return;
    }
    const tick = () =>
      setProgress((prev) => {
        const now = performance.now();
        const s = stage.current;
        if (s.floor !== floor) {
          stage.current = { start: now, from: prev, floor };
        }
        const { start, from } = stage.current;
        const t = now - start;
        // 단계가 올라가도 한 번에 뛰지 않고 짧게 따라붙는다
        const catchUp = from + (Math.max(from, floor) - from) * (1 - (1 - Math.min(1, t / CATCH_UP_MS)) ** 2);
        // 예상 시간에 남은 구간의 80%가 차는 지수 곡선, 그 뒤로는 4배 느리게
        const rate = -Math.log(1 - EXPECTED_SHARE) / Math.max(expectedMs, 1);
        const share =
          t <= expectedMs
            ? 1 - Math.exp(-rate * t)
            : EXPECTED_SHARE + (1 - EXPECTED_SHARE) * (1 - Math.exp((-rate * (t - expectedMs)) / SLOW_TAIL));
        const next = Math.max(catchUp, from + (CAP - from) * share);
        return Math.max(prev, Math.min(CAP, next));
      });
    tick();
    const t = setInterval(tick, TICK_MS);
    return () => clearInterval(t);
  }, [active, done, floor, expectedMs]);

  return progress;
}
