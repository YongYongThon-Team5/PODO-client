import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ApiError } from './api/errors';
import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 4xx(입력 오류·권한)는 다시 해도 같으니 재시도하지 않음
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      refetchOnWindowFocus: false,
      // 탭을 오갈 때마다 같은 데이터를 다시 받지 않게 30초 동안은 받아 둔 것을 그대로 쓴다.
      // 값이 바뀌는 동작(방문 등록·답 제출·프로필 수정 등)은 그때 캐시를 직접 고친다.
      staleTime: 30 * 1000,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
