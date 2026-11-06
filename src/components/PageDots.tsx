import styles from './PageDots.module.css';

type Props = {
  count: number;
  active: number;
  /** 현재 점이 차오르는 시간(ms). 다 차면 onComplete 호출 */
  duration: number;
  paused?: boolean;
  onComplete?: () => void;
};

export default function PageDots({ count, active, duration, paused = false, onComplete }: Props) {
  return (
    <div className={styles.dots} role="progressbar" aria-valuemin={1} aria-valuemax={count} aria-valuenow={active + 1}>
      {Array.from({ length: count }, (_, i) =>
        i === active ? (
          <span key={i} className={styles.track}>
            <span
              key={active}
              className={styles.fill}
              style={{ animationDuration: `${duration}ms`, animationPlayState: paused ? 'paused' : 'running' }}
              onAnimationEnd={onComplete}
            />
          </span>
        ) : (
          <span key={i} className={i < active ? styles.done : styles.dot} />
        ),
      )}
    </div>
  );
}
