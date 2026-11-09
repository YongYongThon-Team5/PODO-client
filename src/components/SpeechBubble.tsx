import type { ReactNode } from 'react';
import styles from './SpeechBubble.module.css';

type Props = {
  children: ReactNode;
  /** 화면 가운데에서 오른쪽으로 민 거리 (말풍선 가운데 기준) */
  offsetX?: number;
  /**
   * 말풍선 왼쪽 끝을 화면 가운데 기준 이 거리에 고정 (글이 길면 오른쪽으로 늘어남).
   * 주면 offsetX는 쓰지 않는다.
   */
  leftFromCenter?: number;
  /** 고정 폭. 없으면 글자에 맞춰 늘어남 */
  width?: number;
};

/** 여우 위 주황 말풍선 (스플래시·로딩 공통, Figma "Union" 높이 34.5) */
export default function SpeechBubble({ children, offsetX = 0, leftFromCenter, width }: Props) {
  const anchored = leftFromCenter !== undefined;
  return (
    <div className={`${styles.row} ${anchored ? styles.rowStart : ''}`}>
      <p
        className={styles.bubble}
        style={anchored ? { marginLeft: `calc(50% + ${leftFromCenter}px)`, width } : { left: offsetX, width }}
      >
        {children}
        <svg className={styles.tail} width="8" height="6" viewBox="86.5 28.5 8 6" aria-hidden>
          <path d="M94 29C93.1234 32.2715 89.5631 34.5395 87.2314 34.5C86.7408 34.4916 87.8957 33.735 88.0771 32.1025C88.2182 30.8334 88.0772 29.423 86.667 29H94Z" />
        </svg>
      </p>
    </div>
  );
}
