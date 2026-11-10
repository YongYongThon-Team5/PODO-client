import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Chip from '../components/Chip';
import Gnb from '../components/Gnb';
import foxSit from '../assets/fox-sit.png';
import {
  useActiveVisit,
  useAuth,
  useChildProfiles,
  usePlace,
  usePopularPlaces,
  useProfileOptions,
  useRecommendationOptions,
  type PlaceDetail,
  type PlaceSummary,
} from '../api/queries';
import { ENVIRONMENT_LABEL, formatShortDate, shortAddress, upcomingSaturday, withJosaWa } from '../lib/format';
import { toPlaceUrl } from './PlaceDetail';
import styles from './Home.module.css';

// 인기 탐험지 카테고리 → 장소의 관심사 코드 (profile-options) 또는 실내 여부
const CATEGORIES = [
  { key: 'all', label: '전체' },
  { key: 'nature', label: '자연', codes: ['NATURE', 'ANIMAL'] },
  { key: 'activity', label: '체험', codes: ['FARM', 'SCIENCE', 'SPORTS', 'ART'] },
  { key: 'history', label: '역사', codes: ['HISTORY'] },
  { key: 'indoor', label: '실내' },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]['key'];

const WEATHER_LABEL: Record<string, string> = { CLEAR: '맑음', CLOUDY: '흐림', RAIN: '비' };

// 서버 추천 규칙: 비 예보면 야외 제외, 흐리면 야외 감점
const WEATHER_GUIDE: Record<string, string> = {
  CLEAR: '야외 장소도 추천에 넣을게요',
  CLOUDY: '흐린 날이라 실내 장소를 조금 더 앞에 둬요',
  RAIN: '비 예보라 야외 장소는 빼고 추천해요',
};

/** Figma "홈" */
export default function Home() {
  const navigate = useNavigate();
  const auth = useAuth();
  const profiles = useChildProfiles();
  const nickname = profiles.data?.[0]?.nickname;
  const signedIn = auth.status === 'signedIn';

  // 방문 예정 장소는 방문일 날씨와 함께 한 번 불러와 날씨 상자·방문 예정 카드가 같이 쓴다
  const visit = useActiveVisit();
  const place = usePlace(visit.data?.placeId, visit.data?.plannedDate);
  const weather = place.data?.weather;
  const weatherLabel = weather ? WEATHER_LABEL[weather.condition] : undefined;

  let weekendTitle = `${formatShortDate(upcomingSaturday())} 이번 주말 나들이`;
  let weekendSub = '조건을 고르면 날씨까지 보고 골라 드려요';
  if (visit.data) {
    const date = formatShortDate(visit.data.plannedDate);
    if (weatherLabel) {
      weekendTitle = `${date} ${weatherLabel} · ${visit.data.placeName}`;
      weekendSub = WEATHER_GUIDE[weather!.condition];
    } else {
      weekendTitle = `${date} · ${visit.data.placeName}`;
      weekendSub = place.isPending
        ? '방문일 날씨를 확인하는 중…'
        : weather?.unavailableReason === 'OUT_OF_FORECAST_RANGE'
          ? '방문일이 가까워지면 날씨를 알려드려요'
          : '방문일 날씨를 확인하지 못했어요';
    }
  }

  return (
    <main className={`screen ${styles.screen}`}>
      <div className={styles.scroll}>
        <div className={styles.hero}>
          <span className={styles.fox}>
            <span className={styles.foxShadow} aria-hidden />
            <img src={foxSit} alt="" />
          </span>
          <h1 className={styles.greeting}>
            {nickname ? `${withJosaWa(nickname)} 이번 주말 어디 갈까요?` : '이번 주말 어디 갈까요?'}
          </h1>
        </div>

        <div className={styles.searchArea}>
          <button type="button" className={styles.searchCard} onClick={() => navigate('/conditions')}>
            <span className={styles.searchTitle}>맞춤 장소 검색</span>
            <span className={styles.searchSub}>
              관심사 · 날짜 · 목적 → 최대 5곳
              <br />
              날씨는 자동으로 반영돼요
            </span>
            <span className={styles.weekend}>
              <span className={styles.weekendTitle}>{weekendTitle}</span>
              <span className={styles.weekendSub}>{weekendSub}</span>
            </span>
          </button>
        </div>

        <div className={styles.lower}>
          <h2 className={styles.sectionTitle}>방문 예정</h2>
          <PlannedVisit signedIn={signedIn} visit={visit} place={place.data} />
          <PopularPlaces />
        </div>
      </div>
      <Gnb />
    </main>
  );
}

