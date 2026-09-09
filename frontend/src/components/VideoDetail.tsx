import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader } from 'lucide-react';
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

  if (error) {
    return (
      <div className="page empty-state">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="page loading-state">
        <span className="muted">Loading...</span>
      </div>
    );
  }

  const summary = video.summary;

  return (
    <div className="page">
      <button className="btn btn-text back-link" onClick={onBack}>
        <ArrowLeft size={14} /> Library
      </button>

      <header className="detail-header">
        {summary && <span className="eyebrow">{summary.profile}</span>}
        <h1 className="detail-title">{video.title}</h1>

        <div className="detail-meta">
          <span>{formatDate(video.recorded_at ?? video.created_at)}</span>
          {video.duration_seconds && <span>{formatDuration(video.duration_seconds)}</span>}
          {summary && <span>{summary.overall_sentiment}</span>}
        </div>

        <div className="detail-actions">
          {video.summary_markdown && (
            <button className="btn btn-quiet" onClick={copyMarkdown}>
              {hasCopied ? 'Copied' : 'Copy as Markdown'}
            </button>
          )}
          <button className="btn btn-quiet" onClick={() => api.reprocess(videoId).then(load)}>
            Reprocess
          </button>
          <button className="btn btn-text btn-danger" onClick={deleteVideo}>
            Delete
          </button>
        </div>
      </header>

      {isUnfinished && (
        <div className="section notice">
          <Loader size={14} className="animate-spin" />
          <span>{video.stage ? `Working on ${video.stage}` : 'Queued'}</span>
        </div>
      )}

      {video.status === 'failed' && <p className="section error-text">{video.error_message}</p>}

      {summary && (
        <>
          <section className="section">
            <p className="lede">{summary.one_liner}</p>
            {summary.executive_summary.split('\n\n').map((paragraph, index) => (
              <p key={index} className="prose">
                {paragraph}
              </p>
            ))}
          </section>

          {summary.topics.length > 0 && (
            <section className="section">
              <h2 className="section-label">What was covered</h2>
              {summary.topics.map((topic, index) => (
                <article key={index} className="topic">
                  <h3 className="topic-title">
                    {topic.title}
                    <Moment seconds={topic.start_seconds} />
                  </h3>
                  <p className="prose">{topic.summary}</p>
                  {topic.key_points.length > 0 && (
                    <ul className="list">
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
            <section className="section">
              <h2 className="section-label">Decisions</h2>
              {summary.decisions.map((decision, index) => (
                <div key={index} className="topic">
                  <p className="topic-title">
                    {decision.item}
                    <Moment seconds={decision.start_seconds} />
                  </p>
                  <p className="prose">{decision.outcome}</p>
                  {decision.rationale && <p className="topic-meta">{decision.rationale}</p>}
                </div>
              ))}
            </section>
          )}

          {summary.action_items.length > 0 && (
            <section className="section">
              <h2 className="section-label">Action items</h2>
              <ul className="list">
                {summary.action_items.map((item, index) => (
                  <li key={index}>
                    {item.task}
                    {item.owner && <span className="topic-meta"> — {item.owner}</span>}
                    {item.due && <span className="topic-meta"> · due {item.due}</span>}
                    <Moment seconds={item.start_seconds} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {summary.adaptive_sections.map((section, index) => (
            <section key={index} className="section">
              <h2 className="section-label">{section.title}</h2>
              <ul className="list">
                {section.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{item}</li>
                ))}
              </ul>
            </section>
          ))}

          {summary.open_questions.length > 0 && (
            <section className="section">
              <h2 className="section-label">Open questions</h2>
              <ul className="list">
                {summary.open_questions.map((question, index) => (
                  <li key={index}>{question}</li>
                ))}
              </ul>
            </section>
          )}

          {summary.notable_quotes.length > 0 && (
            <section className="section">
              <h2 className="section-label">Notable quotes</h2>
              {summary.notable_quotes.map((quote, index) => (
                <blockquote key={index} className="quote">
                  <p>{quote.text}</p>
                  <footer>
                    {quote.speaker}
                    <Moment seconds={quote.start_seconds} />
                  </footer>
                </blockquote>
              ))}
            </section>
          )}

          {summary.participants.length > 0 && (
            <section className="section">
              <h2 className="section-label">Participants</h2>
              <ul className="list">
                {summary.participants.map((person, index) => (
                  <li key={index}>
                    {person.name}
                    {person.role && <span className="topic-meta"> — {person.role}</span>}
                    {person.contribution && <p className="topic-meta">{person.contribution}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <TranscriptView videoId={videoId} />
        </>
      )}
    </div>
  );
};

export default VideoDetail;
