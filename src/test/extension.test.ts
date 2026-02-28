import * as assert from 'assert';
import * as net from 'net';
import * as vscode from 'vscode';
import * as ext from '../extension';

// net.Socket gives us a raw TCP probe without pulling in any HTTP machinery.
// Returns true if something is accepting connections on the port, false on error or timeout.
function canConnect(port: number): Promise<boolean> {
	return new Promise(resolve => {
		const sock = new net.Socket();
		sock.setTimeout(500);
		sock.on('connect', () => { sock.destroy(); resolve(true); });
		sock.on('error', () => { sock.destroy(); resolve(false); });
		sock.on('timeout', () => { sock.destroy(); resolve(false); });
		sock.connect(port, 'localhost');
	});
}

// The daemon needs a moment to start listening after the process spawns.
// Polls canConnect() until success or the deadline, so the test doesn't race the startup.
async function waitForPort(port: number, timeoutMs = 5000): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (await canConnect(port)) { return true; }
		await new Promise(resolve => setTimeout(resolve, 200));
	}
	return false;
}

suite('Extension Test Suite', () => {
	setup(async () => {
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	});

	// --- Daemon tests ---

	test('daemon process is spawned on activation', () => {
		assert.ok(ext.daemonProcess?.pid, 'daemon process should have a PID');
	});

	test('daemon is listening on the configured port', async () => {
		const port = vscode.workspace.getConfiguration('dictation').get<number>('daemonPort') ?? 49152;
		const listening = await waitForPort(port);
		assert.ok(listening, `daemon should be listening on port ${port}`);
	});

	// --- Text insertion tests ---

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
