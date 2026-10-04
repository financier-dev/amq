const config = {
  $schema: 'http://json.schemastore.org/prettierrc',
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: false,
  singleQuote: true,
  quoteProps: 'as-needed',
  trailingComma: 'es5',
  bracketSpacing: true,
  arrowParens: 'always',
  plugins: ['prettier-plugin-svelte'],
  overrides: [{ files: '*.svelte', options: { parser: 'svelte' } }],
}

export default config
