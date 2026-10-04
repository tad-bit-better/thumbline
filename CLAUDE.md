# CLAUDE.md

@AGENTS.md

## Claude Code specifics

**Start of a session:** read `PLAN.md` for the current milestone and `docs/engine-spec.md` for contracts. For UI tasks also read `docs/design/design-system.md`, `docs/design/motion.md` and `docs/design/screens.md`. "Next task" means the first unchecked box in the current milestone.

**Workflow per task**
1. Restate the task; list files you'll change.
2. Engine work: failing test first, then implementation.
3. UI work: build the component in `packages/ui` with Storybook stories (default, hover, focus, disabled, dark, reduced motion) before using it in `apps/web`.
4. Run `pnpm nx test <project>` and `pnpm nx lint <project>`; fix failures.
5. Summarise changes, tests run, and any `MUSIC-REVIEW` / `DESIGN-REVIEW` comments.

**References**
- `docs/prototype/thumbline.html`: parser, voicings, capo, alt-bass, SVG tab, Karplus-Strong synth.
- Canvas design prototype (screens + motion kit): https://claude.ai/artifact/FgGxQWiVMV8cXMyPSh3MES

**Ask before you**
- add a dependency
- change a contract in `docs/engine-spec.md` or a token in `tokens.css`
- change module boundaries or Nx config
- delete or rewrite more than one existing test file

**Don't**
- run `pnpm nx reset` or delete `node_modules` without saying why
- accept snapshot updates without showing at least one diff
- add network calls from `audio-analysis` or `playback`
- hardcode colours or timings in components

**Starter prompts**
- "Start M1: port the chord parser and voicing library from the prototype into packages/engine with tests."
- "Start M2: implement tokens.css stories and the SegmentedControl with the sliding pill."
- "Build the Pick 3D icon and the Pick drop LottieMoment placeholder with a CSS fallback."
- "Implement the Review screen per docs/design/screens.md using packages/ui components."
