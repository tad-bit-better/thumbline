# Screens

Canvas prototype: https://claude.ai/artifact/FgGxQWiVMV8cXMyPSh3MES (interactive: press Play on a screen).
All screens: max content width 1200–1240px, fluid down to 360px; nav with logo left, contextual actions or stepper right.

## 1. Upload (`/`)
- **Hero (left):** display headline "Turn any song into a right-hand sheet.", one-line description, primary 3D button "Choose a file", text link "or try a sample clip".
- **Drop zone (right):** large white card, animated dashed border, floating 3D pick (bob loop), "Drop an audio clip here", "MP3, WAV or M4A, up to 8 minutes". Whole card is the drop target and a button. On drag-over the border turns violet and the pick speeds up; on drop play Pick drop (#1) then transition.
- **Styles section:** three StyleCards with 3D icons.
- **How it works:** four numbered steps (Drop a clip, We listen, You check, Play along).
- **Errors:** unsupported type, too long, silent file → inline message inside the drop zone with a retry.

## 2. Listening (`/listen`)
- Stepper at "Listen".
- Centered card: 3D metronome (#3, tempo-synced after the beat is found), title "Listening to your song", "Everything runs on your device", file chip (name, duration).
- Waveform bars (#2), progress bar with shimmer.
- Step list: Decoding the audio → Finding the beat (shows "92 bpm, 4/4") → Hearing the chords (shows "bar 23 of 48") → Following the tune (M9) → Writing your sheets.
- Cancel button returns to Upload. Auto-advance to Review when done.

## 3. Review (`/review`)
- Stepper at "Review". Title "Check the chords", hint "Tap a chord with an orange ring to pick a better match."
- **Chord grid:** 8 columns (4 on mobile), one ChordBlock per bar, paginated by 16 bars with a mini-map for long songs. Counter "2 chords to check" → "All chords checked".
- **Popover on a low-confidence block:** top 3 alternatives with confidence bars and percentages; choosing one plays Chord confirmed (#4). Tapping a confident block also opens the popover (all chords editable), just not highlighted.
- **Side panel:** Tempo, Key, Time (4/4 · 3/4 segmented), Mood (Sad · Warm · Intense · Happy segmented, preset to what we heard, with a note when the user picks another; M10, DESIGN-REVIEW: not in the original design). Primary button "Looks good, write my sheets". Note "You can come back and change chords any time."
- Optional: tapping a block plays that bar of the original.

## 4. Sheet (`/sheet`)
v2 (2026-10-06, from the user's mock): use the width; the tab is the page, everything else sits around it.

- **Header:** eyebrow "Your sheet", the song as h1 (the clip's file name without its extension, underscores or a download site's tag; title and artist aren't split, since files put them either way round). Facts on the right as small stat boxes: Key ("F major · sounds B♭" under a capo), Capo ("5th fret" / "None"), Time ("4/4"), Original tempo ("76 bpm"), then "Edit chords" (to Review). "New song" stays in the nav.
- **Arrangement bar** (card, full width): label "Arrangement" over "Fingerstyle · Advanced · Warm · Pop groove" (style, level, mood, pattern). Right: "Pattern 2 of 7" between previous/next chevrons, **Display** (secondary; a popover with chord names Shape · Sounding · Both, tab size S · M · L, fingering letters and legend checkboxes, saved with the song) and **Customize** (primary), which opens a side panel from the right (a bottom sheet under 720px) holding Style (a segmented control with a one-line description; the big style cards stay on Upload), Level, Palo, **Fullness** (a 1–10 slider, "Sparse" to "Full", with "Higher fills the pauses in the tune and adds harmony under it. It never plays faster."; saved like the level; user, 2026-10-07), the Feel card (mood, energy, colour) and the pattern's name and how-to. The tab stays visible behind it, so changes are seen and heard.
- **Notices** under the bar: one summary line for the warnings ("3 chords are simplified and 2 chords need a barre. Review chords") and "Add the tune" when the song has none.
- **Desktop (≥ 1100px): two columns.** (2026-10-06: the user's mock had a sections and display column on the left; dropped because the section names are only letters and the column cost a card per row. Display moved to the arrangement bar.)
  - Main: a one-line legend (when on), then the tab as **bar cards** in a grid under section headings (Section A, B, A… with their bars: the headings show where the song repeats). Each card: bar number, chord name(s) with what they sound like, badges (Barre, Simplified); the strings without the chord lane. The playing bar's card is highlighted (violet-soft fill, violet ring) and carries the playhead. Columns from the tab size: S ≈ 190px, M ≈ 240px, L ≈ 330px a card. The Sheet page may grow to 1440px wide (other pages stay at 1200px).
  - Right (260px, sticky, scrolls on its own and takes focus for that): **Now and next**, the playing chord's diagram (highlighted) and the next one. **Chord shapes**, every shape in order with "sounds …" and its badges (Barre, Simplified).
- **Tablet (720–1099px):** one column; the right column moves above the tab as a strip (now/next, then the shapes scrolling sideways).
- **Phone (< 720px):** now/next above the tab (shapes hidden), one bar card per row, the player at the end of the page.
- **Sticky player bar:** as before (play sphere, now-playing line, Sheet · Original · Both, an "Original volume" slider while Both plays (saved with the song; user, 2026-10-06: keep the recording quiet under the sheet), speed, loop). Playhead glow (#7). First full play (#8). Count-in, a bpm stepper and bar-range loops are not in this version (user, 2026-10-06: "not sure about this yet").
- Keyboard: Space play/pause, L loop, ←/→ previous/next bar, 1/2/3 level, F back to the playhead.
- Tab notation stays as it is (tune notes bold on an orange chip, thumb notes on a violet chip); the mock's circled tune and underlined bass are deferred.
