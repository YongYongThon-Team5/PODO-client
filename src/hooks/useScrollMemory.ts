import { useCallback, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const memory = new Map<string, { top: number; left: number }>();

/**
 * 뒤로 가기로 돌아왔을 때 스크롤 위치를 그대로 되살린다 (목록 → 상세 → 뒤로).
 * 돌려받은 ref를 스크롤 영역에 붙이면 된다. 새로 들어온 화면은 항상 맨 위에서 시작한다.
 * 로딩 화면 뒤에 늦게 나타나는 영역에도 붙을 수 있게 콜백 ref로 만든다.
 */
export function useScrollMemory<T extends HTMLElement>(name = 'main') {
  const { key } = useLocation();
  const type = useNavigationType();
  const detach = useRef<(() => void) | null>(null);
  const id = `${key}:${name}`;

  return useCallback(
    (el: T | null) => {
      detach.current?.();
      detach.current = null;
      if (!el) return;
      const saved = type === 'POP' ? memory.get(id) : undefined;
      if (saved) {
        el.scrollTop = saved.top;
        el.scrollLeft = saved.left;
      }
      const save = () => memory.set(id, { top: el.scrollTop, left: el.scrollLeft });
      el.addEventListener('scroll', save, { passive: true });
      detach.current = () => el.removeEventListener('scroll', save);
    },
    [id, type],
  );
}
