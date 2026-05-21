# Prompt: Schulte Table App

Create a one-page, dependency-free JavaScript web app for Schulte table training.

The app should be placed in a `schulte` subdirectory and should consist of plain `index.html`, `styles.css`, and `app.js` files. It must run by opening `index.html` directly in a browser, without a build step or server.

## Core Behavior

Build a responsive Schulte table timer app.

The exercise is performed mentally: the user does not click individual numbers.

The table starts with its numbers hidden. The user starts the run by either pressing the Space key or tapping anywhere on the table. At that moment, the numbers are revealed and the timer starts. The user then mentally finds the numbers in order. Pressing Space again, or tapping the table again, stops the timer and records the result.

After a completed run, pressing Space or tapping the table again should reset the timer and immediately start another run using the same table arrangement. The `New table` button should be the only action that reshuffles the table.

After clicking `New table`, Space should still work immediately. Avoid leaving focus trapped on the button in a way that causes Space to press the button instead of starting the exercise.

## Table Variants

Provide a variant selector with two variants:

- `1-25`: a standard randomized 5x5 Schulte table with numbers 1 through 25.
- `1-24 + dot`: a 5x5 table with a fixed dot in the center cell and numbers 1 through 24 randomized around it.

In the center-dot variant, the dot should remain visible even while the numbers are hidden before the run starts.

Track and display best times separately for each variant using `localStorage`.

## UI Requirements

The app should include:

- Title: `Schulte Table`, localized by language.
- Variant selector.
- Language selector.
- Current timer.
- Best time for the selected variant.
- Main 5x5 table.
- `New table` button.
- Short status message explaining the current action.

Do not include a subtitle such as “Visual attention trainer”.

The full app must fit into the visible viewport on mobile and desktop. Avoid page scrolling in normal use. The table should be the flexible central area and should shrink to fit available height and width.

## Languages

Support these languages:

- English
- Russian
- Ukrainian
- German
- French

Localize all user-facing labels, messages, variant names, title, timer labels, best-time label, and button text.

## Visual Design

Make the app visually polished and pleasant while keeping the Schulte table as the main focus.

Use a clean, restrained app-like interface:

- Soft light background.
- Polished panel surface.
- Clear status strip for timer and best time.
- Square 5x5 grid with refined cells.
- Hidden-number state should look intentional.
- The center dot should be visually distinct.
- Use responsive spacing and sizing.
- Keep cards and controls with modest border radii, about 8px.

The app should be usable on both mobile and desktop. Text should not overflow or overlap. The table, controls, and timer should remain visible together.

## Technical Notes

Use semantic HTML where practical.

Use plain JavaScript:

- Fisher-Yates shuffle for randomization.
- `requestAnimationFrame` for timer updates.
- `localStorage` for language, selected variant, and best times.
- Keyboard handling for Space.
- Tap/click handling on the table.

Use CSS only, no external libraries.

Make sure JavaScript passes `node --check app.js`.
