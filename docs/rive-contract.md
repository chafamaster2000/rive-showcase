# Rive contract

Every animated piece on the site is an artboard drawn in the Rive editor and
driven from React through **data binding** (View Models), which is the current
Rive API. State machine inputs and Rive Events are deprecated in the runtime, so
nothing here uses them.

Each piece is its own Rive file, drawn on that file's **first** artboard, and
exported to `public/rive/<piece>.riv`. A piece whose file is not there yet
renders a **placeholder** instead: a box showing its property values in real
time. Drop the file in with the names below and the placeholder is replaced on
reload. Nothing else changes.

## Rules that apply to every file

| What | Value |
|---|---|
| File | `public/rive/<piece>.riv`, one file per piece |
| Artboard | named like the piece, capitalised: `Mascot`, `Button`, `Toggle`, `Loader`, `Kart` |
| State machine | exactly one, named `SM` |
| View Model | one, named like the artboard, **set as the artboard's default instance** (the runtime loads it with `autoBind`) |
| Properties | exact names and types below; numbers are plain floats |
| Direction | React writes numbers, booleans, strings and triggers; the state machine reads them |

In the editor: create the View Model, add the properties, bind them in the state
machine (transition conditions, and data binds with a formula converter for
anything continuous), and set that View Model as the artboard's default with a
default instance.

**Editor notes (Early Access + MCP).** Four things to know when a piece is
authored through the Rive MCP rather than by hand. `scripts/rive_author.py`
encodes all of them.

1. `export_file` writes only the file's **first** artboard. A second artboard,
   however it is created, never reaches the `.riv` and the runtime then reports
   "Invalid artboard name". Hence one Rive file per piece.
2. A data bind writes the **raw** property, while the editor's inspector shows
   scale and opacity as percentages. A formula written as `100 + n` therefore
   lands as a 100x scale at runtime, not 100%. Scale formulas must produce
   units: `1 + n`. Converters and data binds, unlike shapes and timelines, do
   reach the export without a reload, so this is cheap to correct.
3. Objects created through the MCP are not exportable until the file is
   **reopened** in the editor: before that the editor reports "no stage
   representation" for them and the export silently leaves them out. So the
   loop is author → reload the file → export.
4. The editor cannot open a file over the MCP, and there is no export to disk:
   it is sandboxed, so the export comes back as base64 and the script writes it.

## `mascot.riv` — the character on the hero

Reacts to cursor, clicks, scroll and the login form next to it. `lookX` and
`lookY` reach the eyes, face and body as data binds with a formula converter,
not as animations, so the tracking has no blend lag. The rest drives a state
machine of three layers: idle breathing and blinking, a face layer for typing
and covered eyes, and a reactions layer for the three triggers.

| Property | Type | Range | Set by | Meaning |
|---|---|---|---|---|
| `lookX` | number | -1 .. 1 | React | cursor position relative to the artboard centre, horizontal |
| `lookY` | number | -1 .. 1 | React | same, vertical (positive = below) |
| `typing` | boolean | | React | a text field has focus |
| `textLength` | number | 0 .. 40 | React | characters typed in the focused field; the pupils dilate with it |
| `coverEyes` | boolean | | React | the password field has focus |
| `scroll` | number | 0 .. 1 | React | page scroll progress; the shadow shrinks as the page moves |
| `poke` | trigger | | React | the user clicked on the character |
| `success` | trigger | | React | login succeeded |
| `fail` | trigger | | React | login failed |

Triggers React fires do reach the state machine. Nothing flows the other way:
see the note under `toggle.riv`.

## `button.riv` — a primary button

| Property | Type | Range | Set by | Meaning |
|---|---|---|---|---|
| `hover` | boolean | | React | |
| `pressed` | boolean | | React | pointer is down |
| `loading` | boolean | | React | spinner state after click |
| `done` | trigger | | React | success flourish when the work ends |

Artboard size 220 × 64, on two state machine layers: `Feel` (rest, hover,
press) and `Work` (rest, loading dots, a done flourish), so a press still reads
while work is in flight. React wraps the canvas in a real `<button>` and keeps
the label in the DOM, where a screen reader and a translator can reach it.

## `toggle.riv` — a switch, two-way

| Property | Type | Range | Set by | Meaning |
|---|---|---|---|---|
| `on` | boolean | | React | the switch state; one layer blends Off ↔ On from it |
| `hover` | boolean | | React | a second layer scales the knob |

Artboard size 96 × 48. React owns the pointer (a real `<button role="switch">`
wraps the canvas, so the piece stays keyboard accessible); the state machine
owns the motion, on two independent layers.

**Why input lives in React.** Rive listeners with a `viewModelChange` action are
authored fine in the Early Access editor and the runtime reports the file *has*
listeners, but their writes never reach the bound View Model in
`@rive-app/canvas` 2.42 — click, hover and press were all tested. Values Rive
would report back have the same problem, so every property here flows one way,
React → Rive. Retest when the runtime catches up with the editor.

## `loader.riv` — a progress loader

| Property | Type | Range | Set by | Meaning |
|---|---|---|---|---|
| `progress` | number | 0 .. 100 | React | drives a trim path on the ring and the size of the core, through formula converters |
| `done` | boolean | | React | true at 100: a second layer takes the ring out and pops the core |

Artboard size 160 × 160. The ring spins on the base layer; `Progress` is the
layer that reacts to `done`.

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
