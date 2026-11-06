import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import LoadingScreen, { LOADING_MESSAGES, type LoadingType } from '../components/LoadingScreen';
import { useLoadingProgress } from '../hooks/useLoadingProgress';

/** 확인용 화면: /preview/loading?type=map|place|quiz — 3초 로딩 후 처음부터 반복 */
const FAKE_WAIT_MS = 3000;
const RESTART_MS = 800;

function Run({ type, onDone }: { type: LoadingType; onDone: () => void }) {
  const [done, setDone] = useState(false);
  const progress = useLoadingProgress(done);

  useEffect(() => {
    const t = setTimeout(() => setDone(true), FAKE_WAIT_MS);
    return () => clearTimeout(t);
  }, []);

  return <LoadingScreen type={type} progress={progress} onFinish={onDone} />;
}

export default function LoadingPreview() {
  const [params] = useSearchParams();
  const raw = params.get('type');
  const type: LoadingType = raw && raw in LOADING_MESSAGES ? (raw as LoadingType) : 'map';
  const [round, setRound] = useState(0);

  const restart = useCallback(() => {
    setTimeout(() => setRound((r) => r + 1), RESTART_MS);
  }, []);

  return <Run key={`${type}-${round}`} type={type} onDone={restart} />;
}
