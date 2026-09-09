export type View = 'library' | 'submit' | 'detail';

interface NavbarProps {
  view: View;
  onNavigate: (view: View) => void;
}

const Navbar = ({ view, onNavigate }: NavbarProps) => (
  <nav className="navbar">
    <div className="navbar-content">
      <button className="navbar-brand" onClick={() => onNavigate('library')}>
        vexplico
      </button>

      <div className="navbar-nav">
        <button
          className={`navbar-link ${view === 'submit' ? 'active' : ''}`}
          onClick={() => onNavigate('submit')}
        >
          Analyze
        </button>
        <button
          className={`navbar-link ${view !== 'submit' ? 'active' : ''}`}
          onClick={() => onNavigate('library')}
        >
          Library
        </button>
      </div>
    </div>
  </nav>
);

export default Navbar;
