import type { Preview } from '@storybook/react-vite';
import { ReducedMotionProvider } from '@thumbline/ui';
import '@thumbline/ui/tokens.css';
import './preview.css';

const preview: Preview = {
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
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
