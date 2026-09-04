# rive-showcase

A one-page Rive showcase, driven from React. Live at https://chafamaster2000.github.io/rive-showcase/

- A character that follows the cursor and reacts to a login form.
- A button, a toggle and a loader: state machines with View Models, two-way where it matters.
- A kart driven by a 74-weight neural network (trained by neuroevolution in [AutoCheems](https://github.com/chafamaster2000/AutoCheems), inference only here) on a track you draw. Rive draws the kart.

Add `?run=1` to the URL to start the kart on load. Every piece is a `.riv` in `public/rive/` following [`docs/rive-contract.md`](docs/rive-contract.md). Until a file is there, the site renders a placeholder with the live property values, so the wiring can be built and tested before the art exists.

```bash
npm install
npm run dev      # local
npm run build
npm run deploy   # gh-pages
```

Stack: Vite, React 19, TypeScript, `@rive-app/react-canvas` (data binding), Framer Motion.
