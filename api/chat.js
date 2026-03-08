export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: { message: 'API key not configured on server.' } });
  }

  try {
    const { system, messages, max_tokens = 900 } = req.body;

    // Convert to Gemini format (role must be "user" or "model")
    const geminiMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // Prepend system prompt as a user/model exchange
    const contents = system
      ? [
          { role: 'user', parts: [{ text: `[Instructions: ${system}]` }] },
          { role: 'model', parts: [{ text: 'Understood. I will follow those instructions.' }] },
          ...geminiMessages
        ]
      : geminiMessages;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { maxOutputTokens: max_tokens, temperature: 0.85 }
        })
      }
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      return res.status(500).json({ error: { message: data.error?.message || 'Gemini API error' } });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // Return in same shape the frontend expects
    return res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (err) {
    return res.status(500).json({ error: { message: err.message || 'Internal server error' } });
  }
}
