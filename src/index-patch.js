const { getAIResponse } = require('./services/openai');

// Aggiungi questo al tuo endpoint /chat esistente
app.post('/chat', async (req, res) => {
  const { message } = req.body;
  
  const aiReply = await getAIResponse(message);
  
  res.json({
    reply: aiReply,
    sessionId: req.body.sessionId || `session_${Date.now()}`,
    user: { name: "User" },
    requiresAuth: false
  });
});