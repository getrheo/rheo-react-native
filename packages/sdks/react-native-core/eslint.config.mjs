import { baseConfig } from '@rheo/config/eslint.js';

const removedSharedPackage = ['@rheo', 'shared'].join('/');

/** Keep the React Native SDK off removed shared facades and DOM renderers. */
export default [
  ...baseConfig,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: removedSharedPackage,
              message:
                'Do not import the removed shared facade from the React Native SDK; depend on concrete @rheo/* packages instead.',
            },
            {
              name: '@rheo/renderer-web',
              message:
                'React Native SDK code must not import the DOM renderer.',
            },
          ],
          patterns: [
            {
              group: ['@rheo/renderer-web/*'],
              message:
                'React Native SDK code must not import the DOM renderer.',
            },
          ],
        },
      ],
    },
  },
];
