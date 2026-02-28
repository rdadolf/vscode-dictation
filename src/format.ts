import Anthropic from '@anthropic-ai/sdk';

const BASE_SYSTEM_PROMPT = `You are a transcription cleanup assistant. Given raw speech-to-text output, return cleaned prose or markdown with these rules:
- Remove filler words (um, uh, like, you know, etc.)
- Preserve technical and domain-specific terms exactly as spoken
- Return only the cleaned content — no commentary, timestamps, or meta-text
- Do not add, remove, or rephrase content beyond filler word removal and formatting
- Recognize spoken descriptions of code and formatting, and render them appropriately:
  - Spoken punctuation and symbols: "dash" → -, "dot" → ., "slash" → /, "colon" → :, "equals" → =, etc.
  - Inline code: "backtick <expr> backtick" or "in backticks <expr>" → \`<expr>\`
  - Code blocks: "code block <lang> ... end code block" or "begin code ... end code" → fenced code block
  - Shell flags: "dash l" → -l, "dash dash verbose" → --verbose
  - When a phrase reads as a shell command or code expression, format it as inline code
- Use markdown only where it reflects spoken intent; default to plain prose otherwise`;

// Exported so tests can verify that promptAppend is included in the composed prompt.
export function composePrompt(promptAppend: string): string {
	if (!promptAppend) {
		return BASE_SYSTEM_PROMPT;
	}
	return `${BASE_SYSTEM_PROMPT}\n\n${promptAppend}`;
}

// Sends the transcript to the Claude API and returns cleaned text.
// Throws an Anthropic.APIError on auth/network failure, or an
// APIConnectionTimeoutError on timeout (default 30 s).
export async function format(
	transcript: string,
	apiKey: string,
	promptAppend: string,
	model: string,
): Promise<string> {
	const client = new Anthropic({ apiKey, timeout: 30 * 1000 });
	const message = await client.messages.create({
		model,
		// At an average words/minute rate of about 130, this is over half an hour. *Plenty*, and prevents nonsensical cases.
		max_tokens: 4096,
		// For current Claude models, caching has a lower bound of 1024 tokens, so this might be unused. But it's there in case we want it at some point.
		system: [{ type: 'text', text: composePrompt(promptAppend), cache_control: { type: 'ephemeral' } }],
		messages: [{ role: 'user', content: transcript }],
	});
	const block = message.content[0];
	if (block.type !== 'text') {
		throw new Error(`Claude returned unexpected content type: ${block.type}`);
	}
	return block.text;
}
