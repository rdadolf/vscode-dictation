import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const SECRET_KEYS = ['GROQ_API_KEY', 'ANTHROPIC_API_KEY'] as const;
export type Secrets = Record<typeof SECRET_KEYS[number], string>;

export function loadSecrets(secretsPath: string): { secrets?: Secrets; error?: string } {
	if (!secretsPath) {
		return { error: 'dictation.secretsFile is not configured. Set it in VS Code settings.' };
	}
	let raw: string;
	try {
		raw = fs.readFileSync(secretsPath, 'utf8');
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return { error: `Cannot read secrets file "${secretsPath}": ${msg}` };
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return { error: `Secrets file is not valid JSON: "${secretsPath}"` };
	}
	if (typeof parsed !== 'object' || parsed === null) {
		return { error: `Secrets file must be a JSON object: "${secretsPath}"` };
	}
	const obj = parsed as Record<string, unknown>;
	const missingKeys = SECRET_KEYS.filter(k => typeof obj[k] !== 'string' || !obj[k]);
	if (missingKeys.length > 0) {
		return { error: `Secrets file is missing keys: ${missingKeys.join(', ')} ("${secretsPath}")` };
	}
	return {
		secrets: Object.fromEntries(SECRET_KEYS.map(k => [k, obj[k] as string])) as Secrets,
	};
}

let recordingEditor: vscode.TextEditor | undefined;
export let daemonProcess: childProcess.ChildProcess | undefined;
export let secrets: Secrets | undefined;

function spawnDaemon(context: vscode.ExtensionContext, output: vscode.OutputChannel): void {
	const daemonPath = path.join(context.extensionPath, 'daemon.py');
	const port = vscode.workspace.getConfiguration('dictation').get<number>('daemonPort', 49152);

	output.appendLine(`Spawning daemon: py ${daemonPath} --port ${port}`);
	daemonProcess = childProcess.spawn('py', [daemonPath, '--port', String(port)]);
	console.log(`[simple-dictation] spawn returned, pid=${daemonProcess.pid}`);

	daemonProcess.stdout?.on('data', (data: Buffer) => output.append(data.toString()));
	daemonProcess.stderr?.on('data', (data: Buffer) => output.append(data.toString()));

	daemonProcess.on('exit', (code) => {
		console.log(`[simple-dictation] daemon exited with code ${code}`);
		if (code !== 0 && code !== null) {
			vscode.window.showWarningMessage(
				`Simple Dictation: daemon exited with code ${code}. Check "Simple Dictation" in the Output panel.`
			);
		}
		daemonProcess = undefined;
	});

	daemonProcess.on('error', (err) => {
		console.log(`[simple-dictation] daemon spawn error: ${err.message}`);
		output.appendLine(`Failed to spawn daemon: ${err.message}`);
		vscode.window.showErrorMessage(`Simple Dictation: failed to start daemon — ${err.message}`);
		daemonProcess = undefined;
	});
}

export function activate(context: vscode.ExtensionContext) {
	console.log('simple-dictation is now active');

	const output = vscode.window.createOutputChannel('Simple Dictation');
	context.subscriptions.push(output);
	output.show(true); // bring Output panel into focus without stealing editor focus

	const secretsPath = vscode.workspace.getConfiguration('dictation').get<string>('secretsFile', '');
	const { secrets: loadedSecrets, error: secretsError } = loadSecrets(secretsPath);
	if (secretsError) {
		vscode.window.showErrorMessage(`Simple Dictation: ${secretsError}`);
	} else {
		secrets = loadedSecrets;
	}

	spawnDaemon(context, output);

	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	context.subscriptions.push(statusBarItem);

	const startRecording = vscode.commands.registerCommand('simple-dictation.startRecording', () => {
		if (!secrets) {
			vscode.window.showErrorMessage('Simple Dictation: dictation.secretsFile is not configured. Set it in VS Code settings.');
			return;
		}
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showWarningMessage('Simple Dictation: no active editor.');
			return;
		}
		recordingEditor = editor;
		vscode.commands.executeCommand('setContext', 'simple-dictation.recording', true);
		statusBarItem.text = '$(record) Recording...';
		statusBarItem.show();
		console.log('startRecording');
	});

	const stopRecording = vscode.commands.registerCommand('simple-dictation.stopRecording', async () => {
		vscode.commands.executeCommand('setContext', 'simple-dictation.recording', false);

		const editor = recordingEditor;
		recordingEditor = undefined;

		if (!editor) {
			vscode.window.showWarningMessage('Simple Dictation: no editor was active when recording started.');
			return;
		}

		const eol = editor.document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
		await editor.edit(editBuilder => {
			editBuilder.insert(editor.selection.active, `${eol}Lorem ipsum placeholder text.${eol}`);
		});

		statusBarItem.text = '$(check) Done';
	});

	context.subscriptions.push(startRecording, stopRecording);
}

export function deactivate() {
	daemonProcess?.kill();
	daemonProcess = undefined;
}
