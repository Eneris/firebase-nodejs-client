const js = require('@eslint/js')
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const tsParser = require('@typescript-eslint/parser')

module.exports = [
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'example/**',
            'example_private/**',
            '**/*.d.ts',
            'src/protobuf/protos.js',
        ],
    },
    js.configs.recommended,
    ...tsPlugin.configs['flat/recommended'],
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 'latest',
            sourceType: 'module',
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            // protocol enums intentionally reuse values
            '@typescript-eslint/no-duplicate-enum-values': 'off',
        },
    },
]
