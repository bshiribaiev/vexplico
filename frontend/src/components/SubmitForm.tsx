import { useRef, useState } from 'react';
import { Loader } from 'lucide-react';
import { api } from '../api';

interface SubmitFormProps {
  onSubmitted: (videoId: string) => void;
}

const SubmitForm = ({ onSubmitted }: SubmitFormProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!file) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await api.submitFile(file);
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
        Upload a recording. Vexplico transcribes it, works out what kind of recording it is, and
        writes a summary that fits it.
      </p>

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

      {error && <p className="error-text mt-3">{error}</p>}

      <button className="btn btn-primary mt-4" onClick={submit} disabled={!file || isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader size={16} className="animate-spin" /> Uploading
          </>
        ) : (
          'Start analysis'
        )}
      </button>
    </div>
  );
};

export default SubmitForm;
