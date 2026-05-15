# Rogue Legend — Skill Tree Simulator

Visualize Adventure & Specialization skill trees, plan upgrades, and see book/gem/time costs (with ad-skip discount).

## Run

ES modules can't be loaded over `file://` in most browsers. Double-click **`serve.bat`** to start a local Python static server, then open <http://localhost:8000/>.

Manual:

```
py -3 -m http.server 8000
```

## Usage

- **Click a node** → popup with each level's books, time and ad-discounted gem cost.
- **Set** button → records the level you currently own in-game.
- **Plan** button → marks a target level for that node.
- The **top bar** sums books / gems / time to move every node in the active tree from current → planned.
- **Budget filter** (top bar): enter your book + gem budget and toggle on. Every node where you can afford at least one level beyond current glows green; in the popup the affordable rows are tinted, so you can see how high you can push each skill within your budget.
- Adventure / Specialization are calculated separately; switch via the tabs at the bottom.
- **Reset** clears all current levels and plans (with confirmation).
- All state auto-saves to `localStorage`.
- Drag to pan, scroll to zoom.

## Cost model

Each level can be ad-skipped 4 times; each ad reduces by `max(10% of time, 5 min)`. Combined per level: reduction = `max(20 min, time × 0.40)`. So:

- ≤ 20 min levels → completely free of gems.
- 20–50 min → paid time = `time − 20`.
- \> 50 min → paid time = `time × 0.60`.

Gems per level = `ceil(paidMinutes) × gemsPerMinute` (15 Adventure, 10 Specialization).

## Customizing layout

Edit [`js/layoutOverrides.js`](js/layoutOverrides.js) to nudge specific nodes:

```js
export const LAYOUT_OVERRIDES = {
  adventure: { '5_2': { x: 60, y: 540 } },
  specialization: {},
};
```
