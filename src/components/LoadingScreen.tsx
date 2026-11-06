import { useEffect } from 'react';
import Spacer from './Spacer';
import background from '../assets/login-bg.jpg';
import foxRun from '../assets/fox-run.png';
import styles from './LoadingScreen.module.css';

// Figma "로딩 페이지" 3종의 말풍선 문구
export const LOADING_MESSAGES = {
  map: '주변 장소를 지도에 표시하는 중',
  place: '오늘 운영 정보를 확인하는 중',
  quiz: '이 장소 퀴즈 3문제를 불러오는 중',
} as const;

export type LoadingType = keyof typeof LOADING_MESSAGES;

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
      <div className={styles.bubbleRow}>
        <p className={styles.bubble}>
          {LOADING_MESSAGES[type]}
          <svg className={styles.tail} width="8" height="6" viewBox="86.5 28.5 8 6" aria-hidden>
            <path d="M94 29C93.1234 32.2715 89.5631 34.5395 87.2314 34.5C86.7408 34.4916 87.8957 33.735 88.0771 32.1025C88.2182 30.8334 88.0772 29.423 86.667 29H94Z" />
          </svg>
        </p>
      </div>

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
