pulumi new kubernetes-typescript
npm install -D @types/node @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint eslint-config-prettier eslint-config-standard eslint-plugin-import eslint-plugin-node eslint-plugin-prettier eslint-plugin-promise prettier
cat << EOT >> .eslintrc
{
  "extends": [
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
    "prettier",
    "plugin:import/typescript"
  ],
  "plugins": ["@typescript-eslint", "prettier", "import"],
  "env": {
    "jest": true,
    "node": true,
    "es6": true
  },
  "rules": {
    "prettier/prettier": ["error", { "singleQuote": true }],
    "no-console": 0,
    "@typescript-eslint/explicit-member-accessibility": 0,
    "@typescript-eslint/explicit-function-return-type": 0,
    "@typescript-eslint/consistent-type-definitions": ["error", "type"],
    "import/no-relative-packages": "error"
  },
  "parser": "@typescript-eslint/parser",
  "ignorePatterns": ["**/node_modules", "**/dist", "**/bin", "**/*.d.ts"]
}
EOT

cat << EOT >> .prettierrc
{
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "semi": false,
  "tabWidth": 2,
  "useTabs": false
}
EOT

jq '. + 
{
  "scripts": {
    "lint": "eslint --ext .ts --max-warnings 0 .",
    "lint-fix": "eslint --ext .ts --max-warnings 0 --fix .",
    "prettier": "prettier --loglevel warn --check .",
    "prettier-fix": "prettier --loglevel warn --write .",
    "lint-all": "npm run lint; npm run prettier",
    "fix-all": "npm run lint --fix; npm run prettier --fix"
  }
}
' package.json > tmp.json
rm package.json
mv tmp.json package.json
npm ci