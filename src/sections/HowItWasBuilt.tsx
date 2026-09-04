const REPO = 'https://github.com/chafamaster2000/rive-showcase';

/**
 * The part a reader cannot see from the pieces themselves: the artboards on this
 * page were authored programmatically, and two runtime limits shaped the code.
 */
export function HowItWasBuilt() {
  return (
    <section className="built">
      <h2>How the artboards got here</h2>
      <div className="built-grid">
        <article>
          <h3>Authored from the terminal</h3>
          <p>
            The shapes, timelines, View Models and state machines were not drawn by hand. They were created through
            the Rive editor's own automation interface, driven from a coding agent: create the artboard, key the
            timelines, wire the transitions, simulate the machine, export the runtime file.
          </p>
        </article>
        <article>
          <h3>Contract first</h3>
          <p>
            Every piece started as a written contract of artboard, View Model and properties, so the page was built
            and tested before any art existed. A piece whose file is missing renders a value inspector instead, and
            the control in the header puts every piece into that view, drawn or not.
          </p>
        </article>
        <article>
          <h3>What the runtime taught us</h3>
          <p>
            Rive listeners that write into a View Model never reach the bound instance in the current web runtime,
            so all input stays in React and the animation stays in Rive. The editor exports only a file's first
            artboard, so all five were built there in turn, each exported before the next replaced it. And a data
            bind writes raw values while the inspector shows percentages, which costs an hour the first time.
          </p>
        </article>
      </div>
      <p className="built-links">
        <a href={`${REPO}/blob/main/docs/rive-contract.md`} target="_blank" rel="noreferrer">
          read the contract
        </a>
        <span aria-hidden="true"> · </span>
        <a href={REPO} target="_blank" rel="noreferrer">
          read the source
        </a>
      </p>
    </section>
  );
}
