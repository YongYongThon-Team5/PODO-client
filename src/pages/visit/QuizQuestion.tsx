import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import FlowScreen, { flow } from '../../components/FlowScreen';
import LoadError from '../../components/LoadError';
import speakerIcon from '../../assets/icon-speaker.svg';
import quizO from '../../assets/quiz-o.svg';
import quizX from '../../assets/quiz-x.svg';
import quizTape from '../../assets/quiz-tape.svg';
import foxQuestion from '../../assets/fox-question.png';
import foxHint from '../../assets/fox-hint.png';
import foxRight from '../../assets/fox-right.png';
import foxWrong from '../../assets/fox-wrong.png';
import {
  useAuth,
  useQuiz,
  useReferenceImageUrl,
  useSubmitAnswer,
  useViewHint,
  type QuizFeedback,
  type QuizProgress,
  type QuizQuestion as Question,
} from '../../api/queries';
import { ApiError } from '../../api/errors';
import { formatDotDate } from '../../lib/format';
import { guidePlace, nextUnanswered, preloadImages, speak, stopSpeaking, visitPath } from '../../lib/quiz';
import styles from './QuizQuestion.module.css';

type Answer = 'O' | 'X';

const SOURCE_LABEL: Record<string, string> = {
  OFFICIAL: '공식 안내',
  PUBLIC_DATA: '공공데이터',
  FIELD_NOTE: '현장 설명판',
};

/** "출처: 현장 설명판 · 확인일 2026.11.01" */
function sourceLine(feedback: QuizFeedback) {
  const s = feedback.sources[0];
  if (!s) return null;
  const label = SOURCE_LABEL[s.type] ?? s.type;
  return `출처: ${label}${s.checkedAt ? ` · 확인일 ${formatDotDate(s.checkedAt.slice(0, 10))}` : ''}`;
}

/** Figma "현장 관찰 / 미션 진행 / 힌트팝업 / 정답 확인 / 오답 확인" — /visits/:visitId/quiz/:position */
export default function QuizQuestion() {
  const { visitId, position } = useParams();
  const auth = useAuth();
  const quiz = useQuiz(visitId);

  if (auth.status === 'signedOut') return <Navigate to="/login" replace />;
  if (!visitId) return <Navigate to="/mission" replace />;

  const q = quiz.data?.questions.find((item) => String(item.position) === position);

  if (quiz.isError) {
    const e = quiz.error;
    // 아직 방문 신고 전이면 사진 추가(방문 확정)부터
    if (e instanceof ApiError && e.status === 409) return <Navigate to={visitPath.photos(visitId)} replace />;
    return (
      <FlowScreen title="탐험 퀴즈">
        <div className={styles.error}>
          <LoadError message={e.message} onRetry={() => quiz.refetch()} />
        </div>
      </FlowScreen>
    );
  }
  if (quiz.data && quiz.data.quizAvailability !== 'READY')
    return <Navigate to={visitPath.episode(visitId)} replace />;
  if (quiz.data && !q) return <Navigate to={visitPath.episode(visitId)} replace />;

  if (!quiz.data || !q) {
    return (
      <FlowScreen title="탐험 퀴즈">
        <div className={styles.skeleton} aria-busy />
      </FlowScreen>
    );
  }

  // 문제가 바뀌면 고른 답·다시 풀기 상태를 새로 시작
  return <Step key={q.questionId} visitId={visitId} quiz={quiz.data} q={q} />;
}

