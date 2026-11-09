import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ActionButtons from '../components/ActionButtons';
import Chip from '../components/Chip';
import Gnb from '../components/Gnb';
import LoadError from '../components/LoadError';
import pinIcon from '../assets/icon-pin.svg';
import { useRecommendationOptions } from '../api/queries';
import { readPrefs, writePrefs } from '../lib/prefs';
import styles from './LocationPermission.module.css';

const GEO_TIMEOUT_MS = 10_000;

/** Figma "위치 권한 안내" */
export default function LocationPermission() {
  const navigate = useNavigate();
  const options = useRecommendationOptions();
  const [districtCode, setDistrictCode] = useState<string | null>(readPrefs().districtCode ?? null);
  const [asking, setAsking] = useState(false);

  const chooseDistrict = (code: string) => {
    const next = districtCode === code ? null : code;
    setDistrictCode(next);
    writePrefs({ districtCode: next });
  };

  const allow = () => {
    if (!('geolocation' in navigator)) {
      navigate('/home');
      return;
    }
    setAsking(true);
    // 허용·거절과 상관없이 홈으로 이어간다. 위치 좌표는 저장하지 않는다
    navigator.geolocation.getCurrentPosition(
      () => {
        writePrefs({ locationAllowed: true });
        navigate('/home');
      },
      () => {
        writePrefs({ locationAllowed: false });
        navigate('/home');
      },
      { timeout: GEO_TIMEOUT_MS, maximumAge: 5 * 60 * 1000 },
    );
  };

  return (
    <main className="screen">
      <div className={styles.scroll}>
        <div className={styles.content}>
          <div className={styles.pinCircle}>
            <img src={pinIcon} width={43} height={43} alt="" />
          </div>
          <h1 className={styles.title}>가까운 나들이 장소부터 보여드려요</h1>
          <p className={styles.sub}>위치는 추천·날씨·도착 확인에만 써요</p>

          <ul className={styles.notice}>
            <li>현재 위치에서 차로 걸리는 시간 표시</li>
            <li>방문 당일 &apos;방문했어요&apos; 자동 확인</li>
            <li>위치 기록은 저장하지 않아요</li>
          </ul>

          <p className={styles.hint}>허용하지 않으면 지역을 직접 골라요</p>
          {options.isError ? (
            <div className={styles.districts}>
              <LoadError message="지역 목록을 불러오지 못했어요." onRetry={() => options.refetch()} />
            </div>
          ) : (
            <div className={styles.districts}>
              {(options.data?.districts ?? []).filter((d) => d.active).map((d) => (
                <Chip key={d.code} variant="brown" selected={districtCode === d.code} onClick={() => chooseDistrict(d.code)}>
                  {d.label}
                </Chip>
              ))}
            </div>
          )}
        </div>

        <div className={styles.bottom}>
          <ActionButtons
            primary="위치 허용"
            secondary="나중에 하기"
            onPrimary={allow}
            onSecondary={() => navigate('/home')}
            busy={asking}
          />
        </div>
      </div>
      <Gnb />
    </main>
  );
}
