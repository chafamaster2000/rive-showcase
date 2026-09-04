import { Mascot } from './sections/Mascot.tsx';
import { Components } from './sections/Components.tsx';
import { Kart } from './sections/Kart.tsx';
import { HowItWasBuilt } from './sections/HowItWasBuilt.tsx';

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
          <a href="#built">how</a>
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
          A character that watches you type, a switch, and a kart driven by a neural network on a track you draw.
          The animation is authored in Rive and every value it reacts to comes from React. The wiring is in the
          open, under each piece.
        </p>
        <Mascot />
        <div id="components" />
        <Components />
        <div id="kart" />
        <Kart />
        <div id="built" />
        <HowItWasBuilt />
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
