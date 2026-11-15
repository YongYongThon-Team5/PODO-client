import { useCallback, useEffect, useRef, useState } from 'react';
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
  usePrefetchQuiz,
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
/** 사진 AI 퀴즈 생성을 로딩 화면으로 기다리는 최대 시간. 서버 Gemini 대기(90초)보다 조금 길게 둔다 */
const GENERATION_WAIT_MS = 100_000;
/** AI 생성은 보통 이 정도 걸린다고 보고 로딩 바를 채운다 */
const GENERATION_EXPECTED_MS = 30_000;
/** 생성 단계별 로딩 바 시작점 */
const GENERATION_FLOOR: Record<string, number> = {
  UPLOADED: 20,
  GENERATING: 35,
  // 생성이 끝나도 방문 기록·퀴즈 불러오기가 남아 있다
  READY: 80,
};

type Photo = {
  url: string;
  file: File;
};

export default function VisitPhotos() {
  const { visitId } = useParams();

  if (!visitId) {
    return <Navigate to="/mission" replace />;
  }

  return <PhotoFlow key={visitId} visitId={visitId} />;
}

function PhotoFlow({ visitId }: { visitId: string }) {
  const navigate = useNavigate();
  const auth = useAuth();
  const visit = useVisit(visitId);

  const place = usePlace(
    visit.data?.placeId,
    toIsoDate(new Date()),
  );

  const report = useReportVisit();
  const patch = usePatchVisit();
  const upload = useUploadObservation();
  const retry = useRetryObservation();

  const fileInput = useRef<HTMLInputElement>(null);
  const uploadKey = useRef(crypto.randomUUID());

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [active, setActive] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploaded, setUploaded] = useState<Observation | null>(null);
  const [checkRoundAfterWait, setCheckRoundAfterWait] = useState(0);
  const [waitedTooLong, setWaitedTooLong] = useState(false);
  const [checkRound, setCheckRound] = useState(0);
  /** 생성·방문 기록·퀴즈까지 다 받아 에피소드 소개로 넘어갈 방문 */
  const [readyId, setReadyId] = useState<string | null>(null);
  const prefetchQuiz = usePrefetchQuiz();

  const arrival = useArrivalCheck(place.data, checkRound);

  const latest = useLatestObservation(
    visit.data?.status === 'PLANNED' ? visitId : undefined,
  );

  const observationId =
    uploaded?.id ?? latest.data?.id ?? null;

  const observation = useObservation(
    visitId,
    observationId,
  );

  const obs =
    observation.data ?? uploaded ?? latest.data ?? undefined;

  const recovering =
    visit.data?.status === 'PLANNED' &&
    !uploaded &&
    (latest.isPending || latest.isFetching);

  const generated = observationSucceeded(obs);

  const settled =
    observationSettled(obs) ||
    waitedTooLong ||
    observation.isError;

  // 서버 생성 단계에 맞춰 채운다: 사진 저장(UPLOADED) → AI 생성 중(GENERATING) → 끝(READY)
  // 아래 return에서 로딩 화면을 띄우는 조건과 같다
  const showLoading =
    !visit.data ||
    recovering ||
    (!!observationId && !message && (!settled || generated));

  // 생성이 끝나도 방문 기록과 퀴즈 3문제까지 받은 뒤에 100%를 채우고 넘어간다 (로딩을 한 번으로)
  const progress = useLoadingProgress(
    !!readyId || (!!observationId && settled && !generated),
    observationId
      ? {
          floor: GENERATION_FLOOR[obs?.generationStatus ?? ''] ?? 0,
          expectedMs: generated ? 2500 : GENERATION_EXPECTED_MS,
          active: showLoading,
        }
      : { active: showLoading },
  );

  const photosRef = useRef(photos);
  photosRef.current = photos;

  useEffect(
    () => () => {
      photosRef.current.forEach((photo) =>
        URL.revokeObjectURL(photo.url),
      );
    },
    [],
  );

  useEffect(() => {
    if (!observationId) return;

    setWaitedTooLong(false);

    const timer = setTimeout(
      () => setWaitedTooLong(true),
      GENERATION_WAIT_MS,
    );

    return () => clearTimeout(timer);
  }, [
    observationId,
    obs?.attemptCount,
    checkRoundAfterWait,
  ]);

  const v = visit.data;

  const busy =
    recovering ||
    sending ||
    report.isPending ||
    patch.isPending ||
    upload.isPending ||
    retry.isPending;

  const today = toIsoDate(new Date());

  const fail = (error: Error) => {
    if (
      error instanceof ApiError &&
      error.status === 401
    ) {
      navigate('/login');
    } else if (
      error instanceof ApiError &&
      error.code === 'QUIZ_NOT_READY' &&
      error.details?.reason === 'SOURCE_NOT_READY'
    ) {
      setMessage(
        '이 장소는 아직 사진으로 퀴즈를 만들 수 없어요',
      );
    } else if (
      error instanceof ApiError &&
      error.code === 'QUIZ_NOT_READY'
    ) {
      setMessage(
        '이 장소 퀴즈를 아직 준비 중이에요. 잠시 후 상태를 다시 확인해 주세요.',
      );
    } else {
      setMessage(error.message);
    }
  };

  const ensureReported = async (current: Visit) => {
    if (current.status !== 'PLANNED') return current;

    const dated =
      current.plannedDate === today
        ? current
        : await patch.mutateAsync({
            visitId: current.id,
            plannedDate: today,
          });

    return report.mutateAsync(dated.id);
  };

  const goQuiz = (id: string) => {
    navigate(visitPath.episode(id), { replace: true });
  };

  // 바가 100%가 되고 여우가 폴짝 뛴 다음 넘어간다 (다시 그려져도 타이머가 처음부터 돌지 않게 고정)
  const finishLoading = useCallback(() => {
    if (readyId) navigate(visitPath.episode(readyId), { replace: true });
  }, [readyId, navigate]);

  const doneRef = useRef(false);

  useEffect(() => {
    if (
      !v ||
      v.status !== 'PLANNED' ||
      recovering ||
      !observationId ||
      !generated ||
      message ||
      doneRef.current
    ) {
      return;
    }

    doneRef.current = true;

    ensureReported(v)
      .then(async (current) => {
        // 에피소드 소개가 다시 로딩 화면을 띄우지 않게 퀴즈를 미리 받는다 (실패하면 그 화면에서 다시 받는다)
        await prefetchQuiz(current.id).catch(() => undefined);
        setReadyId(current.id);
      })
      .catch((error: Error) => {
        fail(error);
      });

    // 시작 실패 후에는 사용자가 상태를 다시 확인할 때 재시도한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    generated,
    observationId,
    v,
    recovering,
    message,
  ]);

  if (auth.status === 'signedOut') {
    return <Navigate to="/login" replace />;
  }

  const pickPhotos = (files: FileList | null) => {
    if (!files?.length) return;

    const picked = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, MAX_PHOTOS - photos.length)
      .map((file) => ({
        url: URL.createObjectURL(file),
        file,
      }));

    if (picked.length === 0) return;

    uploadKey.current = crypto.randomUUID();
    setPhotos((previous) => [...previous, ...picked]);
    setActive(photos.length);
    setCheckRound((round) => round + 1);
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photos[index].url);
    uploadKey.current = crypto.randomUUID();

    setPhotos((previous) =>
      previous.filter((_, i) => i !== index),
    );

    setActive(0);
  };

  /** 관찰 작업이 없을 때만 기본 장소 퀴즈로 시작한다. */
  const skip = async () => {
    if (!v || busy) return;

    if (
      v.status !== 'PLANNED' &&
      !observationId
    ) {
      navigate(resumePath(v), { replace: true });
      return;
    }

    setMessage(null);
    setSending(true);

    try {
      const current = await latest.refetch();

      if (current.isError) throw current.error;

      if (current.data) {
        setUploaded(current.data);
        return;
      }

      goQuiz((await ensureReported(v)).id);
    } catch (error) {
      fail(error as Error);
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    if (
      !v ||
      v.status !== 'PLANNED' ||
      busy ||
      observationId ||
      latest.isError ||
      photos.length === 0
    ) {
      return;
    }

    setMessage(null);
    setSending(true);

    const files = photos.map((photo) => photo.file);

    try {
      const current =
        v.status === 'PLANNED' &&
        v.plannedDate !== today
          ? await patch.mutateAsync({
              visitId: v.id,
              plannedDate: today,
            })
          : v;

      const result = await upload.mutateAsync({
        visitId: current.id,
        files,
        key: uploadKey.current,
      });

      setUploaded(result);
    } catch (error) {
      fail(error as Error);

      // 충돌이나 응답 유실 때는 서버의 기존 작업부터 복구한다.
      if (
        !(
          error instanceof ApiError &&
          error.status === 401
        )
      ) {
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

    retry.mutate(
      {
        visitId: v.id,
        observation: obs,
      },
      {
        onSuccess: (result) => {
          setUploaded(result);
          setWaitedTooLong(false);
          setCheckRoundAfterWait((round) => round + 1);
        },
        onError: fail,
      },
    );
  };

  const refreshGeneration = async () => {
    setSending(true);

    try {
      const current = await observation.refetch();

      if (current.isError) throw current.error;

      if (current.data) {
        setUploaded(current.data);
      }

      doneRef.current = false;
      setMessage(null);
      setWaitedTooLong(false);
      setCheckRoundAfterWait((round) => round + 1);

      await visit.refetch();
    } catch (error) {
      fail(error as Error);
    } finally {
      setSending(false);
    }
  };

  if (v && v.status !== 'PLANNED') {
    return <Navigate to={resumePath(v)} replace />;
  }

  if (
    visit.isError ||
    (!uploaded && latest.isError)
  ) {
    const error = visit.error ?? latest.error;

    return (
      <FlowScreen title="사진 추가">
        <LoadError
          message={
            error?.message ??
            '방문 정보를 확인하지 못했어요.'
          }
          onRetry={() => {
            if (visit.isError) {
              void visit.refetch();
            } else {
              void latest.refetch();
            }
          }}
        />
      </FlowScreen>
    );
  }

  if (showLoading) {
    return (
      <LoadingScreen
        type="quiz"
        progress={readyId ? 100 : progress}
        onFinish={readyId ? finishLoading : undefined}
      />
    );
  }

  if (observationId) {
    return (
      <FlowScreen
        title="사진 추가"
        message={message ?? observation.error?.message}
        footer={
          <div className={flow.row}>
            <button
              type="button"
              className={flow.secondary}
              onClick={refreshGeneration}
              disabled={busy}
            >
              상태 다시 확인
            </button>

            <button
              type="button"
              className={flow.primary}
              onClick={retryGeneration}
              disabled={busy || !obs?.retryAvailable}
            >
              {retry.isPending
                ? '잠시만요…'
                : '다시 시도'}
            </button>
          </div>
        }
      >
        <div className={styles.failed}>
          <h1 className={styles.title}>
            {obs?.failureCode === 'SOURCE_NOT_READY'
              ? '이 장소는 아직 사진으로 퀴즈를 만들 수 없어요'
              : obs?.generationStatus === 'FAILED'
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
          <button
            type="button"
            className={flow.primary}
            onClick={send}
            disabled={!v || busy}
          >
            {busy ? '보내는 중…' : '사진 전송'}
          </button>
        ) : (
          <div className={flow.row}>
            <button
              type="button"
              className={flow.secondary}
              onClick={skip}
              disabled={!v || busy}
            >
              건너뛰기
            </button>

            <button
              type="button"
              className={flow.primary}
              onClick={() => fileInput.current?.click()}
              disabled={busy}
            >
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
        onChange={(event) => {
          pickPhotos(event.target.files);
          event.target.value = '';
        }}
      />

      <>
        <p className={styles.chip}>
          <img
            src={medalIcon}
            width={14}
            height={14}
            alt=""
          />
          {v ? `${v.placeName} 미션` : '탐험 미션'}
        </p>

        <h1 className={styles.title}>
          오늘 촬영한 사진 중 가장
          <br />
          마음에 드는 3장을 골라주세요!
        </h1>

        <p className={styles.sub}>
          오늘 현장의 기억을 나만의 탐험 퀴즈에 담아드려요.
        </p>

        {hasPhotos ? (
          <>
            <div className={styles.preview}>
              <img
                src={(photos[active] ?? photos[0]).url}
                alt="고른 현장 사진"
              />
            </div>

            <ul className={styles.thumbs}>
              {photos.map(({ url }, index) => (
                <li key={url}>
                  <button
                    type="button"
                    className={`${styles.thumb} ${
                      index === active ? styles.thumbOn : ''
                    }`}
                    onClick={() => setActive(index)}
                    aria-label={`${index + 1}번째 사진 보기`}
                  >
                    <img src={url} alt="" />
                  </button>

                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => removePhoto(index)}
                    aria-label={`${index + 1}번째 사진 빼기`}
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

            <p className={styles.local}>
              {arrivalMessage(arrival)}
            </p>
          </>
        ) : (
          <>
            <button
              type="button"
              className={styles.drop}
              onClick={() => fileInput.current?.click()}
            >
              <span className={styles.dropCircle}>
                <img
                  src={photoIcon}
                  width={32}
                  height={32}
                  alt=""
                />
              </span>

              <strong className={styles.dropTitle}>
                앨범에서 사진 선택
              </strong>

              <span className={styles.dropSub}>
                터치하여 현장 사진을 업로드 하세요
              </span>
            </button>

            <div className={styles.gps}>
              <img
                src={checkIcon}
                width={24}
                height={24}
                alt=""
              />

              <p>
                <strong>GPS 위치 인증 상태</strong>
                <br />
                {arrival.status === 'checking'
                  ? '사진 선택 시 위치를 자동 검증합니다.'
                  : arrivalMessage(arrival)}
              </p>
            </div>
          </>
        )}
      </>
    </FlowScreen>
  );
}