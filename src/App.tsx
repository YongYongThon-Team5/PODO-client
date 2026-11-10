import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { restoreSession } from './api/auth';
import Splash from './pages/Splash';
import Onboarding from './pages/Onboarding';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Signup from './pages/Signup';
import LocationPermission from './pages/LocationPermission';
import Home from './pages/Home';
import Conditions from './pages/Conditions';
import Recommend from './pages/Recommend';
import PlaceDetail from './pages/PlaceDetail';
import ComingSoon from './pages/ComingSoon';
import LoadingPreview from './pages/LoadingPreview';

export default function App() {
  // 새로고침해도 Refresh 쿠키가 살아 있으면 로그인 상태로 복구
  useEffect(() => {
    void restoreSession();
  }, []);

  return (
    <BrowserRouter>
      <div className="app-shell">
        <div className="app-frame">
          <Routes>
            <Route path="/" element={<Splash />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/location" element={<LocationPermission />} />
            <Route path="/home" element={<Home />} />
            <Route path="/conditions" element={<Conditions />} />
            <Route path="/recommend" element={<Recommend />} />
            <Route path="/places/:placeId" element={<PlaceDetail />} />
            {/* GNB 탭 중 아직 디자인 확정 전인 화면 */}
            <Route path="/map" element={<ComingSoon title="지도" />} />
            <Route path="/mission" element={<ComingSoon title="미션" />} />
            <Route path="/my" element={<ComingSoon title="마이페이지" />} />
            <Route path="/preview/loading" element={<LoadingPreview />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
