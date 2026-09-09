import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { api } from '../api';
import { formatTimestamp, momentUrl } from '../format';
import type { Transcript } from '../types/summary';

interface TranscriptViewProps {
  videoId: string;
  sourceUrl: string | null;
}

const TranscriptView = ({ videoId, sourceUrl }: TranscriptViewProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || transcript) return;

    api
      .getTranscript(videoId)
      .then(setTranscript)
      .catch((loadError) => setError(loadError.message));
  }, [isOpen, transcript, videoId]);

  return (
    <section className="section">
      <button className="disclosure" onClick={() => setIsOpen(!isOpen)}>
        <ChevronRight size={14} className={`chevron ${isOpen ? 'open' : ''}`} />
        Transcript
      </button>

      {isOpen && !transcript && !error && <p className="muted mt-3">Loading...</p>}
      {isOpen && error && <p className="error-text mt-3">{error}</p>}

      {isOpen && transcript && (
        <div className="transcript">
          {transcript.segments.length > 0
            ? transcript.segments.map((segment, index) => (
                <p key={index}>
                  <Moment seconds={segment.start} sourceUrl={sourceUrl} />
                  {segment.text}
                </p>
              ))
            : transcript.text}
        </div>
      )}
    </section>
  );
};

export const Moment = ({ seconds, sourceUrl }: { seconds: number; sourceUrl: string | null }) => {
  if (!seconds) return null;

  const label = formatTimestamp(seconds);
  const link = momentUrl(sourceUrl, seconds);

  if (!link) return <span className="moment">{label}</span>;

  return (
    <a className="moment" href={link} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
};

export default TranscriptView;
