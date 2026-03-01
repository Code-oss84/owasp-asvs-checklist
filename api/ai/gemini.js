// api/gemini.js
export default async function handler(req, res) {
  // Configuration CORS pour permettre les requêtes de votre frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Gérer les requêtes OPTIONS (pré-vol CORS)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Vérifier que c'est une requête POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { prompt, model } = req.body;
    
    // La clé API est dans les variables d'environnement Vercel
    const API_KEY = process.env.OwspProject;
    
    if (!API_KEY) {
      res.status(500).json({ error: 'API key not configured' });
      return;
    }

    console.log('Appel à Gemini avec modèle:', model || 'gemini-2.0-flash-exp');
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash-exp'}:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048
          }
        })
      }
    );

    const data = await response.json();
    
    // Log pour déboguer (sera visible dans les logs Vercel)
    console.log('Réponse Gemini reçue');
    
    res.status(200).json(data);
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: error.message });
  }
}