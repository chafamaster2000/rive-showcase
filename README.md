# rive-showcase

Rive state machines, driven from React. Live at https://chafamaster2000.github.io/rive-showcase/

- **A character** that reads your cursor and your keystrokes. Eyes, face and body track the pointer through data binds with formula converters, so there is no animation to blend. Three state machine layers handle idle breathing, typing and covered eyes, and the reactions to signing in.
- **A switch, a button and a loader.** The switch and the button are state machines on two layers each; the loader turns one number into a trimmed ring through a formula converter, with no animation in between. React owns the input and the accessibility.
- **A kart** driven by a 74-weight neural network, trained by neuroevolution in [AutoCheems](https://github.com/chafamaster2000/AutoCheems) and running inference only here, on a track you paint. `?run=1` starts it on load.

Every piece declares its artboard, View Model and properties in [`docs/rive-contract.md`](docs/rive-contract.md) before any art exists, so the page can be built and tested against the contract. Pieces whose artboard is still pending render a value inspector instead, and the header lets you put *every* piece into that view.

```bash
npm install
npm run dev      # local
npm test         # the driver and the track editor
npm run build
npm run deploy   # gh-pages
```

Stack: Vite, React 19, TypeScript, `@rive-app/react-canvas` with data binding, Framer Motion.

## Authoring

The artboards were built through the Rive editor's automation interface rather than by hand. `docs/rive-contract.md` records what that workflow demands: one Rive file per piece, a file reload before anything authored that way can be exported, and formulas that must produce units rather than percentages.

All five artboards are authored, each in turn on the same file's first artboard. `art/workspace.rev` is a backup of the editor document.
