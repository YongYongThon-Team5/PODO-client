import Gnb from '../components/Gnb';
import styles from './ComingSoon.module.css';

/** GNB에서 들어갈 수 있지만 아직 만들지 않은 탭 */
export default function ComingSoon({ title }: { title: string }) {
  return (
    <main className="screen">
      <div className={styles.body}>
        <h1 className={styles.title}>{title}</h1>
        <p>준비 중인 화면이에요</p>
      </div>
      <Gnb />
    </main>
  );
}
