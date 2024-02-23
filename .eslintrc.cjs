module.exports = {
    env: {
        browser: true,
        es2021: true,
        node: true
    },
    extends: ['standard', 'eslint:recommended', 'plugin:prettier/recommended'],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 'es2022',
        sourceType: 'module'
    },
    plugins: ['@typescript-eslint', 'simple-import-sort'],
    rules: {
        indent: ['error', 4, { SwitchCase: 1 }],
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
        'func-call-spacing': 'off',
        '@typescript-eslint/func-call-spacing': 'error',
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
        ]
    },
    overrides: [
        {
            files: ['*.ts'],
            parser: '@typescript-eslint/parser',
            extends: ['plugin:@typescript-eslint/recommended'],
            rules: {
                '@typescript-eslint/no-explicit-any': 'off'
            }
        }
    ]
}
