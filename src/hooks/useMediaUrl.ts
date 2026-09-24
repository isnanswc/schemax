import { useState, useEffect } from 'react';
import { db } from '../db';

export function useMediaUrl(mediaId?: string | null): { url: string | null; loading: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!!mediaId);

  useEffect(() => {
    if (!mediaId) {
      setUrl(null);
      setLoading(false);
      return;
    }

    let active = true;
    let createdUrl: string | null = null;

    setLoading(true);
    db.media
      .get(mediaId)
      .then((item) => {
        if (!active) return;
        if (item && item.blob) {
          createdUrl = URL.createObjectURL(item.blob);
          setUrl(createdUrl);
        } else {
          setUrl(null);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load media blob:', err);
        if (active) {
          setUrl(null);
          setLoading(false);
        }
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [mediaId]);

  return { url, loading };
}
