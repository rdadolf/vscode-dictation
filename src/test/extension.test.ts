import * as assert from 'assert';
import * as net from 'net';
import * as path from 'path';
import * as vscode from 'vscode';
import * as ext from '../extension';

// __dirname is out/test/ at runtime; step back to reach the committed fixture files.
const FIXTURES_DIR = path.join(__dirname, '../../src/test/fixtures');

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

	// --- Secrets tests ---

	test('loadSecrets: empty path returns configuration error', () => {
		const result = ext.loadSecrets('');
		assert.ok(result.error, 'should return an error');
		assert.ok(!result.secrets, 'should not return secrets');
	});

	test('loadSecrets: nonexistent file returns read error', () => {
		const result = ext.loadSecrets(path.join(FIXTURES_DIR, 'nonexistent-file.json'));
		assert.ok(result.error, 'should return an error');
		assert.ok(!result.secrets, 'should not return secrets');
	});

	test('loadSecrets: missing key returns error naming the absent key', () => {
		const result = ext.loadSecrets(path.join(FIXTURES_DIR, 'test-secrets-missing-key.json'));
		assert.ok(result.error, 'should return an error');
		assert.ok(result.error?.includes('ANTHROPIC_API_KEY'), 'error should name the missing key');
		assert.ok(!result.secrets, 'should not return secrets');
	});

	test('loadSecrets: valid file returns populated secrets', () => {
		const result = ext.loadSecrets(path.join(FIXTURES_DIR, 'test-secrets.json'));
		assert.ok(result.secrets, 'should return secrets');
		assert.strictEqual(result.secrets?.GROQ_API_KEY, 'test-groq-key');
		assert.strictEqual(result.secrets?.ANTHROPIC_API_KEY, 'test-anthropic-key');
	});

	// --- Text insertion tests ---

	suite('Text insertion', () => {
		suiteSetup(() => {
			// startRecording checks ext.secrets before doing anything. Populate it with
			// dummy values so the guard passes; secrets validation is tested above.
			(ext as any).secrets = { GROQ_API_KEY: 'test-groq-key', ANTHROPIC_API_KEY: 'test-anthropic-key' };
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
});
