import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { track } from '@/lib/analytics';

export default function AnalyticsTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    track('page_viewed', { path: pathname });
  }, [pathname]);

  return null;
}
