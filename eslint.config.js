import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'OrbitControls.js', 'STLLoader.js', 'three.min.js', 'scripts/**', 'src/vendor/**']
  },
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off'
    }
  }
];
