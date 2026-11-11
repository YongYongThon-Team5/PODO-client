import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Spacer from '../components/Spacer';
import SpeechBubble from '../components/SpeechBubble';
import background from '../assets/login-bg.jpg';
import fox from '../assets/fox-wave.png';
import logo from '../assets/logo-login.svg';
import styles from './Splash.module.css';

const SPLASH_MS = 1800;

/** Figma "😀스플래시" (11.08 개편): 말풍선 230, 여우 281, 로고 481, 슬로건 551 */
export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => navigate('/onboarding', { replace: true }), SPLASH_MS);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <main className="screen">
      <img className={styles.background} src={background} alt="" />

      <Spacer grow={230} />
      {/* 말풍선 133~315: 폭 182 고정, 화면 가운데보다 23px 오른쪽 */}
      <SpeechBubble offsetX={23} width={182}>
        만나서 반가워~!!
      </SpeechBubble>

      <div className={styles.foxWrap}>
        <span className={styles.foxShadow} />
        <img className={styles.fox} src={fox} alt="인사하는 탐험가 여우" />
      </div>

      <img className={styles.logo} src={logo} width={159} height={58} alt="PODO" />
      <p className={styles.slogan}>우리 아이와 주말에 갈 용인 나들이</p>
      <Spacer grow={293} />
    </main>
  );
}