type PlannedVisitProps = {
  signedIn: boolean;
  visit: ReturnType<typeof useActiveVisit>;
  place: PlaceDetail | undefined;
};

function PlannedVisit({ signedIn, visit, place }: PlannedVisitProps) {
  if (!signedIn || !visit.data) {
    return (
      <div className={`${styles.visitCard} ${styles.visitEmpty}`}>
        {!signedIn
          ? '로그인하면 방문 예정 장소가 여기에 보여요'
          : visit.isPending
            ? '불러오는 중…'
            : '아직 방문 예정인 곳이 없어요'}
      </div>
    );
  }

  const v = visit.data;
  const sub = [formatShortDate(v.plannedDate), place && shortAddress(place.address), 'OX 퀴즈 3문제']
    .filter(Boolean)
    .join(' · ');
  return (
    <Link className={styles.visitCard} to={toPlaceUrl(v.placeId, { date: v.plannedDate, child: v.childProfileId })}>
      {place?.thumbnailUrl ? (
        <img className={styles.visitThumb} src={place.thumbnailUrl} alt="" />
      ) : (
        <span className={styles.visitThumb} aria-hidden />
      )}
      <div className={styles.visitInfo}>
        <p className={styles.visitName}>{v.placeName}</p>
        <p className={styles.visitSub}>{sub}</p>
      </div>
    </Link>
  );
}

function PopularPlaces() {
  const popular = usePopularPlaces();
  const profileOptions = useProfileOptions();
  const recOptions = useRecommendationOptions();
  const [category, setCategory] = useState<CategoryKey>('all');

  const codeById = useMemo(
    () => new Map((profileOptions.data?.interestCategories ?? []).map((c) => [c.id, c.code])),
    [profileOptions.data],
  );
  const districtLabel = (code: string | null) => recOptions.data?.districts.find((d) => d.code === code)?.label;

  const categoryOf = (p: PlaceSummary) => {
    const codes = p.interestCategoryIds.map((id) => codeById.get(id));
    return CATEGORIES.find((c) => 'codes' in c && c.codes.some((x) => codes.includes(x)));
  };
  const matches = (p: PlaceSummary) => {
    if (category === 'all') return true;
    if (category === 'indoor') return p.environment === 'INDOOR';
    return categoryOf(p)?.key === category;
  };

  const items = (popular.data?.items ?? []).filter((i) => matches(i.place));
  const emptyText =
    popular.data?.emptyReason === 'COLLECTING'
      ? '방문 기록이 모이면 인기 탐험지를 보여드려요'
      : popular.isPending
        ? '불러오는 중…'
        : popular.isError
          ? '인기 탐험지를 불러오지 못했어요'
          : '이 카테고리의 인기 장소가 아직 없어요';

  return (
    <section className={styles.popular}>
      <div className={styles.popularHead}>
        <h2 className={styles.sectionTitle}>인기 탐험지</h2>
        <span className={styles.popularCount}>카테고리별 15곳</span>
      </div>

      <div className={styles.categories}>
        {CATEGORIES.map((c) => (
          <Chip key={c.key} variant="gray" selected={category === c.key} onClick={() => setCategory(c.key)}>
            {c.label}
          </Chip>
        ))}
      </div>

      {items.length > 0 ? (
        <ul className={styles.places}>
          {items.map(({ place }) => (
            <li key={place.id}>
              <Link className={styles.place} to={toPlaceUrl(place.id, { source: 'POPULAR' })}>
                {place.thumbnailUrl ? (
                  <img className={styles.placeThumb} src={place.thumbnailUrl} alt="" loading="lazy" />
                ) : (
                  <span className={styles.placeThumb} aria-hidden />
                )}
                <p className={styles.placeName}>{place.name}</p>
                <p className={styles.placeSub}>
                  {[districtLabel(place.districtCode), categoryOf(place)?.label ?? ENVIRONMENT_LABEL[place.environment]]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.placesEmpty}>{emptyText}</p>
      )}
    </section>
  );
}
