import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// In-memory cache for Torn API responses to respect rate limits (100 calls / min)
interface CacheEntry {
  data: any;
  timestamp: number;
}
const apiCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes cache

function getCached(key: string): any | null {
  const entry = apiCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.data;
  }
  return null;
}

function setCache(key: string, data: any) {
  apiCache.set(key, { data, timestamp: Date.now() });
}

// Proxy endpoint for Torn API to avoid CORS issues and cache responses
app.get('/api/torn/user', async (req, res) => {
  try {
    const apiKey = (req.query.key as string) || (req.headers['x-torn-key'] as string);
    const userId = (req.query.id as string) || '';

    if (!apiKey) {
      return res.status(400).json({ error: 'Torn API Key is required' });
    }

    const cacheKey = `user_${userId || 'self'}_${apiKey}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const endpoint = userId
      ? `https://api.torn.com/user/${userId}?selections=profile,personalstats,crimes,workstats&key=${apiKey}`
      : `https://api.torn.com/user/?selections=profile,battlestats,personalstats,workstats&key=${apiKey}`;

    const response = await fetch(endpoint);
    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error.error || 'Torn API Error', code: data.error.code });
    }

    setCache(cacheKey, data);
    return res.json(data);
  } catch (err: any) {
    console.error('Torn User API Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to query Torn API' });
  }
});

// Proxy endpoint for Faction Members scanning
app.get('/api/torn/faction/:factionId', async (req, res) => {
  try {
    const apiKey = (req.query.key as string) || (req.headers['x-torn-key'] as string);
    const { factionId } = req.params;

    if (!apiKey) {
      return res.status(400).json({ error: 'Torn API Key is required' });
    }

    const cacheKey = `faction_${factionId}_${apiKey}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const endpoint = `https://api.torn.com/faction/${factionId}?selections=basic,members&key=${apiKey}`;
    const response = await fetch(endpoint);
    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error.error || 'Failed to fetch faction data' });
    }

    setCache(cacheKey, data);
    return res.json(data);
  } catch (err: any) {
    console.error('Torn Faction API Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch faction' });
  }
});

// AI Tactical Hit Advisor endpoint using @google/genai
app.post('/api/ai/advisor', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        advice: 'Gemini API Key is not configured. Please add GEMINI_API_KEY to process tactical recommendations.'
      });
    }

    const { player, targets } = req.body;

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are an expert Torn City MMORPG warfare strategist and chain target advisor.
Player Stats: Level ${player.level || 0}, Name: ${player.name || 'Player'}, Total BS Est: ${player.totalStats || 'Unknown'}.

Analyze the following top inactive targets (>30 days offline) and give 3 short, actionable tactical tips:
Targets:
${JSON.stringify(targets.slice(0, 5), null, 2)}

Provide:
1) Ideal attack order for maximum chain respect.
2) Equipment or temporary item recommendation (e.g. Pepper Spray, Grenade, Tear Gas).
3) Key warning or caution flags.

Keep response brief, formatted in bullet points with tactical tone.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return res.json({ advice: response.text });
  } catch (err: any) {
    console.error('AI Advisor Error:', err);
    return res.status(500).json({ error: 'Failed to generate tactical advice' });
  }
});

import path from 'path';

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Sargus server running on port ${PORT}`);
  });
}

startServer();
