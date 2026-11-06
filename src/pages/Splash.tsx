import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Gnb from '../components/Gnb';
import Spacer from '../components/Spacer';
import fox from '../assets/fox-wave.png';
import logo from '../assets/logo-splash.svg';
import styles from './Splash.module.css';

const SPLASH_MS = 1800;

export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => navigate('/onboarding', { replace: true }), SPLASH_MS);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <main className="screen">
      <Spacer grow={246} />
      <div className={styles.content}>
        <img className={styles.fox} src={fox} alt="인사하는 탐험가 여우" />
        <p className={styles.hello}>만나서 반가워~!!</p>
        <img className={styles.logo} src={logo} width={100} height={41} alt="PODO" />
        <p className={styles.slogan}>우리 아이와 주말에 갈 용인 나들이</p>
      </div>
      <Spacer grow={309} />
      <Gnb />
    </main>
  );
}
