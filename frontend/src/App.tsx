import { useEffect, useState } from 'react';
import './App.css';
import { api } from './api';
import Navbar, { type View } from './components/Navbar';
import SubmitForm from './components/SubmitForm';
import VideoDetail from './components/VideoDetail';
import VideoLibrary from './components/VideoLibrary';

const App = () => {
  const [view, setView] = useState<View>('library');
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [isBackendReachable, setIsBackendReachable] = useState(true);

  useEffect(() => {
    api.health().catch(() => setIsBackendReachable(false));
  }, []);

  const openVideo = (videoId: string) => {
    setSelectedVideoId(videoId);
    setView('detail');
  };

  const openLibrary = () => {
    setSelectedVideoId(null);
    setView('library');
  };

  return (
    <div className="app-container">
      <Navbar view={view} onNavigate={(next) => (next === 'library' ? openLibrary() : setView(next))} />

      {!isBackendReachable && (
        <div className="banner-error">The analysis server is not reachable.</div>
      )}

      {view === 'submit' && <SubmitForm onSubmitted={openVideo} />}
      {view === 'library' && <VideoLibrary onSelect={openVideo} />}
      {view === 'detail' && selectedVideoId && (
        <VideoDetail videoId={selectedVideoId} onBack={openLibrary} onDeleted={openLibrary} />
      )}
    </div>
  );
};

export default App;
