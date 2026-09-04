import { Mascot } from './sections/Mascot.tsx';
import { Components } from './sections/Components.tsx';
import { Kart } from './sections/Kart.tsx';
import { HowItWasBuilt } from './sections/HowItWasBuilt.tsx';
import { ViewModeProvider } from './rive/ViewMode.tsx';

const REPO = 'https://github.com/chafamaster2000/rive-showcase';
const CV = 'https://chafamaster2000.github.io/cv/index-motion.html';
const EMAIL = 'castroignacio888@gmail.com';

export default function App() {
  return (
    <ViewModeProvider>
      {(viewControl) => (
        <>
          <header className="top">
            <div className="who">
              <span className="name">Ignacio Castro</span>
              <span className="tag">Senior front end · UI &amp; motion · open to work</span>
            </div>
            <nav>
              {viewControl}
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
            <div className="lede-block">
              <h1 className="lede">Rive state machines, driven from React.</h1>
              <p className="intro">
                Three things you can poke: a character that reads your cursor and your keystrokes, a switch whose
                motion lives entirely in a state machine, and a kart a neural network drives around a track you
                paint. Two of them are Rive artboards; the rest is the harness that drives them, and the code for
                each is on the page.
              </p>
            </div>
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
              React 19, TypeScript, <code>@rive-app/react-canvas</code> data binding, Framer Motion.
            </span>
            <a href={`mailto:${EMAIL}`}>hire me →</a>
          </footer>
        </>
      )}
    </ViewModeProvider>
  );
}
