# Blop linter

Blop linter is a Blop language linter server for vscode.

It has the same capabilities than the blop compiler but gives you live error and warning on your code.

<img src=https://raw.githubusercontent.com/batiste/blop-language/master/vscode/blop-linter/blop-linter.png width=600>

## Build the extension

```bash
npm install
npm run compile
```

## Publish the extension

```bash
npm install -g vsce

vsce package
vsce publish
```
