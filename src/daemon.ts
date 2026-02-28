import * as vscode from 'vscode';
import WebSocket from 'ws';

type DaemonReply = { status: string; path?: string; message?: string };

// The WebSocket message event is callback-based, but send() needs to return a
// Promise. To bridge the two, send() stores its Promise's resolve/reject handles
// here before returning. When the daemon's reply arrives in the message handler,
// those handles are called to settle the Promise. Only one command is ever in
// flight at a time, so a single slot is sufficient rather than a queue.
type PendingReply = {
	resolve: (r: DaemonReply) => void;
	reject: (e: Error) => void;
};

export class DaemonClient implements vscode.Disposable {
	private ws: WebSocket | undefined;
	private pendingReply: PendingReply | undefined;

	constructor(
		private readonly port: number,
		private readonly output: vscode.OutputChannel,
	) {}

	private connect(): Promise<void> {
		if (this.ws?.readyState === WebSocket.OPEN) {
			return Promise.resolve();
		}

		return new Promise((resolve, reject) => {
			const ws = new WebSocket(`ws://localhost:${this.port}`);
			// Track whether the open event has fired so the error handler can distinguish
			// a failed connection attempt from a post-connection socket error.
			let connected = false;

			ws.on('open', () => {
				connected = true;
				this.ws = ws;
				resolve();
			});

			ws.on('message', (data: Buffer) => {
				const pending = this.pendingReply;
				this.pendingReply = undefined;
				try {
					const reply = JSON.parse(data.toString()) as DaemonReply;
					pending?.resolve(reply);
				} catch {
					pending?.reject(new Error('Daemon sent invalid JSON'));
				}
			});

			ws.on('error', (err) => {
				this.output.appendLine(`Daemon WebSocket error: ${err.message}`);
				if (!connected) {
					reject(err);
				} else {
					const pending = this.pendingReply;
					this.pendingReply = undefined;
					pending?.reject(err);
				}
			});

			ws.on('close', () => {
				this.ws = undefined;
				const pending = this.pendingReply;
				this.pendingReply = undefined;
				pending?.reject(new Error('Daemon connection closed unexpectedly'));
				this.output.appendLine('Daemon WebSocket closed');
			});
		});
	}

	private send(cmd: string): Promise<DaemonReply> {
		return new Promise((resolve, reject) => {
			if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
				reject(new Error('Not connected to daemon'));
				return;
			}
			this.pendingReply = { resolve, reject };
			this.ws.send(JSON.stringify({ cmd }), (err) => {
				if (err) {
					this.pendingReply = undefined;
					reject(err);
				}
			});
		});
	}

	async sendStart(): Promise<void> {
		await this.connect();
		const reply = await this.send('start');
		if (reply.status !== 'ok') {
			throw new Error(reply.message ?? `daemon replied: ${reply.status}`);
		}
	}

	async sendStop(): Promise<string> {
		const reply = await this.send('stop');
		if (reply.status !== 'ok') {
			throw new Error(reply.message ?? `daemon replied: ${reply.status}`);
		}
		return reply.path ?? '';
	}

	// Automatically called by VS Code when the extension deactivates
	dispose(): void {
		this.ws?.close();
		this.ws = undefined;
	}
}
