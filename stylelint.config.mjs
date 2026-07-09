export default {
  extends: ['stylelint-config-standard'],
  ignoreFiles: ['**/dist/**', '**/coverage/**', '**/node_modules/**'],
  overrides: [
    {
      files: ['**/*.vue'],
      customSyntax: 'postcss-html',
    },
  ],
};
