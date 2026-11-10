import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import FlowScreen, { flow } from '../../components/FlowScreen';
import LoadError from '../../components/LoadError';
import medalIcon from '../../assets/icon-medal.svg';
import photoIcon from '../../assets/icon-photo.svg';
import checkIcon from '../../assets/icon-check.svg';
import { useAuth, usePatchVisit, usePlace, useReportVisit, useVisit } from '../../api/queries';
import { ApiError } from '../../api/errors';
import { arrivalMessage, useArrivalCheck } from '../../lib/geo';
import { toIsoDate } from '../../lib/format';
import { resumePath, visitPath } from '../../lib/quiz';
import styles from './VisitPhotos.module.css';

const MAX_PHOTOS = 3;

/**
 * Figma "사진 첨부-전 / 후" (방문 확정).
 * 사진 업로드 API가 아직 없어 고른 사진은 이 기기 화면에서만 보여 주고 서버로 보내지 않는다.
 * "사진 전송"·"건너뛰기"는 방문 신고(POST /visits/{id}/report)로 퀴즈를 연다.
 */
export default function VisitPhotos() {
  const navigate = useNavigate();
  const { visitId } = useParams();
  const auth = useAuth();
  const visit = useVisit(visitId);
  const place = usePlace(visit.data?.placeId);
  const report = useReportVisit();
  const patch = usePatchVisit();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  // 사진을 고르면 위치를 다시 확인한다 (Figma "사진 선택 시 위치를 자동 검증합니다")
  const [checkRound, setCheckRound] = useState(0);
  const arrival = useArrivalCheck(place.data, checkRound);

  // 화면을 떠날 때 미리보기 주소 정리
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach((url) => URL.revokeObjectURL(url)), []);

  if (auth.status === 'signedOut') return <Navigate to="/login" replace />;

  const v = visit.data;
  const busy = report.isPending || patch.isPending;

  const pickPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    const picked = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, MAX_PHOTOS - photos.length)
      .map((f) => URL.createObjectURL(f));
    if (picked.length === 0) return;
    setPhotos((prev) => [...prev, ...picked]);
    setActive(photos.length);
    setCheckRound((n) => n + 1);
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photos[index]);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setActive(0);
  };

  const fail = (e: Error) => {
    if (e instanceof ApiError && e.status === 401) navigate('/login');
    else if (e instanceof ApiError && e.status === 409)
      setMessage('이 장소 퀴즈를 아직 준비 중이에요. 잠시 후 다시 시도해 주세요.');
    else setMessage(e.message);
  };

  /** 방문 신고 → 퀴즈 시작. 예정일이 오늘이 아니라서 막히면 오늘로 바꾼 뒤 한 번 더 */
  const start = () => {
    if (!v) return;
    if (v.status !== 'PLANNED') {
      navigate(resumePath(v), { replace: true });
      return;
    }
    setMessage(null);
    const goQuiz = () => navigate(visitPath.episode(v.id), { replace: true });
    const today = toIsoDate(new Date());
    report.mutate(v.id, {
      onSuccess: goQuiz,
      onError: (e) => {
        if (e instanceof ApiError && e.status === 409 && v.plannedDate !== today) {
          patch.mutate(
            { visitId: v.id, plannedDate: today },
            { onSuccess: () => report.mutate(v.id, { onSuccess: goQuiz, onError: fail }), onError: fail },
          );
        } else fail(e);
      },
    });
  };

  const hasPhotos = photos.length > 0;

  return (
    <FlowScreen
      title="사진 추가"
      message={message}
      footer={
        hasPhotos ? (
          <button type="button" className={flow.primary} onClick={start} disabled={!v || busy}>
            {busy ? '잠시만요…' : '사진 전송'}
          </button>
        ) : (
          <div className={flow.row}>
            <button type="button" className={flow.secondary} onClick={start} disabled={!v || busy}>
              건너뛰기
            </button>
            <button type="button" className={flow.primary} onClick={() => fileInput.current?.click()} disabled={busy}>
              사진 선택
            </button>
          </div>
        )
      }
    >
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          pickPhotos(e.target.files);
          e.target.value = '';
        }}
      />

      {visit.isError ? (
        <div className={styles.error}>
          <LoadError message={visit.error.message} onRetry={() => visit.refetch()} />
        </div>
      ) : (
        <>
          <p className={styles.chip}>
            <img src={medalIcon} width={14} height={14} alt="" />
            {v ? `${v.placeName} 미션` : '탐험 미션'}
          </p>
          <h1 className={styles.title}>
            오늘 촬영한 사진 중 가장
            <br />
            마음에 드는 3장을 골라주세요!
          </h1>
          <p className={styles.sub}>오늘 현장의 기억을 나만의 탐험 퀴즈에 담아드려요.</p>

          {hasPhotos ? (
            <>
              <div className={styles.preview}>
                <img src={photos[active] ?? photos[0]} alt="고른 현장 사진" />
              </div>
              <ul className={styles.thumbs}>
                {photos.map((url, i) => (
                  <li key={url}>
                    <button
                      type="button"
                      className={`${styles.thumb} ${i === active ? styles.thumbOn : ''}`}
                      onClick={() => setActive(i)}
                      aria-label={`${i + 1}번째 사진 보기`}
                    >
                      <img src={url} alt="" />
                    </button>
                    <button
                      type="button"
                      className={styles.remove}
                      onClick={() => removePhoto(i)}
                      aria-label={`${i + 1}번째 사진 빼기`}
                    >
                      ×
                    </button>
                  </li>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <li>
                    <button
                      type="button"
                      className={`${styles.thumb} ${styles.add}`}
                      onClick={() => fileInput.current?.click()}
                      aria-label="사진 더 고르기"
                    >
                      +
                    </button>
                  </li>
                )}
              </ul>
              <p className={styles.local}>사진은 이 기기에만 보관돼요 · {arrivalMessage(arrival)}</p>
            </>
          ) : (
            <>
              <button type="button" className={styles.drop} onClick={() => fileInput.current?.click()}>
                <span className={styles.dropCircle}>
                  <img src={photoIcon} width={32} height={32} alt="" />
                </span>
                <strong className={styles.dropTitle}>앨범에서 사진 선택</strong>
                <span className={styles.dropSub}>터치하여 현장 사진을 업로드 하세요</span>
              </button>
              <div className={styles.gps}>
                <img src={checkIcon} width={24} height={24} alt="" />
                <p>
                  <strong>GPS 위치 인증 상태</strong>
                  <br />
                  {arrival.status === 'checking' ? '사진 선택 시 위치를 자동 검증합니다.' : arrivalMessage(arrival)}
                </p>
              </div>
            </>
          )}
        </>
      )}
    </FlowScreen>
  );
}
