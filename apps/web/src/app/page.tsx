import styles from './page.module.css';

// Placeholder until the Upload screen lands in M6.
export default function Index() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Thumbline</h1>
      <p className={styles.lede}>
        We hear the chords and write a part for you to play.
      </p>
    </main>
  );
}
