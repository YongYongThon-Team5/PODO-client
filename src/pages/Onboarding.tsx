import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import PageDots from '../components/PageDots';
import Spacer from '../components/Spacer';
import onboarding1 from '../assets/onboarding-1.jpg';
import onboarding2 from '../assets/onboarding-2.jpg';
import onboarding3 from '../assets/onboarding-3.jpg';
import foxOx from '../assets/fox-onboarding2.png';
import styles from './Onboarding.module.css';

/** 한 장이 머무는 시간 */
const SLIDE_MS = 3500;
/** 장면 전환(그라데이션 와이프) 시간 — CSS와 같은 값 */
const WIPE_MS = 700;
const LEAVE_MS = 450;
const SWIPE_PX = 40;

const DISTRICTS = [
  { name: '처인구', count: 3 },
  { name: '기흥구', count: 1 },
  { name: '수지구', count: 0 },
];

/*
 * 세로 여백은 Figma 값(874px 기준, 하단 점 영역 제외 763px)을 Spacer 비율로 둔다.
 * 874px 화면에서는 Figma와 같은 위치, 더 짧은 화면에서는 같은 비율로 줄어든다.
 */
const SLIDES: ReactNode[] = [
  <>
    <Spacer grow={138} />
    <img className={`${styles.image} ${styles.image1}`} src={onboarding1} alt="공원 벤치에서 지도를 함께 보는 아이와 보호자" />
    <h1 className={styles.title}>아이 취향과 날씨로 갈 곳을 골라요</h1>
    <div className={styles.example}>
      <p>곤충 좋아하는 7살 + 비 오는 토요일</p>
      <p className={styles.bold}>→ 실내 체험 장소부터 보여드려요</p>
    </div>
    <Spacer grow={234} />
  </>,
  <>
    <Spacer grow={138} />
    <img className={`${styles.image} ${styles.image2}`} src={onboarding2} alt="여우 캐릭터와 함께 지도를 보며 단서를 찾는 아이" />
    {/* Figma 11.09: 사진 아래 O·X 깃발 든 여우 (342, 121x121) */}
    <div className={styles.oxFox}>
      <span className={styles.oxFoxShadow} />
      <img src={foxOx} alt="O와 X 깃발을 든 여우" />
    </div>
    <h1 className={`${styles.title} ${styles.titleSmall}`}>직접 보고, OX 퀴즈 3문제로 확인해요</h1>
    <p className={styles.desc}>문제는 장소 안내판·전시물에서 나와요</p>
    <p className={styles.descNext}>막히면 미리 준비된 힌트 2단계</p>
    <Spacer grow={204} />
  </>,
  <>
    <Spacer grow={138} />
    <img className={`${styles.image} ${styles.image3}`} src={onboarding3} alt="용인시 구별 탐방 지도와 기록 카드" />
    <ul className={styles.districts}>
      {DISTRICTS.map((d) => (
        <li key={d.name} className={d.count > 0 ? styles.district : `${styles.district} ${styles.districtEmpty}`}>
          <span className={styles.districtName}>{d.name}</span>
          <span className={styles.districtCount}>{d.count}곳</span>
        </li>
      ))}
    </ul>
    <h1 className={`${styles.title} ${styles.titleAfterDistricts}`}>다녀온 곳이 탐방 지도에 쌓여요</h1>
    <p className={styles.desc}>구별로 몇 곳을 다녀왔는지 한눈에</p>
    <Spacer grow={223} />
  </>,
];

type Transition = { from: number; dir: 'next' | 'prev' } | null;

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [transition, setTransition] = useState<Transition>(null);
  const [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const pointerStartX = useRef<number | null>(null);

  // 전환 중 이미지가 늦게 뜨지 않도록 미리 받아둔다
  useEffect(() => {
    [onboarding1, onboarding2, onboarding3, foxOx].forEach((src) => {
      new Image().src = src;
    });
  }, []);

  useEffect(() => {
    if (!transition) return;
    const t = setTimeout(() => setTransition(null), WIPE_MS);
    return () => clearTimeout(t);
  }, [transition]);

  const goTo = useCallback(
    (next: number) => {
      if (leaving || next === step || next < 0) return;
      if (next >= SLIDES.length) {
        setLeaving(true);
        setTimeout(() => navigate('/login', { replace: true }), LEAVE_MS);
        return;
      }
      setTransition({ from: step, dir: next > step ? 'next' : 'prev' });
      setStep(next);
    },
    [leaving, navigate, step],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goTo(step + 1);
      if (e.key === 'ArrowLeft') goTo(step - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, step]);

  // 누르고 있으면 멈춤, 떼면 이어서. 짧게 탭하면 다음, 좌우로 밀면 앞뒤 이동
  const onPointerDown = (e: React.PointerEvent) => {
    pointerStartX.current = e.clientX;
    setPaused(true);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    setPaused(false);
    if (pointerStartX.current === null) return;
    const dx = e.clientX - pointerStartX.current;
    pointerStartX.current = null;
    if (dx <= -SWIPE_PX) goTo(step + 1);
    else if (dx >= SWIPE_PX) goTo(step - 1);
    else if (Math.abs(dx) < 10) goTo(step + 1);
  };
  const onPointerCancel = () => {
    pointerStartX.current = null;
    setPaused(false);
  };

  return (
    <main className={`screen ${leaving ? styles.leaving : ''}`}>
      <div className={styles.glow} aria-hidden>
        <div className={styles.glowTrack} style={{ transform: `translateX(${(-100 / 3) * step}%)` }} />
      </div>

      <section
        className={styles.stage}
        data-dir={transition?.dir}
        aria-roledescription="carousel"
        aria-live="polite"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerCancel}
      >
        {transition && (
          <div key={`out-${transition.from}`} className={`${styles.layer} ${styles.exit}`} aria-hidden>
            {SLIDES[transition.from]}
          </div>
        )}
        <div key={`in-${step}`} className={`${styles.layer} ${transition ? styles.enter : ''}`}>
          {SLIDES[step]}
        </div>
      </section>

      <PageDots
        count={SLIDES.length}
        active={step}
        duration={SLIDE_MS}
        paused={paused || leaving}
        onComplete={() => goTo(step + 1)}
      />
      <Spacer grow={101} />
    </main>
  );
}
