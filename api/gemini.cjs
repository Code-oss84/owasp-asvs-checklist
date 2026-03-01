// Forcer le répertoire de travail correct (important pour les chemins avec espaces)
const path = require('path');
process.chdir(path.dirname(__filename));

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Cache simple pour éviter les appels répétés
const responseCache = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 heure

module.exports = async function handler(req, res) {
  // Configuration CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Gérer les requêtes OPTIONS (pre-flight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Vérifier la méthode
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Méthode non autorisée. Utilisez POST.' 
    });
  }

  try {
    const { prompt, model } = req.body;

    if (!prompt) {
      return res.status(400).json({ 
        error: 'Le prompt est requis' 
      });
    }

    // Accès à la clé API
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_AI_API_KEY non configurée');
      return res.status(500).json({ 
        error: 'Configuration API manquante' 
      });
    }

    // Vérifier le cache
    const cacheKey = `${prompt}-${model || 'default'}`;
    const cachedResponse = responseCache.get(cacheKey);
    
    if (cachedResponse && (Date.now() - cachedResponse.timestamp) < CACHE_TTL) {
      console.log('Réponse servie depuis le cache');
      return res.status(200).json(cachedResponse.data);
    }

    // Rate limiting simple
    const rateLimitKey = req.socket.remoteAddress || 'unknown';
    const rateLimit = await checkRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Trop de requêtes. Veuillez réessayer dans quelques secondes.',
        retryAfter: rateLimit.resetTime
      });
    }

    // Initialiser Google AI
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Utiliser le modèle spécifié ou le modèle par défaut
    const modelName = model || 'gemini-pro';
    const geminiModel = genAI.getGenerativeModel({ model: modelName });

    console.log(`Appel à Gemini avec le modèle: ${modelName}`);

    // Générer la réponse
    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Formater la réponse comme attendu par votre service Angular
    const formattedResponse = {
      candidates: [{
        content: {
          parts: [{
            text: text
          }]
        }
      }],
      text: text,
      model: modelName,
      timestamp: new Date().toISOString()
    };

    // Mettre en cache
    responseCache.set(cacheKey, {
      data: formattedResponse,
      timestamp: Date.now()
    });

    return res.status(200).json(formattedResponse);

  } catch (error) {
    console.error('Erreur Gemini API:', error);

    const nodeEnv = process.env.NODE_ENV;

    // Gestion spécifique des erreurs Gemini
    if (error.message?.includes('API key')) {
      return res.status(401).json({ 
        error: 'Clé API invalide ou expirée' 
      });
    }

    if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
      return res.status(429).json({ 
        error: 'Quota API dépassé. Veuillez réessayer plus tard.' 
      });
    }

    if (error.message?.includes('model not found')) {
      return res.status(400).json({ 
        error: 'Modèle non disponible. Utilisez gemini-pro ou gemini-pro-vision' 
      });
    }

    return res.status(500).json({ 
      error: 'Erreur lors de la génération du contenu',
      details: nodeEnv === 'development' ? error.message : undefined
    });
  }
};

// Rate limiting simple
const rateLimits = new Map();

async function checkRateLimit(key) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 60; // 60 requêtes par minute

  const record = rateLimits.get(key) || { count: 0, resetTime: now + windowMs };

  if (now > record.resetTime) {
    // Réinitialiser la fenêtre
    record.count = 1;
    record.resetTime = now + windowMs;
    rateLimits.set(key, record);
    return { allowed: true };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, resetTime: record.resetTime };
  }

  record.count++;
  rateLimits.set(key, record);
  return { allowed: true };
}