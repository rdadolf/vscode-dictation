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

**Python audio packages**
```
pip install sounddevice soundfile
```

**VS Code** (if not already installed)
```
winget install Microsoft.VisualStudioCode
```
