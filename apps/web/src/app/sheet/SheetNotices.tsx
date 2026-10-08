import { Button, Card } from '@thumbline/ui';
import { songStore } from '../../lib/song-store';
import styles from './sheet.module.css';
import { ordinal } from './sheet-labels';

export type SheetNoticesProps = {
  /** Songs read before M9 have chords but no tune: offer one more listen. */
  addTune: boolean;
  onListenAgain: () => void;
  /** How many bars hold a chord we're unsure of. */
  toCheck: number;
  onCheck: () => void;
  /** "3 chords are simplified and 2 need a barre." */
  summary?: string;
  /** A capo that suits the reader's chords better than the one kept. */
  betterCapo?: number;
};

/** The one-line notices under the arrangement bar (screens.md §4). */
export function SheetNotices({
  addTune,
  onListenAgain,
  toCheck,
  onCheck,
  summary,
  betterCapo,
}: SheetNoticesProps) {
  return (
    <>
      {addTune && (
        <Card padding="sm" className={styles.notice}>
          <div>
            <b>Add the tune</b>
            <p>
              This song was read before Thumbline could follow the melody.
              Listen again to put the tune on top. Your chord changes will be
              cleared.
            </p>
          </div>
          <Button variant="ghost" onClick={onListenAgain}>
            Listen again
          </Button>
        </Card>
      )}

      <p
        className={styles.warnings}
        data-tone={toCheck > 0 || summary ? 'warn' : undefined}
        aria-live="polite"
      >
        {toCheck > 0
          ? `${toCheck} chord${toCheck > 1 ? 's' : ''} might be off. `
          : ''}
        Tap a chord to hear the bar or change it.{' '}
        {toCheck > 0 && (
          <button type="button" className={styles.inlineLink} onClick={onCheck}>
            Check {toCheck > 1 ? 'them' : 'it'}
          </button>
        )}
        {summary && <span className={styles.summary}> {summary}</span>}
      </p>

      {betterCapo !== undefined && (
        <p className={styles.warnings}>
          Your chords sit better with{' '}
          {betterCapo > 0
            ? `a capo on the ${ordinal(betterCapo)} fret`
            : 'no capo'}
          .{' '}
          <button
            type="button"
            className={styles.inlineLink}
            onClick={() => songStore.getState().setCapo(betterCapo)}
          >
            {betterCapo > 0 ? `Use capo ${betterCapo}` : 'Take the capo off'}
          </button>
        </p>
      )}
    </>
  );
}
