import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Clock, FileText, Loader, Search, X } from 'lucide-react';
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
    <div className="max-width-container">
      <h1 className="page-title">Library</h1>

      <div className="library-controls">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search titles, summaries, and transcripts…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button className="icon-button" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </div>

        <select
          className="profile-filter"
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

      {isLoading && <Loader size={28} className="animate-spin centered-loader" />}

      {error && (
        <div className="empty-state">
          <AlertCircle size={40} />
          <p>{error}</p>
        </div>
      )}

      {!isLoading && !error && videos.length === 0 && (
        <div className="empty-state">
          <FileText size={40} />
          <p>{query ? `Nothing matches “${query}”` : 'No videos analyzed yet.'}</p>
        </div>
      )}

      <div className="video-grid">
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
};

const VideoCard = ({
  video,
  onSelect,
}: {
  video: VideoListItem;
  onSelect: (videoId: string) => void;
}) => {
  const isReady = video.status === 'completed';
  const duration = formatDuration(video.duration_seconds);

  return (
    <button
      className={`video-card ${isReady ? '' : 'video-card-pending'}`}
      onClick={() => isReady && onSelect(video.id)}
      disabled={!isReady}
    >
      <div className="video-card-tags">
        {video.profile && <span className={`tag tag-${video.profile}`}>{video.profile}</span>}
        <StatusBadge status={video.status} stage={video.stage} />
      </div>

      <h3 className="video-card-title">{video.title}</h3>

      {video.one_liner && <p className="video-card-summary">{video.one_liner}</p>}

      {video.error_message && <p className="video-card-error">{video.error_message}</p>}

      <div className="video-card-meta">
        <span>
          <Clock size={14} /> {formatDate(video.recorded_at ?? video.created_at)}
        </span>
        {duration && <span>{duration}</span>}
      </div>
    </button>
  );
};

const StatusBadge = ({ status, stage }: { status: string; stage: string | null }) => {
  if (status === 'completed') return null;

  if (status === 'failed') {
    return <span className="tag tag-failed">Failed</span>;
  }

  return (
    <span className="tag tag-processing">
      <Loader size={12} className="animate-spin" />
      {stage ? stage.replace(/_/g, ' ') : 'queued'}
    </span>
  );
};

export default VideoLibrary;
