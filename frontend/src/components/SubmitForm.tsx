import { useRef, useState } from 'react';
import { Loader } from 'lucide-react';
import { api } from '../api';

interface SubmitFormProps {
  onSubmitted: (videoId: string) => void;
}

type Mode = 'url' | 'file';

const SubmitForm = ({ onSubmitted }: SubmitFormProps) => {
  const [mode, setMode] = useState<Mode>('url');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = mode === 'url' ? url.trim().length > 0 : file !== null;

  const submit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = mode === 'url' ? await api.submitUrl(url.trim()) : await api.submitFile(file!);
      setUrl('');
      setFile(null);
      onSubmitted(result.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const dropFile = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files[0]) setFile(event.dataTransfer.files[0]);
  };

  return (
    <div className="page">
      <h1 className="page-title">Analyze a video</h1>
      <p className="page-subtitle">
        Paste a link or upload a recording. Explico transcribes it, works out what kind of recording
        it is, and writes a summary that fits it.
      </p>

      <div className="tabs">
        <button className={`tab ${mode === 'url' ? 'active' : ''}`} onClick={() => setMode('url')}>
          Link
        </button>
        <button className={`tab ${mode === 'file' ? 'active' : ''}`} onClick={() => setMode('file')}>
          Upload
        </button>
      </div>

      {mode === 'url' ? (
        <input
          type="url"
          className="input input-lg"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      ) : (
        <div
          className={`dropzone ${isDragging ? 'dragging' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={dropFile}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,audio/*"
            hidden
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          {file ? file.name : 'Drop a video or audio file, or click to browse'}
        </div>
      )}

      {error && <p className="error-text mt-3">{error}</p>}

      <button
        className="btn btn-primary mt-4"
        onClick={submit}
        disabled={!canSubmit || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader size={16} className="animate-spin" /> Submitting
          </>
        ) : (
          'Start analysis'
        )}
      </button>
    </div>
  );
};

export default SubmitForm;
