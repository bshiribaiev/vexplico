import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { api } from '../api';
import { formatTimestamp } from '../format';
import type { Transcript } from '../types/summary';

const TranscriptView = ({ videoId }: { videoId: string }) => {
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
                  <Moment seconds={segment.start} />
                  {segment.speaker && <span className="speaker">Speaker {segment.speaker}</span>}
                  {segment.text}
                </p>
              ))
            : transcript.text}
        </div>
      )}
    </section>
  );
};

export const Moment = ({ seconds }: { seconds: number }) => {
  if (!seconds) return null;

  return <span className="moment">{formatTimestamp(seconds)}</span>;
};

export default TranscriptView;
