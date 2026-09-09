import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Loader } from 'lucide-react';
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
    <section className="summary-section">
      <button className="transcript-toggle" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        Full transcript
      </button>

      {isOpen && !transcript && !error && <Loader size={20} className="animate-spin" />}
      {isOpen && error && <p className="form-error">{error}</p>}

      {isOpen && transcript && (
        <div className="transcript-body">
          {transcript.segments.length > 0
            ? transcript.segments.map((segment, index) => (
                <p key={index} className="transcript-line">
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
    <a className="moment moment-link" href={link} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
};

export default TranscriptView;
