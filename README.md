# Simple Dictation for VS Code

Push-to-talk dictation that inserts cleaned, formatted text at your cursor. Records audio via a local Python daemon, transcribes with Groq Whisper, and cleans up the transcript with Claude.

## Prerequisites

```
winget install OpenJS.NodeJS.LTS        # Node.js
winget install Python.Python.3.13       # Python 3.10+
pip install numpy sounddevice soundfile websockets
npm install -g @vscode/vsce
```

## Secrets File

Create a JSON file outside the repo with your API keys:

```json
{
  "GROQ_API_KEY": "gsk_...",
  "ANTHROPIC_API_KEY": "sk-ant-..."
}
```

Lock it down so only your user can read it:

```
icacls C:\Users\you\.dictation-secrets.json /inheritance:r /grant:r "%USERNAME%:R"
```

Then point the extension at it in your VS Code `settings.json`:

```json
{
  "dictation.secretsFile": "C:/Users/you/.dictation-secrets.json"
}
```

## VS Code Settings

All settings live under the `dictation.*` namespace in `settings.json`:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `dictation.secretsFile` | string | `""` | Absolute path to the secrets JSON file |
| `dictation.daemonPort` | number | `49152` | TCP port the audio daemon listens on |
| `dictation.groqModel` | string | `whisper-large-v3-turbo` | Groq model used for transcription |
| `dictation.claudeModel` | string | `claude-haiku-4-5` | Claude model used for transcript cleanup |
| `dictation.promptAppend` | string | `""` | Text appended to the Claude system prompt for domain-specific adjustments |

## Usage

Press **Ctrl+F9** to start recording. Press **Ctrl+F9** again to stop. The extension will transcribe and clean up your audio, then insert the result at the cursor in the active editor.

The status bar shows the current state:
- **Recording...** — microphone is active (status bar flashes red)
- **Transcribing...** — sending audio to Groq and cleaning up with Claude
- **Done** — text inserted

If Claude is unavailable, the raw transcript is inserted prefixed with `[unformatted]`.

## Build and Install

**1. Clone and install dependencies:**
```
git clone https://github.com/rdadolf/vscode-dictation.git
cd vscode-dictation
npm install
```

**2. Package the extension:**
```
vsce package
```
This compiles the TypeScript and produces `simple-dictation-0.0.1.vsix`.

**3. Install into VS Code:**
```
code --install-extension simple-dictation-0.0.1.vsix
```
Reload the window afterward (`Ctrl+Shift+P` → "Developer: Reload Window").

**Uninstall:**
```
code --uninstall-extension rdadolf.simple-dictation
```
