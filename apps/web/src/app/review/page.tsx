import { redirect } from 'next/navigation';

/** Chords are checked on the sheet now (2026-10-08): old links land there. */
export default function Review() {
  redirect('/sheet');
}
