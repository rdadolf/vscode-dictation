import * as vscode from 'vscode';

let recordingEditor: vscode.TextEditor | undefined;

export function activate(context: vscode.ExtensionContext) {
	console.log('simple-dictation is now active');

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

export function deactivate() {}
