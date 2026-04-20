# Implementation Plan: LoreDuel "Grimoire Edition" Redesign

This plan outlines the steps to implement the "Arcane Cyber HUD" design system in the LoreDuel project.

## Phase 1: Foundation (CSS Refactoring)
- **Goal:** Establish the new design system in `src/styles/loreduel.css`.
- **Tasks:**
    - [ ] Update root variables (Colors, Fonts, Glassmorphism tokens).
    - [ ] Implement the "No-Line" rule (tonal shifts instead of borders).
    - [ ] Add technical textures (Grid background, scanlines).
    - [ ] Create the "Amber Glow" utility for interactive elements.
    - [ ] Set all border-radii to 0px.

## Phase 2: Layout Transformation (`LoreDuelApp.tsx`)
- **Goal:** Align the main application shell with the 3-column HUD layout.
- **Tasks:**
    - [ ] Reconfigure the `.battlefield` grid for desktop (3 columns: Player | Arena | Rival).
    - [ ] Update the `.topbar` to use higher backdrop-blur and a sleek, italic serif brand style.
    - [ ] Implement conditional rendering for "HUD Corners" (technical metadata).

## Phase 3: Component Refinement
- **Goal:** Update sub-components to match the high-fidelity aesthetic.
- **Tasks:**
    - [ ] **PortraitCard:** Update with recessed glass style and atmospheric lighting.
    - [ ] **CombatMeta:** Redesign resolve bars as segment-lit LED gradients.
    - [ ] **OracleFeed:** Create the "Oracle's Chamber" glass panel with high-contrast narration.
    - [ ] **MoveControls:** Redesign move cards as tactical chips with amber hover pulses.

## Phase 4: Polish & Interaction
- **Goal:** Add micro-animations and final visual tweaks.
- **Tasks:**
    - [ ] Refine Framer Motion transitions (Sync with HUD feel).
    - [ ] Implement "The Pulse" effect for successful transactions.
    - [ ] Final UI/UX audit against modern design standards.
