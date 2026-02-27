import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	setup(async () => {
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	});

	test('inserts placeholder using LF in an LF document', async () => {
		const doc = await vscode.workspace.openTextDocument({ content: 'AAAAAA' });
		const editor = await vscode.window.showTextDocument(doc);
		await editor.edit(eb => eb.setEndOfLine(vscode.EndOfLine.LF));
		const pos = new vscode.Position(0, 3);
		editor.selection = new vscode.Selection(pos, pos);

		await vscode.commands.executeCommand('simple-dictation.startRecording');
		await vscode.commands.executeCommand('simple-dictation.stopRecording');

		assert.strictEqual(doc.getText(), 'AAA\nLorem ipsum placeholder text.\nAAA');
	});

	test('inserts placeholder using CRLF in a CRLF document', async () => {
		const doc = await vscode.workspace.openTextDocument({ content: 'AAAAAA' });
		const editor = await vscode.window.showTextDocument(doc);
		await editor.edit(eb => eb.setEndOfLine(vscode.EndOfLine.CRLF));
		const pos = new vscode.Position(0, 3);
		editor.selection = new vscode.Selection(pos, pos);

		await vscode.commands.executeCommand('simple-dictation.startRecording');
		await vscode.commands.executeCommand('simple-dictation.stopRecording');

		assert.strictEqual(doc.getText(), 'AAA\r\nLorem ipsum placeholder text.\r\nAAA');
	});

	test('no active editor: startRecording shows warning and does not throw', async () => {
		await assert.doesNotReject(async () => {
			await vscode.commands.executeCommand('simple-dictation.startRecording');
		});
	});
});
