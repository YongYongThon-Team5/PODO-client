import { useEffect } from 'react';
import Spacer from './Spacer';
import SpeechBubble from './SpeechBubble';
import background from '../assets/login-bg.webp';
import foxRun from '../assets/fox-run.webp';
import styles from './LoadingScreen.module.css';

// Figma "😀로딩페이지" 5종 (11.10)의 말풍선 문구
export const LOADING_MESSAGES = {
  recommend: '맞춤 장소를 찾는 중',
  map: '주변 장소를 지도에 표시하는 중',
  place: '장소 상세 · 오늘 운영 정보를 확인하는 중',
  quiz: 'OX 퀴즈 · 이 장소 퀴즈 3문제를 불러오는 중',
  mission: '미션이 완료된 장소를 지도에 표시하는 중',
} as const;

export type LoadingType = keyof typeof LOADING_MESSAGES;

/**
 * 말풍선 왼쪽 끝 = 화면 가운데 기준 (Figma x 119 → -82). 글이 길면 오른쪽으로 늘어난다.
 * 맞춤 장소 문구는 짧아 Figma에서 x 151(-50)에 둔다.
 * Figma 퀴즈 문구만 Noto 12px로 남아 폭이 넓어 x 87에서 시작하는데,
 * Pretendard로 맞추면 119에서 시작해도 오른쪽 끝이 다른 말풍선 범위(~352) 안이라 119로 둔다.
 */
const BUBBLE_LEFT: Record<LoadingType, number> = { recommend: -50, map: -82, place: -82, quiz: -82, mission: -82 };

/** 다 찬 뒤 여우가 한 번 폴짝 뛰는 시간 — CSS와 같은 값 */
const FINISH_HOP_MS = 450;

type Props = {
  type: LoadingType;
  /** 0~100 */
  progress: number;
  /** 100%가 되고 여우가 폴짝 뛴 다음 호출 */
  onFinish?: () => void;
};

export default function LoadingScreen({ type, progress, onFinish }: Props) {
  const percent = Math.max(0, Math.min(100, progress));
  const finished = percent >= 100;

  useEffect(() => {
    if (!finished || !onFinish) return;
    const t = setTimeout(onFinish, FINISH_HOP_MS);
    return () => clearTimeout(t);
  }, [finished, onFinish]);

  return (
    <main className="screen" aria-busy={!finished}>
      <img className={styles.background} src={background} alt="" />

      <Spacer grow={233} />
      <SpeechBubble leftFromCenter={BUBBLE_LEFT[type]}>{LOADING_MESSAGES[type]}</SpeechBubble>

      <div className={`${styles.walker} ${finished ? styles.finished : ''}`}>
        <span className={styles.shadow} />
        <img className={styles.fox} src={foxRun} alt="걸어가는 탐험가 여우" />
      </div>

      <div
        className={styles.bar}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-label={LOADING_MESSAGES[type]}
      >
        <span className={styles.fill} style={{ width: `${percent}%` }} />
      </div>

      <p className={styles.title}>잠깐만 기다려 주세요</p>
      <p className={styles.sub}>우리 같이 기다려 볼까?</p>
      <Spacer grow={299} />
    </main>
  );
}
