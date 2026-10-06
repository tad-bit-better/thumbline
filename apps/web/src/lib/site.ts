// What the site says about itself to search engines and link previews (titles, descriptions,
// structured data). One place, so the page, the metadata and the JSON-LD never disagree.

export const SITE_URL = 'https://thumbline.app';
export const SITE_NAME = 'Thumbline';
/** The home page's title: what people search for, then the name. */
export const SITE_TITLE = 'Thumbline: turn any song into fingerstyle guitar tabs';
export const SITE_DESCRIPTION =
  'Drop in a song and get a playable right-hand guitar part: arpeggio, fingerstyle or flamenco, from beginner to advanced. Free and open source, in your browser; your audio never leaves your device.';
export const SITE_KEYWORDS = [
  'fingerstyle guitar tabs',
  'fingerstyle arrangement',
  'guitar arpeggio patterns',
  'travis picking',
  'flamenco rumba',
  'song to guitar tab',
  'chord detection',
  'guitar practice',
];

/** Questions on the home page, also published as FAQPage structured data. Plain words, sentence case. */
export const FAQ = [
  {
    q: 'Is Thumbline free?',
    a: 'Yes. Thumbline is free and open source under the AGPL-3.0 licence. There is no account to make.',
  },
  {
    q: 'Does my song get uploaded anywhere?',
    a: 'No. Your clip is analysed in your browser, on your device. The audio never leaves it.',
  },
  {
    q: 'Which files can I use?',
    a: 'MP3, WAV or M4A clips up to 8 minutes long. Use songs you own.',
  },
  {
    q: 'Is the sheet a transcription of the recording?',
    a: 'No. Thumbline hears the tempo, key, chords and the tune, then writes a right-hand part for you to play along: an arrangement for guitar, not a note-for-note copy.',
  },
  {
    q: 'What styles and levels are there?',
    a: 'Arpeggio, fingerstyle and flamenco (rumba and tangos), each at Basic, Moderate and Advanced. The higher levels add hammer-ons, pull-offs, harmonics, slow strums and fills.',
  },
  {
    q: 'Can I slow it down?',
    a: 'Yes. Play the sheet with the original, alone or both together, at 50%, 75% or full speed without changing the pitch, and loop the bars you are learning.',
  },
] as const;