function Step({ visitId, quiz, q }: { visitId: string; quiz: QuizProgress; q: Question }) {
  const navigate = useNavigate();
  const submit = useSubmitAnswer(visitId);
  const [picked, setPicked] = useState<Answer | null>(null);
  // 첫 답은 서버에 그대로 남는다. "다시 한 번 더"는 해설의 정답과 비교만 하는 연습 풀이
  const [retrying, setRetrying] = useState(false);
  const [retryCorrect, setRetryCorrect] = useState<boolean | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => stopSpeaking, []);

  const total = quiz.questions.length;
  const feedback = q.feedback;

  // 결과 화면 여우와 다음 문제 사진을 미리 받아 둔다
  const upcoming = quiz.questions.find((item) => item.position > q.position && !item.submittedAnswer);
  const referenceImageUrl = useReferenceImageUrl(q.referenceImageUrl);
  const upcomingImageUrl = useReferenceImageUrl(upcoming?.referenceImageUrl);
  preloadImages([foxRight, foxWrong, foxQuestion, upcomingImageUrl]);
  const submitted = !!q.submittedAnswer;
  const showResult = submitted && (!retrying || retryCorrect !== null);
  const correct = retrying && retryCorrect !== null ? retryCorrect : !!feedback?.isCorrect;
  const place = guidePlace(q);
  const label = `문제 ${q.position}/${total}${place ? ` · ${place}` : ''}`;

  const check = () => {
    if (!picked) return;
    if (retrying) {
      setRetryCorrect(!!feedback && picked === feedback.correctAnswer);
      return;
    }
    setMessage(null);
    submit.mutate(
      { questionId: q.questionId, answer: picked },
      {
        onError: (e) => {
          if (e instanceof ApiError && e.status === 401) navigate('/login');
          else if (e instanceof ApiError && e.status === 409) navigate(visitPath.episode(visitId), { replace: true });
          else setMessage(e.message);
        },
      },
    );
  };

  const tryAgain = () => {
    setRetrying(true);
    setRetryCorrect(null);
    setPicked(null);
  };

  /** 다음 문제로. 한 문제 남았으면 "미션 유지 유도", 다 풀었으면 탐험 완료 */
  const goNext = () => {
    const next = nextUnanswered(quiz);
    if (!next || quiz.visitStatus === 'COMPLETED') {
      navigate(visitPath.complete(visitId), { replace: true });
      return;
    }
    const left = quiz.questions.filter((item) => !item.submittedAnswer).length;
    if (left === 1 && total > 1) navigate(visitPath.cheer(visitId), { replace: true });
    else navigate(visitPath.question(visitId, next.position), { replace: true });
  };

  if (showResult) {
    const source = feedback ? sourceLine(feedback) : null;
    return (
      <FlowScreen
        title="탐험 퀴즈"
        onBack={() => navigate('/mission')}
        footer={
          correct ? (
            <button type="button" className={flow.primary} onClick={goNext}>
              다음
            </button>
          ) : (
            <>
              <button type="button" className={styles.skip} onClick={goNext}>
                정답 확인하고 다음으로 →
              </button>
              <button type="button" className={flow.primary} onClick={tryAgain}>
                다시 한 번 더
              </button>
            </>
          )
        }
      >
        <div className={styles.resultFox}>
          <span className={styles.shadow} aria-hidden />
          <img src={correct ? foxRight : foxWrong} width={116} height={116} alt="" />
        </div>
        <h1 className={styles.resultTitle}>{correct ? '정답이에요!' : '한 번 도전해봐요!'}</h1>
        {feedback ? (
          <section className={`${styles.explain} ${correct ? styles.explainRight : ''}`}>
            <h2>{correct ? '알고 가요' : '“괜찮아요, 설명판 같이 볼까요?”'}</h2>
            <p>{feedback.explanation}</p>
            {feedback.photoEvidenceText && <p className={styles.evidence}>{feedback.photoEvidenceText}</p>}
            {correct && source && <small>{source}</small>}
            <button
              type="button"
              className={styles.listen}
              onClick={() => speak(feedback.explanation)}
              aria-label="해설 듣기"
            >
              <img src={speakerIcon} width={17} height={17} alt="" />
            </button>
          </section>
        ) : (
          <p className={styles.saved}>답을 저장했어요.</p>
        )}
      </FlowScreen>
    );
  }

  return (
    <FlowScreen
      title="탐험 퀴즈"
      onBack={() => navigate('/mission')}
      message={message ?? (retrying ? '한 번 더 골라 보세요. 처음 답은 그대로 기록돼요.' : null)}
      footer={
        <button type="button" className={flow.primary} onClick={check} disabled={!picked || submit.isPending}>
          {submit.isPending ? '채점 중…' : '정답 확인'}
        </button>
      }
    >
      <div className={styles.top}>
        <p className={styles.label}>{label}</p>
        <button
          type="button"
          className={styles.speaker}
          onClick={() => speak(`문제 ${q.position}. ${q.text}. 맞으면 오, 틀리면 엑스를 골라요.`)}
          aria-label="문제 듣기"
        >
          <img src={speakerIcon} width={17} height={17} alt="" />
        </button>
      </div>

      <ol className={styles.bars} aria-label={`${total}문제 중 ${q.position}번째`}>
        {quiz.questions.map((item) => (
          <li key={item.questionId} className={item.position <= q.position ? styles.barOn : undefined} />
        ))}
      </ol>

      {referenceImageUrl ? (
        <img className={styles.photo} src={referenceImageUrl} alt="문제 참고 사진" />
      ) : (
        <span className={`${styles.photo} ${styles.photoEmpty}`}>
          {place ? `${place}에서 답을 찾아보세요` : '안내판에서 답을 찾아보세요'}
        </span>
      )}

      <section className={styles.card}>
        <span className={styles.badge}>Q{q.position}</span>
        <img className={styles.tape} src={quizTape} alt="" />
        {q.availableHintSteps.length > 0 && (
          // Figma 11.13 "힌트 버튼": 문제 카드 오른쪽 위, 고민하는 여우 + "힌트보기"
          <button type="button" className={styles.hintButton} onClick={() => setHintOpen(true)}>
            <img src={foxHint} width={25} height={25} alt="" />
            <span>힌트보기</span>
          </button>
        )}
        <h1 className={styles.question}>{q.text}</h1>
        {!place && q.observationGuide && <p className={styles.guide}>{q.observationGuide}</p>}
      </section>

      <div className={styles.answers} role="radiogroup" aria-label="정답 고르기">
        {(['O', 'X'] as const).map((a) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={picked === a}
            aria-label={a === 'O' ? '맞아요 (O)' : '아니에요 (X)'}
            className={`${styles.answer} ${a === 'O' ? styles.answerO : styles.answerX} ${
              picked === a ? styles.answerOn : ''
            }`}
            onClick={() => setPicked(a)}
          >
            <img src={a === 'O' ? quizO : quizX} width={a === 'O' ? 80 : 58} height={a === 'O' ? 80 : 58} alt="" />
          </button>
        ))}
      </div>

      {hintOpen && <HintPopup visitId={visitId} q={q} onClose={() => setHintOpen(false)} />}
    </FlowScreen>
  );
}

