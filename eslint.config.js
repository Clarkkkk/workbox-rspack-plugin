import js from '@eslint/js'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default [
    js.configs.recommended,
    ...tseslint.configs.recommended,
    eslintPluginPrettierRecommended,
    {
        files: ['**/*.{ts,tsx,js,mjs,cjs}'],
        plugins: {
            'simple-import-sort': simpleImportSort,
            ts: tseslint.plugin
        },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            parserOptions: {
                parser: '@typescript-eslint/parser',
                ecmaVersion: 'es2022',
                sourceType: 'module'
            },
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2021
            }
        },
        rules: {
            indent: ['error', 4],
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'consistent-return': 'error',
            'space-before-function-paren': [
                'error',
                {
                    anonymous: 'always',
                    named: 'never',
                    asyncArrow: 'always'
                }
            ],
            'no-redeclare': 'off',
            'simple-import-sort/imports': [
                'error',
                {
                    groups: [
                        [
                            // Side effect imports.
                            '^\\u0000',
                            '^@?\\w',
                            // Internal packages.
                            '^(src|components|config|utils|pages|hooks|api)(/.*|$)',
                            // Parent imports. Put `..` last.
                            '^\\.\\.(?!/?$)',
                            '^\\.\\./?$',
                            // Other relative imports. Put same-folder imports and `.` last.
                            '^\\./(?=.*/)(?!/?$)',
                            '^\\.(?!/?$)',
                            '^\\./?$',
                            // Style imports.
                            '^.+\\.s?css$'
                        ]
                    ]
                }
            ],
            'simple-import-sort/exports': 'error',
            '@typescript-eslint/consistent-type-imports': [
                'error',
                {
                    prefer: 'type-imports'
                }
            ],
            'no-undef': 'off',
            'no-use-before-define': 'off',
            '@typescript-eslint/no-use-before-define': [
                'error',
                {
                    enums: false,
                    typedefs: false,
                    ignoreTypeReferences: false,
                    functions: false
                }
            ],
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    varsIgnorePattern: '^_',
                    args: 'after-used',
                    argsIgnorePattern: '^_',
                    caughtErrors: 'all',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                    ignoreRestSiblings: true
                }
            ],
            '@typescript-eslint/no-explicit-any': 'off'
        }
    }
]
