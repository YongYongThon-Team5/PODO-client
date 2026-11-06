import { useNavigate } from 'react-router-dom';
import Spacer from '../components/Spacer';
import background from '../assets/login-bg.jpg';
import fox from '../assets/fox-wave.png';
import logo from '../assets/logo-login.svg';
import styles from './Login.module.css';

export default function Login() {
  const navigate = useNavigate();

  const loginWithKakao = () => {
    // TODO: 카카오 OAuth 연동 (백엔드 로그인 API 확정 후)
    navigate('/signup');
  };

  return (
    <main className="screen screen-fade-in">
      <img className={styles.background} src={background} alt="" />

      <Spacer grow={331} />
      <div className={styles.brand}>
        <img src={logo} width={159} height={58} alt="PODO" />
        <p className={styles.tagline}>
          우리 아이들 관리,
          <br />
          계정 하나로 충분해요
        </p>
      </div>
      <Spacer grow={117} />

      <div className={styles.foxWrap}>
        <span className={styles.foxShadow} />
        <img className={styles.fox} src={fox} alt="인사하는 탐험가 여우" />
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.kakao} onClick={loginWithKakao}>
          카카오로 3초 만에 시작하기
        </button>
        <button type="button" className={styles.guest} onClick={() => navigate('/home')}>
          로그인 없이 둘러보기
        </button>
      </div>
    </main>
  );
}
