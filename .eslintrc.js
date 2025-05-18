module.exports = {
  extends: ['next/core-web-vitals'],
  rules: {
    // Disable rule for unescaped entities like apostrophes in JSX
    'react/no-unescaped-entities': 'off',
    
    // Warn instead of error for unused variables
    '@typescript-eslint/no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    }],
    
    // Allow explicit any in certain cases but prefer proper types
    '@typescript-eslint/no-explicit-any': 'warn',
    
    // Allow empty interfaces that extend others
    '@typescript-eslint/no-empty-object-type': 'off',
  },
} 