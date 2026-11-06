import { useEffect, useState } from 'react';

/**
 * 실제 진행률을 알 수 없는 API 대기용.
 * 기다리는 동안 90%까지 점점 느려지며 차오르고, done이 되면 100%로 채운다.
 */
export function useLoadingProgress(done: boolean) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (done) {
      setProgress(100);
      return;
    }
    const t = setInterval(() => setProgress((p) => p + (90 - p) * 0.08), 120);
    return () => clearInterval(t);
  }, [done]);

  return progress;
}
