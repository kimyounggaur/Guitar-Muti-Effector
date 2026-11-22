import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { playPreparedAudio } from './playPreparedAudio';
import '../../styles/components/file-player.css';
import { t } from '../../i18n/ko';

type UploadedTrack = {
  name: string;
  url: string;
};

type AudioFilePlayerPanelProps = {
  isEffectChainReady: boolean;
  onPreparePlayback: (audioElement: HTMLAudioElement) => Promise<void>;
};

const seekStepSeconds = 10;

function AudioFilePlayerPanel({ isEffectChainReady, onPreparePlayback }: AudioFilePlayerPanelProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  // Phone layout only: the player folds to its heading until opened.
  const [mobileOpen, setMobileOpen] = useState(false);
  const [audioElementKey, setAudioElementKey] = useState(0);
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

  useEffect(() => {
    if (isEffectChainReady) {
      return;
    }

    audioRef.current?.pause();
    setIsPlaying(false);
    setCurrentTime(0);
    setAudioElementKey((key) => key + 1);
  }, [isEffectChainReady]);

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

    const audio = audioRef.current;
    try {
      if (!await playPreparedAudio(audio, () => audioRef.current, onPreparePlayback)) return;
      setIsPlaying(true);
      setErrorMessage('');
    } catch {
      setErrorMessage(t('error.playback'));
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
    <section className={`audio-file-player ${mobileOpen ? 'is-open' : ''}`} aria-label={t('panel.player.region')}>
      <div className="panel-heading">
        <span>{t('panel.player.title')}</span>
        <strong>{track ? track.name : t('panel.player.noTrack')}</strong>
        <button className="mobile-only mobile-panel-toggle" type="button" aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)}>
          {mobileOpen ? t('panel.common.collapse') : t('panel.common.expand')}
        </button>
      </div>

      <label className="audio-upload-control">
        <span>{t('panel.player.upload')}</span>
        <input type="file" accept="audio/*" onChange={handleFileChange} />
      </label>

      <audio
        key={audioElementKey}
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
          <strong>{isPlaying ? t('panel.player.statusPlaying') : track ? (isEffectChainReady ? t('panel.player.statusReady') : t('panel.player.statusLoaded')) : t('panel.common.empty')}</strong>
          <span>{formatTime(duration)}</span>
        </div>
        <div className="audio-progress-track" aria-hidden="true">
          <i style={{ width: `${progress}%` }} />
        </div>
      </div>

      <p className="audio-player-hint">
        
        {t('panel.player.chainNote')}
      </p>

      <div className="audio-transport-buttons">
        <button type="button" onClick={() => handleSeek(-seekStepSeconds)} disabled={!track}>
          
          {t('panel.player.back10')}
        </button>
        <button type="button" onClick={handlePlay} disabled={!track || isPlaying}>
          
          {t('panel.common.play')}
        </button>
        <button type="button" onClick={handlePause} disabled={!track || !isPlaying}>
          
          {t('panel.common.pause')}
        </button>
        <button type="button" onClick={handleStop} disabled={!track}>
          
          {t('panel.common.stop')}
        </button>
        <button type="button" onClick={() => handleSeek(seekStepSeconds)} disabled={!track}>
          
          {t('panel.player.forward10')}
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