/** Figma "힌트팝업": 여우 + "문제가 어렵지, 내가 힌트를 줄게~!!" + 힌트 본문 */
function HintPopup({ visitId, q, onClose }: { visitId: string; q: Question; onClose: () => void }) {
  const viewHint = useViewHint(visitId);
  const steps = [...q.availableHintSteps].sort((a, b) => a - b);
  // 처음 열면 아직 안 본 첫 단계, 다 봤으면 마지막 단계
  const [step, setStep] = useState(() => steps.find((s) => !q.viewedHintSteps.includes(s)) ?? steps[steps.length - 1]);
  const { mutate } = viewHint;

  useEffect(() => {
    mutate({ questionId: q.questionId, step });
  }, [mutate, q.questionId, step]);

  const moreStep = steps.find((s) => s > step);

  return (
    <div className={styles.dim} onClick={onClose} role="presentation">
      <div
        className={styles.popup}
        role="dialog"
        aria-modal="true"
        aria-label="힌트"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={styles.close} onClick={onClose} aria-label="힌트 닫기">
          {/* Figma "Close_round" 24 */}
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" stroke="#4f2c02" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <div className={styles.popupHead}>
          <img src={foxQuestion} width={70} height={70} alt="" />
          <p className={styles.popupBubble}>문제가 어렵지, 내가 힌트를 줄게~!!</p>
        </div>
        <p className={styles.hintText}>
          {viewHint.isPending
            ? '힌트를 찾는 중…'
            : viewHint.isError
              ? viewHint.error.message
              : viewHint.data
                ? `“ ${viewHint.data.text} ”`
                : ''}
        </p>
        {moreStep && viewHint.isSuccess && (
          <button type="button" className={styles.more} onClick={() => setStep(moreStep)}>
            힌트 하나 더 볼래요
          </button>
        )}
      </div>
    </div>
  );
}
