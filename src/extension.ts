import * as vscode from 'vscode';

let recordingEditor: vscode.TextEditor | undefined;

export function activate(context: vscode.ExtensionContext) {
	console.log('simple-dictation is now active');

	const startRecording = vscode.commands.registerCommand('simple-dictation.startRecording', () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showWarningMessage('Simple Dictation: no active editor.');
			return;
		}
		recordingEditor = editor;
		vscode.commands.executeCommand('setContext', 'simple-dictation.recording', true);
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

		await editor.edit(editBuilder => {
			editBuilder.insert(editor.selection.active, '\nLorem ipsum placeholder text.\n');
		});
	});

	context.subscriptions.push(startRecording, stopRecording);
}

export function deactivate() {}
