import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { restoreSession } from './api/auth';
import { warmUpImages } from './lib/warmup';
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
import MapPage from './pages/MapPage';
import Mission from './pages/Mission';
import VisitPhotos from './pages/visit/VisitPhotos';
import QuizIntro from './pages/visit/QuizIntro';
import ExploreStart from './pages/visit/ExploreStart';
import QuizQuestion from './pages/visit/QuizQuestion';
import QuizCheer from './pages/visit/QuizCheer';
import QuizComplete from './pages/visit/QuizComplete';
import MyPage from './pages/MyPage';
import LoadingPreview from './pages/LoadingPreview';

export default function App() {
  // 새로고침해도 Refresh 쿠키가 살아 있으면 로그인 상태로 복구
  useEffect(() => {
    void restoreSession();
    warmUpImages();
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
            {/* 방문 확정 → 탐험 퀴즈 → 탐험 완료 */}
            <Route path="/visits/:visitId/photos" element={<VisitPhotos />} />
            <Route path="/visits/:visitId/episode" element={<QuizIntro />} />
            <Route path="/visits/:visitId/arrive" element={<ExploreStart />} />
            <Route path="/visits/:visitId/quiz/:position" element={<QuizQuestion />} />
            <Route path="/visits/:visitId/cheer" element={<QuizCheer />} />
            <Route path="/visits/:visitId/complete" element={<QuizComplete />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/mission" element={<Mission />} />
            {/* 마이페이지는 Figma에서 아직 확정(😀) 전이지만 디자인대로 만듦 */}
            <Route path="/my" element={<MyPage />} />
            <Route path="/preview/loading" element={<LoadingPreview />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
