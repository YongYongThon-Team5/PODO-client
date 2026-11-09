import styles from './ActionButtons.module.css';

type Props = {
  primary: string;
  secondary: string;
  onPrimary: () => void;
  onSecondary: () => void;
  primaryDisabled?: boolean;
  busy?: boolean;
};

/** Figma 컴포넌트 "버튼": 342x60 두 개, 간격 10 (주황 / 연주황) */
export default function ActionButtons({ primary, secondary, onPrimary, onSecondary, primaryDisabled, busy }: Props) {
  return (
    <div className={styles.buttons}>
      <button type="button" className={styles.primary} onClick={onPrimary} disabled={primaryDisabled || busy}>
        {busy ? '잠시만요…' : primary}
      </button>
      <button type="button" className={styles.secondary} onClick={onSecondary} disabled={busy}>
        {secondary}
      </button>
    </div>
  );
}
