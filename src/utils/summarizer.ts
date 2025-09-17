import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateSummary(messages: string[]): Promise<any> {
  const prompt = `
Riassumi questa conversazione in 3 parti:
1. Short: una sola frase.
2. Bullet: massimo 5 punti chiari.
3. Narrative: in stile saga AMBARADAM.
Conversazione:
${messages.join("\n")}
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.5,
    max_tokens: 400
  });

  const text = response.choices[0].message?.content || "";
  const [short, bulletsRaw, narrative] = text.split("\n\n");

  const bullets = bulletsRaw
    .split("\n")
    .filter(line => line.trim().startsWith("-"))
    .map(line => line.replace(/^- /, "").trim());

  return {
    short: short.replace("Short:", "").trim(),
    bullets,
    narrative: narrative.replace("Narrative:", "").trim()
  };
}