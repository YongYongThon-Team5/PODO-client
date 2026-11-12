import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { restoreSession } from '../api/auth';
import { api } from '../api/client';
import styles from './AuthCallback.module.css';

/**
 * 카카오 로그인 뒤 백엔드가 보내 주는 프론트 주소.
 * 실패하면 /auth/callback?error=login_failed 로 온다 (11.13 서버 응답으로 확인).
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (params.get('error')) {
      setFailed(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const ok = await restoreSession();
      if (cancelled) return;
      if (!ok) {
        setFailed(true);
        return;
      }
      // 아이 프로필이 없으면 첫 가입으로 보고 프로필 입력부터
      const { data } = await api.GET('/api/child-profiles', { params: { query: { limit: 1 } } });
      if (!cancelled) navigate(data && data.items.length > 0 ? '/home' : '/signup', { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, params]);

  return (
    <main className={`screen ${styles.screen}`}>
      {failed ? (
        <>
          <p>로그인하지 못했어요. 다시 시도해 주세요.</p>
          <button type="button" className={styles.retry} onClick={() => navigate('/login', { replace: true })}>
            로그인 화면으로
          </button>
        </>
      ) : (
        <p>로그인하는 중이에요…</p>
      )}
    </main>
  );
}
