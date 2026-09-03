import { Mascot } from './sections/Mascot.tsx';
import { Components } from './sections/Components.tsx';
import { Kart } from './sections/Kart.tsx';

const REPO = 'https://github.com/chafamaster2000/rive-showcase';
const CV = 'https://chafamaster2000.github.io/cv/index-motion.html';

export default function App() {
  return (
    <>
      <header className="top">
        <div>
          <span className="name">Ignacio Castro</span>
          <span className="tag">Rive, driven from React</span>
        </div>
        <nav>
          <a href="#components">components</a>
          <a href="#kart">kart</a>
          <a href={REPO} target="_blank" rel="noreferrer">
            source
          </a>
          <a href={CV} target="_blank" rel="noreferrer">
            résumé
          </a>
        </nav>
      </header>

      <main>
        <p className="intro">
          Everything that moves on this page is a Rive state machine with a View Model, and every value it shows
          comes from React. The files are drawn in the Rive editor; the wiring is in the open, under each piece.
        </p>
        <Mascot />
        <div id="components" />
        <Components />
        <div id="kart" />
        <Kart />
      </main>

      <footer>
        <span>
          Built with React, <code>@rive-app/react-canvas</code> and Framer Motion. Placeholders show the live contract
          of any piece whose <code>.riv</code> is not in yet.
        </span>
        <a href={`${REPO}/blob/main/docs/rive-contract.md`} target="_blank" rel="noreferrer">
          the contract
        </a>
      </footer>
    </>
  );
}
