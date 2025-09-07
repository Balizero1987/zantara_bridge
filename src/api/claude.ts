import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.MY_KEY_CLAUDE as string,
});

export async function askClaude(prompt: string): Promise<string> {
  try {
    const msg = await client.messages.create({
      model: "claude-3-5-sonnet-20240620", // puoi cambiare modello se serve
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    // Claude risponde in blocchi; prendiamo il testo principale
    return msg.content[0].type === "text"
      ? msg.content[0].text
      : JSON.stringify(msg.content);
  } catch (err: any) {
    console.error("Claude API error:", err);
    throw err;
  }
}
