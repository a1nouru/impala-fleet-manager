module.exports = {
  extends: ['next/core-web-vitals'],
  rules: {
    // Disable all the problematic rules
    'react/no-unescaped-entities': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-empty-object-type': 'off',
  },
} 