import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import FlowScreen, { flow } from '../../components/FlowScreen';
import LoadError from '../../components/LoadError';
import LoadingScreen from '../../components/LoadingScreen';
import medalIcon from '../../assets/icon-medal.svg';
import photoIcon from '../../assets/icon-photo.svg';
import checkIcon from '../../assets/icon-check.svg';
import {
  observationSettled,
  observationSucceeded,
  useAuth,
  useLatestObservation,
  useObservation,
  usePatchVisit,
  usePlace,
  useReportVisit,
  useRetryObservation,
  useUploadObservation,
  useVisit,
  type Visit,
  type Observation,
} from '../../api/queries';
import { ApiError } from '../../api/errors';
import { useLoadingProgress } from '../../hooks/useLoadingProgress';
import { arrivalMessage, useArrivalCheck } from '../../lib/geo';
import { toIsoDate } from '../../lib/format';
import { resumePath, visitPath } from '../../lib/quiz';
import styles from './VisitPhotos.module.css';

const MAX_PHOTOS = 3;
/** 사진으로 퀴즈 소개를 만드는 데 이보다 오래 걸리면 기다리지 않고 고를 수 있게 한다 */
const GENERATION_WAIT_MS = 45_000;

type Photo = { url: string; file: File };

/**
 * Figma "사진 첨부-전 / 후" (방문 확정) → 로딩(이 장소 퀴즈를 불러오는 중) → 에피소드 소개.
 * - 사진 전송: 관찰 사진 업로드(POST /visits/{id}/observations) → 생성이 끝날 때까지 상태 확인 → 방문 신고(report)
 * - 건너뛰기: 바로 방문 신고
 */
export default function VisitPhotos() {
  const { visitId } = useParams();
  if (!visitId) return <Navigate to="/mission" replace />;
  return <PhotoFlow key={visitId} visitId={visitId} />;
}

