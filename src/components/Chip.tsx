import type { ButtonHTMLAttributes } from 'react';
import styles from './Chip.module.css';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  /**
   * orange: 회원가입·오늘의 조건 (주황 0.5px 테두리)
   * gray: 홈 인기 탐험지 (회색 테두리)
   * brown: 위치 권한 지역 (갈색 테두리)
   * filled: 맞춤 장소 목록 상단 조건 (항상 채움, 누를 수 없음)
   */
  variant?: 'orange' | 'gray' | 'brown' | 'filled';
};

export default function Chip({ selected = false, variant = 'orange', className, ...props }: Props) {
  const cls = [styles.chip, styles[variant], selected ? styles.selected : '', className].filter(Boolean).join(' ');
  return <button type="button" aria-pressed={variant === 'filled' ? undefined : selected} className={cls} {...props} />;
}

export function ChipGroup({ children }: { children: React.ReactNode }) {
  return <div className={styles.group}>{children}</div>;
}
