import type { Preview } from '@storybook/react-vite';
import { ReducedMotionProvider } from '../src/motion/useReducedMotion';
import '../src/styles/tokens.css';
import './preview.css';

const preview: Preview = {
  parameters: {
    layout: 'centered',
    a11y: { test: 'error' },
    controls: { matchers: { color: /(background|color)$/i } },
  },
  globalTypes: {
    motion: {
      description: 'Force reduced motion',
      toolbar: {
        title: 'Motion',
        icon: 'lightning',
        items: [
          { value: 'system', title: 'Follow system' },
          { value: 'reduce', title: 'Reduced motion' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { motion: 'system' },
  decorators: [
    (Story, { globals, parameters }) => {
      const forced = parameters['reducedMotion'] === true || globals['motion'] === 'reduce';
      return (
        <ReducedMotionProvider reduced={forced ? true : undefined}>
          <Story />
        </ReducedMotionProvider>
      );
    },
  ],
};

export default preview;
