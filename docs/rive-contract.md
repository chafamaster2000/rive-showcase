# Rive contract

Every animated piece on the site is a `.riv` file drawn in the Rive editor and
driven from React through **data binding** (View Models), which is the current
Rive API. State machine inputs and Rive Events are deprecated in the runtime, so
nothing here uses them.

The site ships with a **placeholder** for every piece: a box that shows the
property values in real time. Drop the real file in `public/rive/<piece>.riv`
with the names below and the placeholder is replaced on reload. Nothing else
changes.

## Rules that apply to every file

| What | Value |
|---|---|
| File | `public/rive/<piece>.riv` (lowercase, one artboard per file) |
| Artboard | named like the piece, capitalised: `Mascot`, `Button`, `Toggle`, `Loader`, `Kart` |
| State machine | exactly one, named `SM` |
| View Model | one, named like the artboard, **set as the artboard's default instance** (the runtime loads it with `autoBind`) |
| Properties | exact names and types below; numbers are plain floats |
| Direction React → Rive | numbers, booleans, strings, triggers that React fires |
| Direction Rive → React | triggers the state machine fires (React subscribes to them) |

In the editor: create the View Model, add the properties, bind them in the
state machine (conditions, blend inputs, listeners), and pick that View Model as
the artboard's default with a default instance.

## `mascot.riv` — the character on the hero

Reacts to cursor, clicks, scroll and the login form next to it.

| Property | Type | Range | Set by | Meaning |
|---|---|---|---|---|
| `lookX` | number | -1 .. 1 | React | cursor position relative to the artboard centre, horizontal |
| `lookY` | number | -1 .. 1 | React | same, vertical (positive = below) |
| `hover` | boolean | | React | cursor is over something clickable on the page |
| `typing` | boolean | | React | a text field has focus |
| `textLength` | number | 0 .. 40 | React | characters typed in the focused field (eyes follow the caret) |
| `coverEyes` | boolean | | React | the password field has focus |
| `scroll` | number | 0 .. 1 | React | page scroll progress |
| `poke` | trigger | | React | the user clicked on the character |
| `success` | trigger | | React | login succeeded |
| `fail` | trigger | | React | login failed |
| `laughed` | trigger | | **Rive** | fire at the end of the poke reaction; React counts them |

## `button.riv` — a primary button

| Property | Type | Range | Set by | Meaning |
|---|---|---|---|---|
| `label` | string | | React | text on the button |
| `hover` | boolean | | React | |
| `pressed` | boolean | | React | pointer is down |
| `loading` | boolean | | React | spinner state after click |
| `done` | trigger | | React | success flourish when loading ends |

Artboard size 220 × 64. The button is not clickable inside Rive: React wraps it
in a real `<button>` so it stays accessible.

## `toggle.riv` — a switch, two-way

| Property | Type | Range | Set by | Meaning |
|---|---|---|---|---|
| `on` | boolean | | **both** | the switch state. A Rive listener on the knob flips it; React also sets it from a checkbox and subscribes to changes |
| `hover` | boolean | | React | |

Artboard size 96 × 48. Put a **pointer listener** in the state machine that
toggles `on` on click: the point of this piece is that Rive owns the
interaction and React only observes it.

## `loader.riv` — a progress loader

| Property | Type | Range | Set by | Meaning |
|---|---|---|---|---|
| `progress` | number | 0 .. 100 | React | |
| `finished` | trigger | | **Rive** | fire when the completion animation ends (after `progress` reaches 100); React shows a message |

Artboard size 160 × 160.

## `kart.riv` — the driver, seen from above

Sits on top of the track canvas and is moved and rotated by React every frame.
The artboard must point **to the right (+x)** at rest; React rotates it.

| Property | Type | Range | Set by | Meaning |
|---|---|---|---|---|
| `speed` | number | 0 .. 1 | React | fraction of top speed (wheels, motion blur, engine shake) |
| `steer` | number | -1 .. 1 | React | smoothed steering, negative = left |
| `scared` | boolean | | React | a wall is closer than 20% of sensor range (the driver's face) |
| `crash` | trigger | | React | the car hit a wall and was reset |
| `lap` | trigger | | React | a lap was completed |

Artboard size 64 × 40, transparent background.
