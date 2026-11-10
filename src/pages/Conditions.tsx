import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ActionButtons from '../components/ActionButtons';
import Chip, { ChipGroup } from '../components/Chip';
import Gnb from '../components/Gnb';
import LoadError from '../components/LoadError';
import PageHeader from '../components/PageHeader';
import calendarIcon from '../assets/icon-calendar.svg';
import { useChildProfiles, useRecommendationOptions } from '../api/queries';
import { formatDotDate, toIsoDate, upcomingSaturday } from '../lib/format';
import { readPrefs } from '../lib/prefs';
import styles from './Conditions.module.css';

export type RecommendSearch = { date: string; purpose: string; district?: string | null; child?: string | null };

export function toRecommendUrl(s: RecommendSearch) {
  const q = new URLSearchParams({ date: s.date, purpose: s.purpose });
  if (s.district) q.set('district', s.district);
  if (s.child) q.set('child', s.child);
  return `/recommend?${q}`;
}

/** Figma "맞춤 장소 검색" (상단 제목 "맞춤 장소") */
export default function Conditions() {
  const navigate = useNavigate();
  const options = useRecommendationOptions();
  const profiles = useChildProfiles();
  const [date, setDate] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(readPrefs().districtCode ?? null);
  const [purpose, setPurpose] = useState<string | null>(null);
  const [childId, setChildId] = useState<string | null>(null);

  const children = profiles.data ?? [];
  const child = childId ?? children[0]?.id ?? null;
  const purposes = (options.data?.purposes ?? []).filter((p) => p.active);
  const districts = (options.data?.districts ?? []).filter((d) => d.active);

  const submit = () => {
    if (!date || !purpose) return;
    navigate(toRecommendUrl({ date, purpose, district, child }));
  };

  // 건너뛰기: 이번 주말, 첫 번째 목적으로 바로 추천
  const skip = () => {
    const first = purposes[0]?.code;
    if (!first) return;
    navigate(toRecommendUrl({ date: date ?? upcomingSaturday(), purpose: purpose ?? first, district, child }));
  };

  return (
    <main className="screen">
      <PageHeader
        title="맞춤 장소"
        action={
          <button type="button" className={styles.addChild} onClick={() => navigate('/signup')}>
            + 아이 추가하기
          </button>
        }
      />

      <div className={styles.scroll}>
        <div className={styles.content}>
          {options.isError && (
            <div className={styles.loadError}>
              <LoadError message="방문 지역·목적 목록을 불러오지 못했어요." onRetry={() => options.refetch()} />
            </div>
          )}
          <h2 className={styles.title}>누구와 나들이 가나요?</h2>
          <p className={styles.sub}>입력할수록 추천이 정확해져요</p>

          {children.length > 1 && (
            <div className={styles.children}>
              <ChipGroup>
                {children.map((c) => (
                  <Chip key={c.id} selected={child === c.id} onClick={() => setChildId(c.id)}>
                    {c.nickname}
                  </Chip>
                ))}
              </ChipGroup>
            </div>
          )}

          <label className={styles.dateLabel} htmlFor="visit-date">
            방문 날짜
          </label>
          <div className={styles.dateBox}>
            <span className={styles.dateText}>{date ? formatDotDate(date) : 'YYYY.MM.DD'}</span>
            <img src={calendarIcon} width={24} height={24} alt="" />
            {/* 투명한 기본 날짜 입력을 위에 덮어서 어떤 기기에서도 기본 달력이 열리게 */}
            <input
              id="visit-date"
              type="date"
              className={styles.dateInput}
              min={toIsoDate(new Date())}
              value={date ?? ''}
              onChange={(e) => setDate(e.target.value || null)}
            />
          </div>

          <section className={styles.group}>
            <h3 className={styles.label}>방문지역</h3>
            <ChipGroup>
              {districts.map((d) => (
                <Chip key={d.code} selected={district === d.code} onClick={() => setDistrict(district === d.code ? null : d.code)}>
                  {d.label}
                </Chip>
              ))}
            </ChipGroup>
          </section>

          <section className={styles.group}>
            <h3 className={styles.label}>방문 목적</h3>
            <ChipGroup>
              {purposes.map((p) => (
                <Chip key={p.code} selected={purpose === p.code} onClick={() => setPurpose(p.code)}>
                  {p.label}
                </Chip>
              ))}
            </ChipGroup>
          </section>
        </div>

        <div className={styles.bottom}>
          {(!date || !purpose) && <p className={styles.hint}>방문 날짜와 목적을 고르면 추천해 드려요</p>}
          <ActionButtons
            primary="완료"
            secondary="건너뛰기"
            onPrimary={submit}
            onSecondary={skip}
            primaryDisabled={!date || !purpose}
          />
        </div>
      </div>

      <Gnb />
    </main>
  );
}
