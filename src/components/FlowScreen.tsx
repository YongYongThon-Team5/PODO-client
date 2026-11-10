import type { ReactNode } from 'react';
import Gnb from './Gnb';
import PageHeader from './PageHeader';
import styles from './FlowScreen.module.css';

type Props = {
  title: string;
  onBack?: () => void;
  /** 헤더 바로 아래부터 (Figma y 94.5~) */
  children: ReactNode;
  /** 아래 버튼 (Figma y 674, GNB 위 38) */
  footer?: ReactNode;
  /** 버튼 위 안내·오류 문구 */
  message?: string | null;
  className?: string;
};

/**
 * 방문·퀴즈 흐름 화면 공통 틀 (Figma: 상단 50 → 내용 → 버튼 342x60 → GNB).
 * 내용이 짧으면 버튼을 Figma 위치로 내리고, 길면 같이 스크롤한다.
 */
export default function FlowScreen({ title, onBack, children, footer, message, className }: Props) {
  return (
    <main className={`screen ${className ?? ''}`}>
      <PageHeader title={title} onBack={onBack} />
      <div className={styles.scroll}>
        {children}
        <div className={styles.fill} />
        {message && (
          <p className={styles.message} role="alert">
            {message}
          </p>
        )}
        {footer}
      </div>
      <Gnb />
    </main>
  );
}

export { styles as flow };
