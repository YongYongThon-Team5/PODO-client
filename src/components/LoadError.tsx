import styles from './LoadError.module.css';

type Props = { message: string; onRetry: () => void };

/** 선택 목록 등 화면에 꼭 필요한 데이터를 못 불러왔을 때 (예: 503 OPTIONS_NOT_CONFIGURED) */
export default function LoadError({ message, onRetry }: Props) {
  return (
    <div className={styles.box} role="alert">
      <span>{message}</span>
      <button type="button" className={styles.retry} onClick={onRetry}>
        다시 시도
      </button>
    </div>
  );
}
