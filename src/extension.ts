import * as childProcess from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';

let recordingEditor: vscode.TextEditor | undefined;
export let daemonProcess: childProcess.ChildProcess | undefined;

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

	spawnDaemon(context, output);

	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	context.subscriptions.push(statusBarItem);

	const startRecording = vscode.commands.registerCommand('simple-dictation.startRecording', () => {
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