function PhotoFlow({ visitId }: { visitId: string }) {
  const navigate = useNavigate();
  const auth = useAuth();
  const visit = useVisit(visitId);
  // 에피소드 소개·탐험 시작과 같은 키(오늘 날씨 포함)로 받아 한 번만 요청
  const place = usePlace(visit.data?.placeId, toIsoDate(new Date()));
  const report = useReportVisit();
  const patch = usePatchVisit();
  const upload = useUploadObservation();
  const retry = useRetryObservation();
  const fileInput = useRef<HTMLInputElement>(null);
  // 다시 보내도 같은 업로드로 처리되게 (고른 사진이 바뀌면 새 키)
  const uploadKey = useRef(crypto.randomUUID());
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [active, setActive] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploaded, setUploaded] = useState<Observation | null>(null);
  const [checkRoundAfterWait, setCheckRoundAfterWait] = useState(0);
  const [waitedTooLong, setWaitedTooLong] = useState(false);
  // 사진을 고르면 위치를 다시 확인한다 (Figma "사진 선택 시 위치를 자동 검증합니다")
  const [checkRound, setCheckRound] = useState(0);
  const arrival = useArrivalCheck(place.data, checkRound);

  const latest = useLatestObservation(visit.data?.status === 'PLANNED' ? visitId : undefined);
  const observationId = uploaded?.id ?? latest.data?.id ?? null;
  const observation = useObservation(visitId, observationId);
  const obs = observation.data ?? uploaded ?? latest.data ?? undefined;
  const recovering = visit.data?.status === 'PLANNED' && !uploaded && (latest.isPending || latest.isFetching);
  const generated = observationSucceeded(obs);
  const settled = observationSettled(obs) || waitedTooLong || observation.isError;
  const progress = useLoadingProgress(!!observationId && settled);

  // 화면을 떠날 때 미리보기 주소 정리
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  // 생성이 너무 오래 걸리면 기다리지 않고 고를 수 있게
  useEffect(() => {
    if (!observationId) return;
    setWaitedTooLong(false);
    const t = setTimeout(() => setWaitedTooLong(true), GENERATION_WAIT_MS);
    return () => clearTimeout(t);
  }, [observationId, obs?.attemptCount, checkRoundAfterWait]);

  const v = visit.data;
  const busy = recovering || sending || report.isPending || patch.isPending || upload.isPending || retry.isPending;
  const today = toIsoDate(new Date());

  const fail = (e: Error) => {
    if (e instanceof ApiError && e.status === 401) navigate('/login');
    else if (e instanceof ApiError && e.code === 'QUIZ_NOT_READY')
      setMessage('이 장소 퀴즈를 아직 준비 중이에요. 잠시 후 상태를 다시 확인해 주세요.');
    else setMessage(e.message);
  };

  /** 아직 방문 예정이면 신고해서 퀴즈를 연다 (예정일이 오늘이 아니면 먼저 오늘로) */
  const ensureReported = async (cur: Visit) => {
    if (cur.status !== 'PLANNED') return cur;
    const dated = cur.plannedDate === today ? cur : await patch.mutateAsync({ visitId: cur.id, plannedDate: today });
    return report.mutateAsync(dated.id);
  };

  const goQuiz = (id: string) => navigate(visitPath.episode(id), { replace: true });

  // 사진으로 만들기가 끝나면 바로 퀴즈로
  const doneRef = useRef(false);
  useEffect(() => {
    if (!v || v.status !== 'PLANNED' || recovering || !observationId || !generated || message || doneRef.current) return;
    doneRef.current = true;
    ensureReported(v)
      .then((cur) => goQuiz(cur.id))
      .catch((e: Error) => {
        fail(e);
      });
    // 끝난 순간 한 번만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generated, observationId, v, recovering, message]);

  if (auth.status === 'signedOut') return <Navigate to="/login" replace />;

  const pickPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    const picked = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, MAX_PHOTOS - photos.length)
      .map((file) => ({ url: URL.createObjectURL(file), file }));
    if (picked.length === 0) return;
    uploadKey.current = crypto.randomUUID();
    setPhotos((prev) => [...prev, ...picked]);
    setActive(photos.length);
    setCheckRound((n) => n + 1);
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photos[index].url);
    uploadKey.current = crypto.randomUUID();
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setActive(0);
  };

  /** 건너뛰기 / 사진 없이 시작: 바로 방문 신고 → 퀴즈 */
  const skip = async () => {
    if (!v || busy) return;
    if (v.status !== 'PLANNED' && !observationId) {
      navigate(resumePath(v), { replace: true });
      return;
    }
    setMessage(null);
    setSending(true);
    try {
      // 다른 탭이나 새로고침 전에 접수된 작업이 있으면 먼저 복구한다.
      const current = await latest.refetch();
      if (current.isError) throw current.error;
      if (current.data) {
        setUploaded(current.data);
        return;
      }
      goQuiz((await ensureReported(v)).id);
    } catch (e) {
      fail(e as Error);
    } finally {
      setSending(false);
    }
  };

  /** 사진 전송: 관찰 사진 업로드 (생성 상태 확인과 퀴즈 이동은 위 effect) */
  const send = async () => {
    if (!v || v.status !== 'PLANNED' || busy || observationId || latest.isError || photos.length === 0) return;
    setMessage(null);
    setSending(true);
    const files = photos.map((p) => p.file);
    try {
      const cur =
        v.status === 'PLANNED' && v.plannedDate !== today
          ? await patch.mutateAsync({ visitId: v.id, plannedDate: today })
          : v;
      const o = await upload.mutateAsync({ visitId: cur.id, files, key: uploadKey.current });
      setUploaded(o);
    } catch (e) {
      fail(e as Error);
      // 409나 응답 유실 때 report를 호출하지 않는다. 서버의 기존 작업을 조회한다.
      if (!(e instanceof ApiError && e.status === 401)) {
        const current = await latest.refetch();
        if (current.data) {
          setUploaded(current.data);
          setMessage(null);
        }
        await visit.refetch();
      }
    } finally {
      setSending(false);
    }
  };

  const retryGeneration = () => {
    if (!v || !obs?.retryAvailable || busy) return;
    setMessage(null);
    doneRef.current = false;
    retry.mutate({ visitId: v.id, observation: obs }, {
      onSuccess: (o) => {
        setUploaded(o);
        setWaitedTooLong(false);
        setCheckRoundAfterWait((n) => n + 1);
      },
      onError: fail,
    });
  };

  const refreshGeneration = async () => {
    setSending(true);
    try {
      const current = await observation.refetch();
      if (current.isError) throw current.error;
      if (current.data) setUploaded(current.data);
      doneRef.current = false;
      setMessage(null);
      setWaitedTooLong(false);
      setCheckRoundAfterWait((n) => n + 1);
      await visit.refetch();
    } catch (e) {
      fail(e as Error);
    } finally {
      setSending(false);
    }
  };

  if (v && v.status !== 'PLANNED') return <Navigate to={resumePath(v)} replace />;
  if (visit.isError || (!uploaded && latest.isError)) {
    const error = visit.error ?? latest.error;
    return (
      <FlowScreen title="사진 추가">
        <LoadError message={error?.message ?? '방문 정보를 확인하지 못했어요.'} onRetry={() => {
          if (visit.isError) void visit.refetch();
          else void latest.refetch();
        }} />
      </FlowScreen>
    );
  }
  if (!v || recovering || (observationId && !message && (!settled || generated))) {
    return <LoadingScreen type="quiz" progress={generated ? 100 : progress} />;
  }

  // 실패·지연·공개 대기에는 기존 버튼으로 상태 확인과 허용된 재시도만 제공한다.
  if (observationId) {
    return (
      <FlowScreen
        title="사진 추가"
        message={message ?? observation.error?.message}
        footer={
          <div className={flow.row}>
            <button type="button" className={flow.secondary} onClick={refreshGeneration} disabled={busy}>
              상태 다시 확인
            </button>
            <button type="button" className={flow.primary} onClick={retryGeneration} disabled={busy || !obs?.retryAvailable}>
              {retry.isPending ? '잠시만요…' : '다시 시도'}
            </button>
          </div>
        }
      >
        <div className={styles.failed}>
          <h1 className={styles.title}>
            {obs?.generationStatus === 'FAILED'
              ? '사진으로 퀴즈를 만들지 못했어요'
              : obs?.generationStatus === 'READY'
                ? '퀴즈 시작을 준비하고 있어요'
                : '사진을 살펴보는 데 시간이 걸려요'}
          </h1>
          <p className={styles.sub}>
            {obs?.retryAvailable
              ? '다시 시도하거나 현재 상태를 확인해 주세요.'
              : '잠시 후 상태를 다시 확인해 주세요.'}
          </p>
        </div>
      </FlowScreen>
    );
  }

  const hasPhotos = photos.length > 0;

  return (
    <FlowScreen
      title="사진 추가"
      message={message}
      footer={
        hasPhotos ? (
          <button type="button" className={flow.primary} onClick={send} disabled={!v || busy}>
            {busy ? '보내는 중…' : '사진 전송'}
          </button>
        ) : (
          <div className={flow.row}>
            <button type="button" className={flow.secondary} onClick={skip} disabled={!v || busy}>
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
                <img src={(photos[active] ?? photos[0]).url} alt="고른 현장 사진" />
              </div>
              <ul className={styles.thumbs}>
                {photos.map(({ url }, i) => (
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
              <p className={styles.local}>{arrivalMessage(arrival)}</p>
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
    </FlowScreen>
  );
}
