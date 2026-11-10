import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import backIcon from '../assets/icon-back.svg';
import styles from './PageHeader.module.css';

type Props = {
  title: string;
  /** 제목 아래 오른쪽 링크 (예: "+ 아이 추가하기") */
  action?: ReactNode;
  /** 뒤로가기 동작을 바꿀 때 (기본: 브라우저 뒤로) */
  onBack?: () => void;
};

/** Figma 컴포넌트 "상단": y 44.5, 높이 50, 뒤로가기 + 제목 */
export default function PageHeader({ title, action, onBack }: Props) {
  const navigate = useNavigate();
  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        <button type="button" className={styles.back} onClick={onBack ?? (() => navigate(-1))} aria-label="뒤로가기">
          <img src={backIcon} width={9} height={18} alt="" />
        </button>
        <h1 className={styles.title}>{title}</h1>
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </header>
  );
}
