import { useState, type ReactNode } from 'react';
import LoadingScreen, { type LoadingType } from './LoadingScreen';
import { useLoadingProgress } from '../hooks/useLoadingProgress';

type Props = {
  type: LoadingType;
  /** 처음 불러오는 중인지 (react-query의 isPending) */
  pending: boolean;
  children: ReactNode;
};

/**
 * Figma 흐름의 "화면 → 로딩페이지 → 다음 화면".
 * 처음 들어올 때 데이터가 없으면 로딩 화면을 보여 주고, 다 차서 여우가 폴짝 뛴 뒤 화면을 연다.
 * 이미 캐시에 있으면(뒤로 가기 등) 로딩 없이 바로 연다.
 */
export default function LoadingGate({ type, pending, children }: Props) {
  const [showLoading, setShowLoading] = useState(pending);
  const progress = useLoadingProgress(!pending);

  if (showLoading) {
    return <LoadingScreen type={type} progress={pending ? progress : 100} onFinish={() => setShowLoading(false)} />;
  }
  return <>{children}</>;
}
