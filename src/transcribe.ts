import * as fs from 'fs';
import Groq from 'groq-sdk';

// Sends the FLAC file at flacPath to the Groq Whisper API and returns the raw
// transcript string. Throws a Groq.APIError on auth/network failure, or an
// APIConnectionTimeoutError on timeout (default 30 s).
export async function transcribe(flacPath: string, apiKey: string, model: string): Promise<string> {
	const client = new Groq({ apiKey, timeout: 30 * 1000 });
	const result = await client.audio.transcriptions.create({
		file: fs.createReadStream(flacPath),
		model,
	});
	return result.text;
}
