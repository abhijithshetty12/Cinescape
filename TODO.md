# TODO - Director's Cut Interactive Deck

- [ ] Add dependency for interactive graph rendering (vis-network)
- [ ] Create `src/Pages/DirectorsCut.tsx`:
  - [ ] Build graph UI (search + depth + render canvas)
  - [ ] Fetch TMDB credits for selected person (director/actor)
  - [ ] Build nodes/edges with collaboration weights
  - [ ] Render with vis-network (pan/zoom, click nodes)
  - [ ] Genre-based node color mapping
  - [ ] Inspector panel for selected node
- [x] Wire route in `src/App.js` to `/directors-cut`

- [x] Add CommandMenu action (Cmd/Ctrl+K) to navigate to `/directors-cut`

- [ ] Styling pass (match glassmorphic theme)
- [ ] Build/test: `npm run build` and basic smoke test

