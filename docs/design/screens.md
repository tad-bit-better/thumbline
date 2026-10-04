# Screens

Canvas prototype: https://claude.ai/artifact/FgGxQWiVMV8cXMyPSh3MES (interactive: press Play on a screen).
All screens: max content width 1200–1240px, fluid down to 360px; nav with logo left, contextual actions or stepper right.

## 1. Upload (`/`)
- **Hero (left):** privacy badge ("Your audio never leaves this device"), display headline "Turn any song into a right-hand sheet.", one-line description, primary 3D button "Choose a file", text link "or try a sample clip".
- **Drop zone (right):** large white card, animated dashed border, floating 3D pick (bob loop), "Drop an audio clip here", "MP3, WAV or M4A, up to 8 minutes". Whole card is the drop target and a button. On drag-over the border turns violet and the pick speeds up; on drop play Pick drop (#1) then transition.
- **Styles section:** three StyleCards with 3D icons.
- **How it works:** four numbered steps (Drop a clip, We listen, You check, Play along).
- **Errors:** unsupported type, too long, silent file → inline message inside the drop zone with a retry.

## 2. Listening (`/listen`)
- Stepper at "Listen".
- Centered card: 3D metronome (#3, tempo-synced after the beat is found), title "Listening to your song", "Everything runs on your device", file chip (name, duration).
- Waveform bars (#2), progress bar with shimmer.
- Step list: Decoding the audio → Finding the beat (shows "92 bpm, 4/4") → Hearing the chords (shows "bar 23 of 48") → Writing your sheets.
- Cancel button returns to Upload. Auto-advance to Review when done.

## 3. Review (`/review`)
- Stepper at "Review". Title "Check the chords", hint "Tap a chord with an orange ring to pick a better match."
- **Chord grid:** 8 columns (4 on mobile), one ChordBlock per bar, paginated by 16 bars with a mini-map for long songs. Counter "2 chords to check" → "All chords checked".
- **Popover on a low-confidence block:** top 3 alternatives with confidence bars and percentages; choosing one plays Chord confirmed (#4). Tapping a confident block also opens the popover (all chords editable), just not highlighted.
- **Side panel:** Tempo, Key, Time (4/4 · 3/4 segmented). Primary button "Looks good, write my sheets". Note "You can come back and change chords any time."
- Optional: tapping a block plays that bar of the original.

## 4. Sheet (`/sheet`)
- Header: clip name (mono), "Your sheet", equaliser icon while playing, chips for capo ("No capo needed" / "Capo on the 2nd fret") and key/meter. Links "Edit chords", "New song".
- **Style row:** three StyleCards (Arpeggio, Fingerstyle, Flamenco with "Rumba"/"Tangos" sub-label).
- **Level + pattern row:** SegmentedControl (Basic, Moderate, Advanced) with sliding pill; pattern card with name and one-line how-to. If a style has 2+ patterns per level, a small "Try another pattern" control cycles them.
- **Chord shapes:** diagrams for every shape used, in order of appearance.
- **Tab card:** systems of 4 bars (2 on narrow screens, horizontal scroll under 720px). Lanes: chord names, techniques (golpe chips, arrows), strings (bass notes on violet-soft chips), finger letters. Legend below. Reveal (#5) on every style/level change.
- **Sticky player bar:** play sphere (breathing glow when idle), now-playing line ("Fingerstyle, Moderate" / "92 bpm, sheet and original"), mix segments (Sheet, Original, Both), speed (50%, 75%, 100%), loop toggle (v1: loop selected bars by dragging across the tab). Playhead glow (#7). First full play (#8).
- Keyboard: Space play/pause, L loop, ←/→ previous/next bar, 1/2/3 level.
