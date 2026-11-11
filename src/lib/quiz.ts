import type { QuizProgress, QuizQuestion, Visit } from '../api/queries';

/**
 * observationGuide가 Figma처럼 짧은 위치 이름("입구 안내도")이면 문장 안에 넣어 쓰고,
 * 긴 안내문이면 그대로 보여 준다.
 */
export function guidePlace(q: Pick<QuizQuestion, 'observationGuide'> | undefined) {
  const g = q?.observationGuide?.trim();
  return g && g.length <= 12 ? g : null;
}

/** "첫 문제는 입구 안내도에 있어 !" */
export function guideLine(q: QuizQuestion | undefined, which: '첫' | '다음' | '마지막') {
  if (!q) return '안내판을 잘 보면 다 맞힐 수 있어요';
  const place = guidePlace(q);
  if (place) return `${which} 문제는 ${place}에 있어 !`;
  return q.observationGuide?.trim() || `${which} 문제도 안내판을 잘 살펴봐 !`;
}

/** 안 푼 첫 문제 (없으면 undefined) */
export function nextUnanswered(quiz: QuizProgress) {
  return [...quiz.questions].sort((a, b) => a.position - b.position).find((q) => !q.submittedAnswer);
}

export const visitPath = {
  photos: (id: string) => `/visits/${id}/photos`,
  episode: (id: string) => `/visits/${id}/episode`,
  arrive: (id: string) => `/visits/${id}/arrive`,
  question: (id: string, position: number) => `/visits/${id}/quiz/${position}`,
  cheer: (id: string) => `/visits/${id}/cheer`,
  complete: (id: string) => `/visits/${id}/complete`,
};

/**
 * 진행 중인 방문을 이어서 할 화면.
 * 방문 예정이면 사진 추가(방문 확정)부터, 퀴즈 중이면 안 푼 문제부터, 끝났으면 탐험 완료.
 */
export function resumePath(visit: Pick<Visit, 'id' | 'status' | 'answeredCount'>, quiz?: QuizProgress) {
  if (visit.status === 'PLANNED') return visitPath.photos(visit.id);
  if (visit.status === 'COMPLETED') return visitPath.complete(visit.id);
  if (visit.answeredCount === 0) return visitPath.episode(visit.id);
  const next = quiz ? nextUnanswered(quiz) : undefined;
  return next ? visitPath.question(visit.id, next.position) : visitPath.episode(visit.id);
}

/** 문제·해설을 소리로 읽어 주기 (Figma 스피커 아이콘). 지원하지 않는 브라우저면 아무것도 안 한다 */
export function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR';
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}
