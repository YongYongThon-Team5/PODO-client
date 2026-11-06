import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Splash from './pages/Splash';
import Onboarding from './pages/Onboarding';
import Login from './pages/Login';
import LoadingPreview from './pages/LoadingPreview';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <div className="app-frame">
          <Routes>
            <Route path="/" element={<Splash />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/login" element={<Login />} />
            <Route path="/preview/loading" element={<LoadingPreview />} />
            {/* 회원가입·홈 등은 다음 단계에서 구현 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
