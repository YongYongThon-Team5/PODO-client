import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Chip from '../components/Chip';
import Gnb from '../components/Gnb';
import PageHeader from '../components/PageHeader';
import {
  useAuth,
  useChildProfiles,
  useProfileOptions,
  useRecommendationOptions,
  useRecommendations,
  type RecommendationItem,
  type RecommendationRequest,
} from '../api/queries';
import { ENVIRONMENT_LABEL, formatShortDate } from '../lib/format';
import styles from './Recommend.module.css';

/** Figma "맞춤 장소 목록" — /recommend?date=YYYY-MM-DD&purpose=CODE&district=CODE&child=UUID */
export default function Recommend() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const auth = useAuth();
  const options = useRecommendationOptions();
  const profiles = useChildProfiles();
  const profileOptions = useProfileOptions();

  const date = params.get('date');
  const purpose = params.get('purpose');
  const district = params.get('district');
  // 비로그인으로 아이 ID를 보내면 401이라 로그인했을 때만 넣는다
  const child = auth.status === 'signedIn' ? params.get('child') : null;

  const request = useMemo<RecommendationRequest | null>(
    () =>
      date && purpose && auth.status !== 'unknown'
        ? { visitDate: date, purposeCode: purpose, districtCode: district, childProfileId: child }
        : null,
    [date, purpose, district, child, auth.status],
  );
  const result = useRecommendations(request);

  const label = (list: { code: string; label: string }[] | undefined, code: string | null) =>
    list?.find((o) => o.code === code)?.label ?? null;
  const purposeLabel = label(options.data?.purposes, purpose);
  // Figma "하늘이 7세": 이름 + 나이 라벨 (나이 목록은 profile-options의 ageBands)
  const childProfile = profiles.data?.find((p) => p.id === child);
  const ageLabel = profileOptions.data?.ageBands?.find((a) => a.code === childProfile?.ageBandCode)?.label;
  const childName = childProfile ? [childProfile.nickname, ageLabel].filter(Boolean).join(' ') : null;
  const districtLabel = (code: string | null | undefined) => label(options.data?.districts, code ?? null);

  const data = result.data;
  const weatherUnknown = data?.warnings.includes('WEATHER_UNAVAILABLE');
  const rainy = data?.items.some((i) => i.weather.condition === 'RAIN');
  const notice = weatherUnknown
    ? '방문일 날씨를 아직 알 수 없어서 날씨 없이 골랐어요'
    : rainy
      ? '비 예보라 실내 장소를 먼저 골랐어요'
      : '비 예보가 있으면 실내 장소가 먼저 나와요';

  if (!date || !purpose) {
    return (
      <main className="screen">
        <PageHeader title="맞춤 장소 목록" />
        <div className={styles.state}>
          <p>방문 날짜와 목적을 먼저 골라 주세요.</p>
          <button type="button" className={styles.stateButton} onClick={() => navigate('/conditions')}>
            조건 고르기
          </button>
        </div>
        <Gnb />
      </main>
    );
  }

  return (
    <main className="screen">
      <PageHeader title="맞춤 장소 목록" />

      <div className={styles.scroll}>
        <div className={styles.chips}>
          <Chip variant="filled">{formatShortDate(date)}</Chip>
          {purposeLabel && <Chip variant="filled">{purposeLabel}</Chip>}
          {childName && <Chip variant="filled">{childName}</Chip>}
        </div>

        <p className={styles.notice}>{notice}</p>

        {result.isPending && (
          <ul className={styles.list} aria-busy>
            {[0, 1, 2].map((i) => (
              <li key={i} className={`${styles.card} ${styles.skeleton}`} />
            ))}
          </ul>
        )}

        {result.isError && (
          <div className={styles.state}>
            <p>{result.error.message}</p>
            <button type="button" className={styles.stateButton} onClick={() => result.refetch()}>
              다시 시도
            </button>
          </div>
        )}

        {data && data.items.length === 0 && (
          <div className={styles.state}>
            <p>조건에 맞는 장소가 없어요. 지역이나 목적을 바꿔 보세요.</p>
            <button type="button" className={styles.stateButton} onClick={() => navigate('/conditions')}>
              조건 바꾸기
            </button>
          </div>
        )}

        {data && data.items.length > 0 && (
          <ul className={styles.list}>
            {data.items.map((item) => (
              <PlaceCard key={item.place.id} item={item} district={districtLabel(item.place.districtCode)} />
            ))}
          </ul>
        )}

        {data?.shortageReason === 'INSUFFICIENT_ELIGIBLE_PLACES' && (
          <p className={styles.footnote}>조건에 맞는 곳이 {data.returnedCount}곳이라 모두 보여드려요</p>
        )}
      </div>

      <Gnb />
    </main>
  );
}

function PlaceCard({ item, district }: { item: RecommendationItem; district: string | null }) {
  const { place } = item;
  const meta = [district, ENVIRONMENT_LABEL[place.environment], place.mainActivities[0]].filter(Boolean).join(' · ');
  // TODO: 장소 상세 화면이 생기면 카드를 눌러 이동
  return (
    <li className={styles.card}>
      {place.thumbnailUrl ? (
        <img className={styles.thumb} src={place.thumbnailUrl} alt="" loading="lazy" />
      ) : (
        <span className={styles.thumb} aria-hidden />
      )}
      <div className={styles.info}>
        <p className={styles.name}>{place.name}</p>
        <p className={styles.meta}>{meta}</p>
        <ul className={styles.tags}>
          {item.matchedConditions.map((m) => (
            <li key={`${m.kind}-${m.code}`} className={styles.tag}>
              {m.label}
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}
