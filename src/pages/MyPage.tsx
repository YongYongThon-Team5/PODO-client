import { useMemo, useRef, useState, type UIEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Gnb from '../components/Gnb';
import foxHello from '../assets/fox-hello.png';
import { logout } from '../api/auth';
import {
  useAllPlaces,
  useAuth,
  useChildProfiles,
  useCompletedPlaces,
  useCompletedVisits,
  usePatchChildProfile,
  useProfileImageUrl,
  useProfileOptions,
  useUploadProfileImage,
  type ChildProfile,
  type CompletedPlace,
} from '../api/queries';
import { formatDotDate, toIsoDate } from '../lib/format';
import { childColorHex } from '../lib/childColors';
import { readPrefs, writePrefs } from '../lib/prefs';
import { visitPath } from '../lib/quiz';
import { useScrollMemory } from '../hooks/useScrollMemory';
import styles from './MyPage.module.css';

const CARDS_PER_PAGE = 4;

/** Figma "마이"(11.11): 제목 → 프로필(전환 · 아이 프로필 · 위치권한 · 맞춤장소) → 탐험 카드 4장씩 → 로그아웃 · 회원탈퇴 */
export default function MyPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const auth = useAuth();
  const profiles = useChildProfiles();
  const options = useProfileOptions();
  const completed = useCompletedPlaces();
  const visits = useCompletedVisits();
  const places = useAllPlaces();
  const [editing, setEditing] = useState(false);
  const [page, setPage] = useState(0);
  const [childId, setChildId] = useState<string | null>(() => readPrefs().childProfileId ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  // 탐험 카드에서 결과를 보고 돌아오면 보던 쪽 그대로
  const scrollRef = useScrollMemory<HTMLDivElement>();
  const pagesRef = useScrollMemory<HTMLDivElement>('cards');

  const list = profiles.data ?? [];
  const child = list.find((p) => p.id === childId) ?? list[0];
  // 프로필 사진 테두리: 아이 색 (Figma 색 기준)
  const ring = childColorHex(child?.colorCode, options.data?.colors?.find((c) => c.code === child?.colorCode)?.hex);
  const photo = useProfileImageUrl(child?.profileImageId);

  const cards = completed.data?.items ?? [];
  const pages = Math.max(1, Math.ceil(cards.length / CARDS_PER_PAGE));
  const placeById = useMemo(() => new Map((places.data ?? []).map((p) => [p.id, p])), [places.data]);
  // 장소별 가장 최근 완료 방문 (카드 → 탐험 결과)
  const visitByPlace = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of visits.data ?? []) if (!map.has(v.placeId)) map.set(v.placeId, v.id);
    return map;
  }, [visits.data]);

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setPage(Math.round(el.scrollLeft / el.clientWidth));
  };

  /** 전환: 아이가 여럿이면 다음 아이로, 한 명이면 아이 추가 */
  const switchChild = () => {
    if (list.length < 2) {
      navigate('/signup');
      return;
    }
    const next = list[(list.findIndex((p) => p.id === child?.id) + 1) % list.length];
    setChildId(next.id);
    writePrefs({ childProfileId: next.id });
  };

  const signOut = async () => {
    await logout();
    qc.clear();
    navigate('/login', { replace: true });
  };

  if (auth.status === 'signedOut') {
    return (
      <main className="screen">
        <h1 className={styles.pageTitle}>마이페이지</h1>
        <div className={styles.signedOut}>
          <img src={foxHello} width={80} height={80} alt="" />
          <p>로그인하면 우리 아이 탐험 카드를 모아 볼 수 있어요</p>
          <button type="button" className={styles.loginButton} onClick={() => navigate('/login')}>
            로그인하기
          </button>
        </div>
        <Gnb />
      </main>
    );
  }

  return (
    <main className="screen">
      <h1 className={styles.pageTitle}>마이페이지</h1>
      <div className={styles.scroll} ref={scrollRef}>
        <section className={styles.profile}>
          <span className={styles.avatar} style={{ borderColor: ring, boxShadow: `0 0 10px ${ring}` }}>
            {photo ? <img src={photo} alt="" /> : <UserIcon />}
          </span>
          <div className={styles.profileText}>
            <div className={styles.nameRow}>
              <strong>{child ? `${child.nickname} 대원` : profiles.isPending ? '…' : '탐험 대원'}</strong>
              <button type="button" className={styles.switch} onClick={switchChild}>
                전환
              </button>
            </div>
            <nav className={styles.links} aria-label="바로가기">
              <button type="button" onClick={() => child && setEditing(true)} disabled={!child}>
                아이 프로필 <Chevron />
              </button>
              <Link to="/location">
                위치권한 <Chevron />
              </Link>
              <Link to="/conditions">
                맞춤장소 <Chevron />
              </Link>
            </nav>
          </div>
        </section>

        <h2 className={styles.cardsTitle}>탐험 카드</h2>
        <div className={styles.pages} onScroll={onScroll} ref={pagesRef}>
          {Array.from({ length: pages }, (_, i) => {
            const slice = cards.slice(i * CARDS_PER_PAGE, (i + 1) * CARDS_PER_PAGE);
            return (
              <ul key={i} className={styles.grid}>
                {slice.map((c) => (
                  <li key={c.placeId}>
                    <ExploreCard
                      place={c}
                      thumbnail={placeById.get(c.placeId)?.thumbnailUrl ?? null}
                      activity={placeById.get(c.placeId)?.mainActivities[0] ?? null}
                      visitId={visitByPlace.get(c.placeId)}
                    />
                  </li>
                ))}
                {Array.from({ length: CARDS_PER_PAGE - slice.length }, (_, k) => (
                  <li key={`empty-${k}`}>
                    <div className={`${styles.card} ${styles.cardEmpty}`}>
                      <span className={styles.cardImage}>?</span>
                      <span className={styles.cardActivity}>
                        {cards.length === 0 && k === 0 ? '첫 탐험을 떠나 볼까요?' : '다음 탐험 카드'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            );
          })}
        </div>
        <ol className={styles.dots} aria-label={`탐험 카드 ${pages}쪽 중 ${page + 1}쪽`}>
          {Array.from({ length: Math.max(pages, 3) }, (_, i) => (
            <li key={i} className={i === page ? styles.dotOn : undefined} />
          ))}
        </ol>

        <div className={styles.fill} />
        {notice && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}
        <div className={styles.account}>
          <button type="button" onClick={signOut}>
            로그아웃
          </button>
          {/* 회원탈퇴 API가 아직 없어 안내만 한다 */}
          <button type="button" onClick={() => setNotice('회원탈퇴는 아직 준비 중이에요.')}>
            회원탈퇴
          </button>
        </div>
      </div>
      <Gnb />

      {editing && child && <ProfileSheet child={child} photo={photo} onClose={() => setEditing(false)} />}
    </main>
  );
}

function ExploreCard({
  place,
  thumbnail,
  activity,
  visitId,
}: {
  place: CompletedPlace;
  thumbnail: string | null;
  activity: string | null;
  visitId?: string;
}) {
  return (
    <Link className={styles.card} to={visitId ? visitPath.complete(visitId) : `/map?place=${place.placeId}`}>
      {thumbnail ? <img className={styles.cardImage} src={thumbnail} alt="" /> : <span className={styles.cardImage} />}
      <span className={styles.cardPlace}>{place.name}</span>
      {activity && <span className={styles.cardActivity}>{activity}</span>}
      <span className={styles.cardDate}>{formatDotDate(toIsoDate(new Date(place.lastCompletedAt)))}</span>
    </Link>
  );
}

/** 아이 프로필: 사진(업로드 → profileImageId) · 이름 */
function ProfileSheet({ child, photo, onClose }: { child: ChildProfile; photo: string | null; onClose: () => void }) {
  const patch = usePatchChildProfile();
  const upload = useUploadProfileImage();
  const fileInput = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState(child.nickname);
  const [message, setMessage] = useState<string | null>(null);
  const busy = patch.isPending || upload.isPending;

  const save = (body: Parameters<typeof patch.mutate>[0]['body'], done?: () => void) => {
    setMessage(null);
    patch.mutate({ profileId: child.id, body }, { onSuccess: () => done?.(), onError: (e) => setMessage(e.message) });
  };

  const changePhoto = (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    upload.mutate(file, {
      onSuccess: (img) => save({ profileImageId: img.imageId }),
      onError: (e) => setMessage(e.message),
    });
  };

  const submit = () => {
    const name = nickname.trim();
    if (!name) {
      setMessage('이름을 적어 주세요.');
      return;
    }
    if (name === child.nickname) onClose();
    else save({ nickname: name }, onClose);
  };

  return (
    <div className={styles.dim} onClick={onClose} role="presentation">
      <section
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="아이 프로필"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={styles.sheetTitle}>아이 프로필</h2>

        <div className={styles.photoRow}>
          <span className={`${styles.avatar} ${styles.avatarBig}`}>{photo ? <img src={photo} alt="" /> : <UserIcon />}</span>
          <div className={styles.photoButtons}>
            <button type="button" onClick={() => fileInput.current?.click()} disabled={busy}>
              {upload.isPending ? '올리는 중…' : '사진 바꾸기'}
            </button>
            {child.profileImageId && (
              <button type="button" onClick={() => save({ profileImageId: null })} disabled={busy}>
                사진 지우기
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              changePhoto(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>

        <label className={styles.field}>
          <span>이름</span>
          <input value={nickname} maxLength={30} onChange={(e) => setNickname(e.target.value)} />
        </label>

        {message && (
          <p className={styles.sheetMessage} role="alert">
            {message}
          </p>
        )}

        <button type="button" className={styles.save} onClick={submit} disabled={busy}>
          {patch.isPending ? '저장 중…' : '저장'}
        </button>
      </section>
    </div>
  );
}

/** Figma "User_fill" 아이콘 (28) */
function UserIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 23 23" aria-hidden>
      <circle cx="11.5" cy="7.5" r="5" fill="#c1f1f9" />
      <path d="M2.9 20.6c.8-3.7 4.4-6.1 8.6-6.1s7.8 2.4 8.6 6.1c.1.5-.3.9-.8.9H3.7c-.5 0-.9-.4-.8-.9Z" fill="#c1f1f9" />
    </svg>
  );
}

/** 바로가기 화살표 4x8 */
function Chevron() {
  return (
    <svg width="5" height="9" viewBox="0 0 5 9" aria-hidden>
      <path d="M.6.6 4.2 4.5.6 8.4" fill="none" stroke="#4f2c02" strokeOpacity="0.8" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
