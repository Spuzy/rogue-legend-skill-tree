# Source layout

```
js/
  main.js              entry — boots all UI modules
  core/                pure data + state, no DOM
    state.js           player state + localStorage persistence
    cost.js            level/range cost math
    stats.js           cross-tree totals + grouped breakdown
    data.js            CSV → tree graph; enrichment hook
    data.generated.js  raw CSV + display names + tree config
    skill_meta.js      loads skill_tree_nodes.json + node_skills.json
    graph.js           isLocked / cascadeRelock / collectPrereqChain
  layout/              node positions
    layout.js          auto-layout for both trees
    overrides.js       hand-tuned coords (currently empty)
  render/              SVG tree rendering
    index.js           pan/zoom + render(); calls openPopup on click
  ui/                  DOM widgets
    dom.js             tiny $() helper
    modal.js           generic confirm modal
    popup/
      index.js         node popup (open/close/render + Set/Plan wiring)
      skillDescription.js  highlights `!value!` and 'keyword' in skill text
    topbar/
      index.js         tabs, search, filter, reset, set planned/filtered
      totalsDetail.js  grouped pets/sentinels/mounts/pvp breakdown chips

css/
  tokens.css   CSS custom properties (colors, sizes)
  base.css     resets, body, layout shell
  icons.css    sprite icon classes
  topbar.css   top bar + search
  sidebar.css  right rail + totals
  canvas.css   SVG stage + nodes + edges + halos
  tabs.css     tree-switcher tabs
  popup.css    node popup
  modal.css    confirm modal

style.css      aggregator — @imports the css/ files in order
index.html     loads style.css + js/main.js (module)
```

## Conventions

- **No build step.** ES modules + native CSS @import.
- **Persistence key**: `rogue_legend_skill_sim_v1` (localStorage).
  `state.search` is intentionally stripped before saving.
- **Data flow**: state mutations → `notify()` → subscribers (render, popup,
  topbar) re-read state. There's no two-way binding.
- **Imports**: relative paths only (no aliases). `core/` never imports from
  `ui/` or `render/`. `ui/` and `render/` may import from `core/`.

## Run locally

```
serve.bat
# → http://localhost:8000
```
