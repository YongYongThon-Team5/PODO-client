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
import { visitPath } from '../lib/quiz';
import styles from './MyPage.module.css';

const CARDS_PER_PAGE = 4;

/** 다녀온 곳 수 → 레벨 (Figma 예시 "LV.3 아기 탐험가") */
function level(completed: number) {
  const lv = Math.min(completed + 1, 10);
  const title = lv <= 3 ? '아기 탐험가' : lv <= 6 ? '꼬마 탐험가' : '용인 탐험대장';
  return `LV.${lv} ${title}`;
}

/** Figma "마이": 프로필 → 여우 카드 → 탐험 카드 (4장씩 넘겨 보기) */
export default function MyPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const profiles = useChildProfiles();
  const options = useProfileOptions();
  const completed = useCompletedPlaces();
  const visits = useCompletedVisits();
  const places = useAllPlaces();
  const [editing, setEditing] = useState(false);
  const [page, setPage] = useState(0);

  const child = profiles.data?.[0];
  const color = options.data?.colors?.find((c) => c.code === child?.colorCode)?.hex ?? '#ffefe4';
  const photo = useProfileImageUrl(child?.profileImageId);
  const count = completed.data?.summary.completedPlaceCount ?? 0;

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

  if (auth.status === 'signedOut') {
    return (
      <main className="screen">
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
    <main className={`screen ${styles.screen}`}>
      <div className={styles.scroll}>
        <button
          type="button"
          className={styles.profile}
          onClick={() => child && setEditing(true)}
          disabled={!child}
          aria-label="프로필 수정"
        >
          <span className={styles.avatar} style={{ background: color }}>
            {photo ? <img src={photo} alt="" /> : <UserIcon />}
          </span>
          <span className={styles.profileText}>
            <span className={styles.nameRow}>
              <strong>{child ? `${child.nickname} 대원` : profiles.isPending ? '…' : '탐험 대원'}</strong>
              <span className={styles.level}>{level(count)}</span>
            </span>
            <span className={styles.bio}>용인시 구석구석 역사와 자연을 기록중!</span>
          </span>
        </button>

        <Link to="/conditions" className={styles.invite}>
          <img src={foxHello} width={53} height={53} alt="" />
          <span>같이 멋진 모험을 떠나보지 않을래?</span>
        </Link>

        <h2 className={styles.cardsTitle}>탐험 카드</h2>
        <div className={styles.pages} onScroll={onScroll}>
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
                      <span className={styles.cardName}>
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
  const body = (
    <>
      {thumbnail ? <img className={styles.cardImage} src={thumbnail} alt="" /> : <span className={styles.cardImage} />}
      <span className={styles.cardName}>{place.name}</span>
      {activity && <span className={styles.cardActivity}>{activity}</span>}
      <span className={styles.cardDate}>{formatDotDate(toIsoDate(new Date(place.lastCompletedAt)))}</span>
    </>
  );
  return visitId ? (
    <Link className={styles.card} to={visitPath.complete(visitId)}>
      {body}
    </Link>
  ) : (
    <Link className={styles.card} to={`/map?place=${place.placeId}`}>
      {body}
    </Link>
  );
}

/** 프로필 수정: 사진(업로드 → profileImageId) · 이름 · 로그아웃 */
function ProfileSheet({ child, photo, onClose }: { child: ChildProfile; photo: string | null; onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const patch = usePatchChildProfile();
  const upload = useUploadProfileImage();
  const fileInput = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState(child.nickname);
  const [message, setMessage] = useState<string | null>(null);
  const busy = patch.isPending || upload.isPending;

  const save = (body: Parameters<typeof patch.mutate>[0]['body'], done?: () => void) => {
    setMessage(null);
    patch.mutate(
      { profileId: child.id, body },
      { onSuccess: () => done?.(), onError: (e) => setMessage(e.message) },
    );
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

  const signOut = async () => {
    await logout();
    qc.clear();
    navigate('/login', { replace: true });
  };

  return (
    <div className={styles.dim} onClick={onClose} role="presentation">
      <section
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="프로필 수정"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={styles.sheetTitle}>프로필 수정</h2>

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
        <button type="button" className={styles.logout} onClick={signOut}>
          로그아웃
        </button>
      </section>
    </div>
  );
}

/** Figma "User_fill" 아이콘 */
function UserIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 23 23" aria-hidden>
      <circle cx="11.5" cy="7.5" r="5" fill="#ffffff" />
      <path d="M2.9 20.6c.8-3.7 4.4-6.1 8.6-6.1s7.8 2.4 8.6 6.1c.1.5-.3.9-.8.9H3.7c-.5 0-.9-.4-.8-.9Z" fill="#ffffff" />
    </svg>
  );
}
