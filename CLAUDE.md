The directory vscode/blop-linter/blop-linter/server/src contains mostly files that are copied via the command `npm run linter`: do not touch them. The `server.ts` in this directory is genuine.

To write negative tests, you can use `src/tests/testHelpers.js` -> `expectCompilationError`. Prefer writing genuine Blop test files for positive tests (they will be compiled)

When you write md docs, avoid too many emoticon, use typescript as the code block language for proper coloration