import { Library, Plus } from 'lucide-react';

export type View = 'library' | 'submit' | 'detail';

interface NavbarProps {
  view: View;
  onNavigate: (view: View) => void;
}

const Navbar = ({ view, onNavigate }: NavbarProps) => (
  <header className="navbar">
    <div className="navbar-content">
      <button className="navbar-brand" onClick={() => onNavigate('library')}>
        <img src="/logo.png" alt="" className="navbar-logo" />
        <span>Explico</span>
      </button>

      <nav className="navbar-nav">
        <button
          className={`navbar-link ${view === 'library' || view === 'detail' ? 'active' : ''}`}
          onClick={() => onNavigate('library')}
        >
          <Library size={16} />
          <span>Library</span>
        </button>
        <button
          className={`navbar-link ${view === 'submit' ? 'active' : ''}`}
          onClick={() => onNavigate('submit')}
        >
          <Plus size={16} />
          <span>Analyze video</span>
        </button>
      </nav>
    </div>
  </header>
);

export default Navbar;
