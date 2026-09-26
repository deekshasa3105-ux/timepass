import { useState, useEffect, useCallback } from 'react';
import { CivicIssue } from '../types/issue';
import { subscribeToIssues, fetchIssuesDirectly } from '../firebase/firestore';

export function useIssues() {
  const [issues, setIssues] = useState<CivicIssue[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState<boolean>(false);

  // Manual one-click refresh handler
  const refresh = useCallback(async (): Promise<CivicIssue[]> => {
    try {
      const directIssues = await fetchIssuesDirectly();
      setIssues(directIssues);
      setIsLive(true);
      setError(null);
      return directIssues;
    } catch (err: any) {
      console.warn('Direct fetch refresh notice:', err);
      return [];
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Initial immediate fetch for instant render across any device
    fetchIssuesDirectly()
      .then((initialIssues) => {
        setIssues(initialIssues);
        setLoading(false);
        setIsLive(true);
      })
      .catch((err) => {
        console.warn('Initial direct fetch notice:', err);
      });

    // Real-time listener for live updates across all devices
    const unsubscribe = subscribeToIssues(
      (loadedIssues) => {
        setIssues(loadedIssues);
        setLoading(false);
        setIsLive(true);
      },
      (err) => {
        console.error('Issue subscription error:', err);
        setError('Live civic data is temporarily unavailable. Please verify network or reload.');
        setLoading(false);
        setIsLive(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  return { issues, loading, error, isLive, refresh };
}
