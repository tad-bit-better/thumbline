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
- Cancel button returns to Upload. Auto-advance to the Sheet when done.

## 3. Review (removed 2026-10-08)
Chords are checked on the Sheet, where the reader can hear the bar and the arrangement at once (user, 2026-10-08: "that way we can remove review screen altogether"). `/review` redirects to `/sheet`; the stepper is Upload · Listen · Play. Time (4/4 · 3/4) moved into Customize; Mood was already there. Customize also has **Tempo** (Half · As heard · Double, saved with the song; 2026-10-08) for when the beat finder locked onto twice or half the song's pulse.

## 4. Sheet (`/sheet`)
v2 (2026-10-06, from the user's mock): use the width; the tab is the page, everything else sits around it.

- **Header:** eyebrow "Your sheet", the song as h1 (the clip's file name without its extension, underscores or a download site's tag; title and artist aren't split, since files put them either way round). Facts on the right as small stat boxes: Key ("F major · sounds B♭" under a capo), Capo ("5th fret" / "None"), Time ("4/4"), Original tempo ("76 bpm"). "New song" stays in the nav.
- **Arrangement bar** (card, full width): label "Arrangement" over "Fingerstyle · Advanced · Warm · Pop groove" (style, level, mood, pattern). Right: "Pattern 2 of 7" between previous/next chevrons, **Display** (secondary; a popover with chord names Shape · Sounding · Both, tab size S · M · L, fingering letters and legend checkboxes, saved with the song) and **Customize** (primary), which opens a side panel from the right (a bottom sheet under 720px) holding Style (a segmented control with a one-line description; the big style cards stay on Upload), Level, Palo, **Fullness** (a 1–10 slider, "Sparse" to "Full", with "Higher fills the pauses in the tune and adds harmony under it. It never plays faster."; saved like the level; user, 2026-10-07), the Feel card (mood, energy, colour) and the pattern's name and how-to. The tab stays visible behind it, so changes are seen and heard.
- **Notices** under the bar: one line, "2 chords might be off. Tap a chord to hear the bar or change it. Check them" (orange when something is flagged, neutral otherwise) with the shape warnings after it ("3 chords are simplified and 2 chords need a barre."); "Your chords sit better with a capo on the 3rd fret. Use capo 3" after chord changes; "Add the tune" when the song has none.
- **Chords on the cards (2026-10-08, replaces Review):** each card's chord name is a button (dotted underline) opening a popover: the bar's chords as we heard them with our other guesses (rank bars, "heard" / "yours" tags), "Something else" (root grid and type chips, "Use B♭m"), "Hear this bar" (the original, that bar), and "Next to check (n left)". A pick re-arranges at once, plays Chord confirmed (#4) over the chord and is saved with the song. Unsure chords carry a dot with a mark, never colour alone: orange "?" might be off, rose "!" likely off; the reader's picks a violet tick; confident chords nothing. Flags are by rank: the least sure 12% of the song's chords under 0.35 confidence, the lowest third of those likely off (confidence runs low on some songs, so a fixed cut would flag half). The capo the sheet was first written with stays when chords change.
- **Desktop (≥ 1100px): two columns.** (2026-10-06: the user's mock had a sections and display column on the left; dropped because the section names are only letters and the column cost a card per row. Display moved to the arrangement bar.)
  - Main: a one-line legend (when on), then the tab as **bar cards** in a grid under section headings (Section A, B, A… with their bars: the headings show where the song repeats). Each card: bar number, chord name(s) with what they sound like, badges (Barre, Simplified); the strings without the chord lane. The playing bar's card is highlighted (violet-soft fill, violet ring) and carries the playhead. Columns from the tab size: S ≈ 190px, M ≈ 240px, L ≈ 330px a card. The Sheet page may grow to 1440px wide (other pages stay at 1200px).
  - Right (260px, sticky, scrolls on its own and takes focus for that): **Now and next**, the playing chord's diagram (highlighted) and the next one. **Chord shapes**, every shape in order with "sounds …" and its badges (Barre, Simplified).
- **Tablet (720–1099px):** one column; the right column moves above the tab as a strip (now/next, then the shapes scrolling sideways).
- **Phone (< 720px):** now/next above the tab (shapes hidden), one bar card per row, the player at the end of the page.
- **Sticky player bar:** as before (play sphere, now-playing line, Sheet · Original · Both, an "Original volume" slider while Both plays (saved with the song; user, 2026-10-06: keep the recording quiet under the sheet), speed, loop). Playhead glow (#7). First full play (#8). Count-in, a bpm stepper and bar-range loops are not in this version (user, 2026-10-06: "not sure about this yet").
- Keyboard: Space play/pause, L loop, ←/→ previous/next bar, 1/2/3 level, F back to the playhead.
- Tab notation stays as it is (tune notes bold on an orange chip, thumb notes on a violet chip); the mock's circled tune and underlined bass are deferred.
