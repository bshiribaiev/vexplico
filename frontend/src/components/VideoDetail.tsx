import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckSquare,
  Copy,
  HelpCircle,
  Loader,
  MessageSquare,
  Quote as QuoteIcon,
  RefreshCw,
  Trash2,
  Users,
  Youtube,
} from 'lucide-react';
import { api } from '../api';
import { formatDate, formatDuration } from '../format';
import TranscriptView, { Moment } from './TranscriptView';
import type { VideoDetail as Video } from '../types/summary';

const POLL_INTERVAL_MS = 8000;

interface VideoDetailProps {
  videoId: string;
  onBack: () => void;
  onDeleted: () => void;
}

const VideoDetail = ({ videoId, onBack, onDeleted }: VideoDetailProps) => {
  const [video, setVideo] = useState<Video | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setVideo(await api.getVideo(videoId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load this video');
    }
  }, [videoId]);

  useEffect(() => {
    load();
  }, [load]);

  const isUnfinished = video?.status === 'queued' || video?.status === 'processing';

  useEffect(() => {
    if (!isUnfinished) return;
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isUnfinished, load]);

  const copyMarkdown = async () => {
    if (!video?.summary_markdown) return;
    await navigator.clipboard.writeText(video.summary_markdown);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  const deleteVideo = async () => {
    await api.deleteVideo(videoId);
    onDeleted();
  };

  if (error) return <div className="max-width-container empty-state">{error}</div>;
  if (!video) return <Loader size={28} className="animate-spin centered-loader" />;

  const summary = video.summary;

  return (
    <div className="max-width-container summary-container">
      <button className="btn btn-secondary back-button" onClick={onBack}>
        <ArrowLeft size={16} /> Library
      </button>

      <header className="summary-header">
        {summary && <div className={`tag tag-${summary.profile}`}>{summary.profile}</div>}
        <h1 className="summary-header-title">{video.title}</h1>

        <div className="summary-header-meta">
          <span>{formatDate(video.recorded_at ?? video.created_at)}</span>
          {video.duration_seconds && <span>{formatDuration(video.duration_seconds)}</span>}
          {summary && <span>{summary.overall_sentiment}</span>}
        </div>

        <div className="summary-header-actions">
          {video.source_url && (
            <a
              className="btn btn-secondary"
              href={video.source_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Youtube size={16} /> Watch source
            </a>
          )}
          {video.summary_markdown && (
            <button className="btn btn-secondary" onClick={copyMarkdown}>
              {hasCopied ? <Check size={16} /> : <Copy size={16} />}
              {hasCopied ? 'Copied' : 'Copy as Markdown'}
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => api.reprocess(videoId).then(load)}>
            <RefreshCw size={16} /> Reprocess
          </button>
          <button className="btn btn-secondary btn-danger" onClick={deleteVideo}>
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </header>

      {isUnfinished && (
        <div className="summary-section processing-notice">
          <Loader size={18} className="animate-spin" />
          <span>{video.stage ? `Working on ${video.stage}…` : 'Queued for processing…'}</span>
        </div>
      )}

      {video.status === 'failed' && (
        <div className="summary-section form-error">{video.error_message}</div>
      )}

      {summary && (
        <>
          <section className="summary-section">
            <p className="one-liner">{summary.one_liner}</p>
            {summary.executive_summary.split('\n\n').map((paragraph, index) => (
              <p key={index} className="summary-section-content">
                {paragraph}
              </p>
            ))}
          </section>

          {summary.topics.length > 0 && (
            <section className="summary-section">
              <h2 className="summary-section-title">
                <MessageSquare size={20} /> What was covered
              </h2>
              {summary.topics.map((topic, index) => (
                <article key={index} className="topic-item">
                  <h3 className="topic-title">
                    {topic.title}
                    <Moment seconds={topic.start_seconds} sourceUrl={video.source_url} />
                  </h3>
                  <p className="topic-summary">{topic.summary}</p>
                  {topic.key_points.length > 0 && (
                    <ul className="summary-list">
                      {topic.key_points.map((point, pointIndex) => (
                        <li key={pointIndex}>{point}</li>
                      ))}
                    </ul>
                  )}
                  {topic.speakers.length > 0 && (
                    <p className="topic-meta">{topic.speakers.join(', ')}</p>
                  )}
                </article>
              ))}
            </section>
          )}

          {summary.decisions.length > 0 && (
            <section className="summary-section">
              <h2 className="summary-section-title">
                <CheckSquare size={20} /> Decisions
              </h2>
              {summary.decisions.map((decision, index) => (
                <div key={index} className="decision-card">
                  <p className="decision-card-item">
                    {decision.item}
                    <Moment seconds={decision.start_seconds} sourceUrl={video.source_url} />
                  </p>
                  <p className="decision-card-outcome">{decision.outcome}</p>
                  {decision.rationale && <p className="topic-meta">{decision.rationale}</p>}
                </div>
              ))}
            </section>
          )}

          {summary.action_items.length > 0 && (
            <section className="summary-section">
              <h2 className="summary-section-title">
                <CheckSquare size={20} /> Action items
              </h2>
              <ul className="summary-list">
                {summary.action_items.map((item, index) => (
                  <li key={index}>
                    {item.task}
                    {item.owner && <span className="topic-meta"> — {item.owner}</span>}
                    {item.due && <span className="topic-meta"> · due {item.due}</span>}
                    <Moment seconds={item.start_seconds} sourceUrl={video.source_url} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {summary.adaptive_sections.map((section, index) => (
            <section key={index} className="summary-section">
              <h2 className="summary-section-title">{section.title}</h2>
              <ul className="summary-list">
                {section.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{item}</li>
                ))}
              </ul>
            </section>
          ))}

          {summary.open_questions.length > 0 && (
            <section className="summary-section">
              <h2 className="summary-section-title">
                <HelpCircle size={20} /> Open questions
              </h2>
              <ul className="summary-list">
                {summary.open_questions.map((question, index) => (
                  <li key={index}>{question}</li>
                ))}
              </ul>
            </section>
          )}

          {summary.notable_quotes.length > 0 && (
            <section className="summary-section">
              <h2 className="summary-section-title">
                <QuoteIcon size={20} /> Notable quotes
              </h2>
              {summary.notable_quotes.map((quote, index) => (
                <blockquote key={index} className="quote">
                  <p>{quote.text}</p>
                  <footer>
                    {quote.speaker}
                    <Moment seconds={quote.start_seconds} sourceUrl={video.source_url} />
                  </footer>
                </blockquote>
              ))}
            </section>
          )}

          {summary.participants.length > 0 && (
            <section className="summary-section">
              <h2 className="summary-section-title">
                <Users size={20} /> Participants
              </h2>
              <ul className="summary-list">
                {summary.participants.map((person, index) => (
                  <li key={index}>
                    <strong>{person.name}</strong>
                    {person.role && <span className="topic-meta"> — {person.role}</span>}
                    {person.contribution && <p className="topic-meta">{person.contribution}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <TranscriptView videoId={videoId} sourceUrl={video.source_url} />
        </>
      )}
    </div>
  );
};

export default VideoDetail;
