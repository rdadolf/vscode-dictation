import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('simple-dictation is now active');

	const startRecording = vscode.commands.registerCommand('simple-dictation.startRecording', () => {
		vscode.commands.executeCommand('setContext', 'simple-dictation.recording', true);
		console.log('startRecording');
	});

	const stopRecording = vscode.commands.registerCommand('simple-dictation.stopRecording', () => {
		vscode.commands.executeCommand('setContext', 'simple-dictation.recording', false);
		console.log('stopRecording');
	});

	context.subscriptions.push(startRecording, stopRecording);
}

export function deactivate() {}
