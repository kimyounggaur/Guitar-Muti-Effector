import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

type UploadedTrack = {
  name: string;
  url: string;
};

const seekStepSeconds = 10;

function AudioFilePlayerPanel() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [track, setTrack] = useState<UploadedTrack | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    audioRef.current?.pause();
    setTrack({ name: file.name, url });
    setDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setErrorMessage('');
  };

  const handlePlay = async () => {
    if (!audioRef.current || !track) {
      return;
    }

    try {
      await audioRef.current.play();
      setIsPlaying(true);
      setErrorMessage('');
    } catch {
      setErrorMessage('재생을 시작할 수 없습니다.');
    }
  };

  const handlePause = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
  };

  const handleStop = () => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleSeek = (amount: number) => {
    if (!audioRef.current) {
      return;
    }

    const nextTime = Math.min(duration || 0, Math.max(0, audioRef.current.currentTime + amount));
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleLoadedMetadata = () => {
    const nextDuration = audioRef.current?.duration ?? 0;
    setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
  };

  return (
    <section className="audio-file-player" aria-label="Uploaded audio player">
      <div className="panel-heading">
        <span>Audio File</span>
        <strong>{track ? track.name : 'No track loaded'}</strong>
      </div>

      <label className="audio-upload-control">
        <span>음원 업로드</span>
        <input type="file" accept="audio/*" onChange={handleFileChange} />
      </label>

      <audio
        ref={audioRef}
        src={track?.url ?? ''}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="audio-track-display">
        <div className="audio-time-row">
          <span>{formatTime(currentTime)}</span>
          <strong>{isPlaying ? 'PLAY' : track ? 'READY' : 'EMPTY'}</strong>
          <span>{formatTime(duration)}</span>
        </div>
        <div className="audio-progress-track" aria-hidden="true">
          <i style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="audio-transport-buttons">
        <button type="button" onClick={() => handleSeek(-seekStepSeconds)} disabled={!track}>
          뒤로 10초
        </button>
        <button type="button" onClick={handlePlay} disabled={!track || isPlaying}>
          재생
        </button>
        <button type="button" onClick={handlePause} disabled={!track || !isPlaying}>
          일시정지
        </button>
        <button type="button" onClick={handleStop} disabled={!track}>
          정지
        </button>
        <button type="button" onClick={() => handleSeek(seekStepSeconds)} disabled={!track}>
          앞으로 10초
        </button>
      </div>

      {errorMessage ? <p className="audio-player-error">{errorMessage}</p> : null}
    </section>
  );
}

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${remainder}`;
};

export default AudioFilePlayerPanel;
