import { useCallback, useEffect, useState } from 'react';
import { Loader, Search, X } from 'lucide-react';
import { api } from '../api';
import { formatDate, formatDuration } from '../format';
import type { Profile, VideoListItem } from '../types/summary';

const PROFILE_FILTERS: { value: Profile | ''; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'meeting', label: 'Meetings' },
  { value: 'interview', label: 'Interviews' },
  { value: 'lecture', label: 'Lectures' },
  { value: 'presentation', label: 'Presentations' },
  { value: 'panel', label: 'Panels' },
  { value: 'call', label: 'Calls' },
  { value: 'hearing', label: 'Hearings' },
  { value: 'podcast', label: 'Podcasts' },
  { value: 'other', label: 'Other' },
];

const POLL_INTERVAL_MS = 10000;

interface VideoLibraryProps {
  onSelect: (videoId: string) => void;
}

const VideoLibrary = ({ onSelect }: VideoLibraryProps) => {
  const [videos, setVideos] = useState<VideoListItem[]>([]);
  const [query, setQuery] = useState('');
  const [profile, setProfile] = useState<Profile | ''>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api.listVideos(query, profile);
      setVideos(result.videos);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load videos');
    } finally {
      setIsLoading(false);
    }
  }, [query, profile]);

  useEffect(() => {
    const timer = setTimeout(load, query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  const hasUnfinished = videos.some(
    (video) => video.status === 'queued' || video.status === 'processing',
  );

  useEffect(() => {
    if (!hasUnfinished) return;
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [hasUnfinished, load]);

  return (
    <div className="page">
      <h1 className="page-title">Library</h1>

      <div className="library-controls">
        <div className="field">
          <Search size={14} className="field-icon" />
          <input
            type="text"
            className="input input-search"
            placeholder="Search titles, summaries, and transcripts"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button className="field-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>

        <select
          className="select"
          value={profile}
          onChange={(event) => setProfile(event.target.value as Profile | '')}
        >
          {PROFILE_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="loading-state">
          <span className="muted">Loading...</span>
        </div>
      )}

      {error && (
        <div className="empty-state">
          <p className="error-text">{error}</p>
        </div>
      )}

      {!isLoading && !error && videos.length === 0 && (
        <div className="empty-state">
          <p className="muted">{query ? 'No results' : 'Nothing analyzed yet.'}</p>
        </div>
      )}

      <div className="row-stack">
        {videos.map((video) => (
          <VideoRow key={video.id} video={video} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
};

const VideoRow = ({
  video,
  onSelect,
}: {
  video: VideoListItem;
  onSelect: (videoId: string) => void;
}) => {
  const isReady = video.status === 'completed';
  const duration = formatDuration(video.duration_seconds);

  return (
    <button className="row" onClick={() => isReady && onSelect(video.id)} disabled={!isReady}>
      <div className="video-row-head">
        {video.profile && <span className="eyebrow">{video.profile}</span>}
        <StatusBadge status={video.status} stage={video.stage} />
      </div>

      <p className="video-row-title">{video.title}</p>

      {video.one_liner && <p className="video-row-summary">{video.one_liner}</p>}

      {video.error_message && <p className="error-text">{video.error_message}</p>}

      <div className="video-row-meta">
        <span>{formatDate(video.recorded_at ?? video.created_at)}</span>
        {duration && <span>{duration}</span>}
      </div>
    </button>
  );
};

const StatusBadge = ({ status, stage }: { status: string; stage: string | null }) => {
  if (status === 'completed') return null;

  if (status === 'failed') {
    return <span className="badge badge-failed">Failed</span>;
  }

  return (
    <span className="badge">
      <Loader size={11} className="animate-spin" />
      {stage ? stage.replace(/_/g, ' ') : 'queued'}
    </span>
  );
};

export default VideoLibrary;
