import { lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppShell from './components/AppShell';
import PrivateRoute from './components/PrivateRoute';
import AnalyticsTracker from './components/AnalyticsTracker';
import { useThemeStore } from './stores/themeStore';

const Today = lazy(() => import('./pages/Today'));
const Review = lazy(() => import('./pages/Review'));
const Library = lazy(() => import('./pages/Library'));
const Profile = lazy(() => import('./pages/Profile'));

function App() {
  const { isDark } = useThemeStore();

  useEffect(() => {
    const splashScreen = document.getElementById('splash-screen');

    if (splashScreen) {
      splashScreen.style.transition = 'opacity 0.5s ease';
      splashScreen.style.opacity = '0';
      setTimeout(() => {
        splashScreen.style.display = 'none';
      }, 500);
    }
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', isDark ? '#101922' : '#f6f7f8');
    }
  }, [isDark]);

  return (
    <Router>
      <AnalyticsTracker />
      <Routes>
        <Route
          element={(
            <PrivateRoute>
              <AppShell />
            </PrivateRoute>
          )}
        >
          <Route path="/" element={<Today />} />
          <Route path="/review" element={<Review />} />
          <Route path="/library" element={<Library />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
