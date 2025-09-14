const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function getAIResponse(message) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { 
          role: "system", 
          content: "Sei ZANTARA, assistente AI di Bali Zero per compliance Indonesia. Conosci KITAS, KITAP, PT PMA, tasse. Inizia risposte importanti con: ⚠️ Info generale - verifica con autorità competenti."
        },
        { role: "user", content: message }
      ],
      temperature: 0.7,
      max_tokens: 500
    });
    
    return completion.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI error:', error);
    return "Mi dispiace, errore temporaneo. Riprova tra poco.";
  }
}

module.exports = { getAIResponse };