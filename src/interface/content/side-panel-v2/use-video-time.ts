import { useEffect, useState } from 'react';

export function useVideoTime(video: HTMLVideoElement | null, intervalMs = 250): number {
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (!video) return;
    const onTimeUpdate = () => setTime(video.currentTime);
    video.addEventListener('timeupdate', onTimeUpdate);
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, [video]);

  return time;
}
