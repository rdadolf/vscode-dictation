# vscode-dictation
A simple vs code extension to enable in-place dictation, via groq whisper and claude.

## Development Requirements

Install the following before building or running the extension.

**Node.js (LTS)**
```
winget install OpenJS.NodeJS.LTS
```

**Python 3.10+**
```
winget install Python.Python.3.13
```

**npm globals** (yo, generator-code, vsce)
```
npm install -g yo generator-code @vscode/vsce
```

**Python audio and daemon packages**
```
pip install sounddevice soundfile websockets
```

**VS Code** (if not already installed)
```
winget install Microsoft.VisualStudioCode
```

## Build and Install

**Package the extension:**
```
vsce package
```
This compiles the TypeScript and produces `simple-dictation-x.x.x.vsix` in the repo root. Re-run this after any code changes.

**Install into VS Code:**
```
code --install-extension simple-dictation-0.0.1.vsix
```
Reload the VS Code window after installing (`Ctrl+Shift+P` → "Developer: Reload Window").

**Uninstall:**
```
code --uninstall-extension rdadolf.simple-dictation
```
