/// <reference types="vite/client" />
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CSSProperties } from 'react';
import tokensCss from '../styles/tokens.css?raw';
import styles from './Theme.module.css';
import { type TokenGroup, parseTokens } from './tokens';

function Preview({ name, group }: { name: string; group: string }) {
  const v = `var(${name})`;
  if (group === 'colour') return <div className={styles['swatch']} style={{ background: v }} />;
  if (group === 'shape') return <div className={styles['radius']} style={{ borderRadius: v }} />;
  if (group === 'depth') return <div className={styles['shadow']} style={{ boxShadow: v }} />;
  if (group.startsWith('spacing')) return <div className={styles['bar']} style={{ width: v }} />;
  if (name.startsWith('--text') || name.startsWith('--tracking')) {
    const style: CSSProperties = name.startsWith('--tracking')
      ? { letterSpacing: v, fontWeight: 800, fontSize: 'var(--text-h2)' }
      : { fontSize: v, fontWeight: name === '--text-display' || name.startsWith('--text-h') ? 800 : 400 };
    return (
      <p className={styles['sample']} style={style}>
        Right-hand sheet
      </p>
    );
  }
  if (name.startsWith('--font')) {
    return (
      <p className={styles['sample']} style={{ fontFamily: v, fontSize: 'var(--text-h3)' }}>
        Travis picking 0 2 3
      </p>
    );
  }
  return null;
}

function Group({ group }: { group: TokenGroup }) {
  const listed = group.name === 'type' || group.name.startsWith('spacing') || group.name === 'motion';
  return (
    <section className={styles['group']}>
      <h2>{group.name}</h2>
      <div className={listed ? styles['list'] : styles['grid']}>
        {group.tokens.map((t) => (
          <div key={t.name} className={styles['tile']}>
            <Preview name={t.name} group={group.name} />
            <div className={styles['meta']}>
              <code>{t.name}</code>
              <span>{t.value}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Theme() {
  return (
    <div className={styles['page']}>
      {parseTokens(tokensCss).map((g) => (
        <Group key={g.name} group={g} />
      ))}
    </div>
  );
}

const meta: Meta<typeof Theme> = {
  title: 'Foundations/Theme',
  component: Theme,
  parameters: { layout: 'fullscreen' },
};
export default meta;

/** Every token in tokens.css, read from the file itself. */
export const AllTokens: StoryObj<typeof Theme> = {};
