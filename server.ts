import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Ensure persistent data directory exists
const DATA_DIR = path.resolve('data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// File path for persistent target database
const DB_FILE_PATH = path.join(DATA_DIR, 'discovered_targets.json');

interface TargetEntry {
  player_id: number;
  name: string;
  level: number;
  gender?: string;
  age: number;
  rank: string;
  last_action: {
    status: string;
    timestamp: number;
    relative: string;
  };
  status: {
    description: string;
    details: string;
    state: string;
    until: number;
  };
  personalstats?: any;
  discoveredTimestamp: number;
}

// Read discovered targets from persistent file DB
function readDbTargets(): TargetEntry[] {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const content = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('Failed to read targets DB:', e);
  }
  return [];
}

// Write discovered targets to persistent file DB
function writeDbTargets(targets: TargetEntry[]) {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(targets, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save targets DB:', e);
  }
}

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

// File path for crawler state persistence
const CRAWLER_CONFIG_PATH = path.join(DATA_DIR, 'crawler_config.json');

interface CrawlerConfig {
  enabled: boolean;
  apiKey: string;
  currentId: number;
  batchSize: number;
  intervalMs: number;
  lastRun: number;
  nextRun: number;
  lastStatusMessage: string;
  lastError: string;
}

function readCrawlerConfig(): CrawlerConfig {
  try {
    if (fs.existsSync(CRAWLER_CONFIG_PATH)) {
      const content = fs.readFileSync(CRAWLER_CONFIG_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('Failed to read crawler config:', e);
  }
  return {
    enabled: false,
    apiKey: '',
    currentId: 180000,
    batchSize: 20,
    intervalMs: 90000,
    lastRun: 0,
    nextRun: 0,
    lastStatusMessage: 'Crawler initialized',
    lastError: '',
  };
}

function saveCrawlerConfig(cfg: Partial<CrawlerConfig>) {
  try {
    const current = readCrawlerConfig();
    const updated = { ...current, ...cfg };
    fs.writeFileSync(CRAWLER_CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save crawler config:', e);
  }
}

// Background Crawler State
const initialCrawlerConfig = readCrawlerConfig();
let crawlerEnabled = initialCrawlerConfig.enabled ?? false;
let crawlerApiKey = initialCrawlerConfig.apiKey || '';
let crawlerCurrentId = initialCrawlerConfig.currentId || 180000;
let crawlerBatchSize = initialCrawlerConfig.batchSize || 20;
let crawlerIntervalMs = initialCrawlerConfig.intervalMs || 90 * 1000; // 90 seconds
let crawlerLastRun = initialCrawlerConfig.lastRun || 0;
let crawlerNextRun = initialCrawlerConfig.nextRun || 0;
let crawlerLastStatusMessage = initialCrawlerConfig.lastStatusMessage || 'Idle';
let crawlerLastError = initialCrawlerConfig.lastError || '';
let crawlerIsScanning = false;
let crawlerTimer: NodeJS.Timeout | null = null;

// Function that executes one auto-scan cycle
async function executeCrawlerCycle(overrideApiKey?: string) {
  if (crawlerIsScanning) return;

  const activeKey = overrideApiKey || crawlerApiKey;
  if (!activeKey) {
    crawlerLastStatusMessage = 'Waiting for Torn API Key...';
    console.log('[Auto-Crawler] Skipped cycle: No Torn API Key provided.');
    return;
  }

  // Sync key if new override key provided
  if (overrideApiKey && overrideApiKey !== crawlerApiKey) {
    crawlerApiKey = overrideApiKey;
  }

  crawlerIsScanning = true;
  crawlerLastRun = Date.now();
  crawlerNextRun = Date.now() + crawlerIntervalMs;
  crawlerLastError = '';

  const startId = crawlerCurrentId;
  const endId = startId + crawlerBatchSize - 1;
  crawlerLastStatusMessage = `Scanning User IDs #${startId} to #${endId}...`;
  console.log(`[Auto-Crawler] Running cycle... User IDs #${startId} to #${endId}`);

  const currentDb = readDbTargets();
  const existingMap = new Map<number, boolean>(currentDb.map((t) => [t.player_id, true]));
  let newFoundCount = 0;

  try {
    // Process in 4 batches of 5 concurrent requests to stay within rate limits and speed up execution
    const chunkSize = 5;
    for (let batchStart = 0; batchStart < crawlerBatchSize; batchStart += chunkSize) {
      const promises = [];
      for (let offset = 0; offset < chunkSize && (batchStart + offset) < crawlerBatchSize; offset++) {
        const pid = startId + batchStart + offset;
        promises.push(
          fetch(`https://api.torn.com/user/${pid}?selections=profile,personalstats&key=${activeKey}`)
            .then(res => res.json())
            .then(data => ({ pid, data }))
            .catch(err => ({ pid, error: err }))
        );
      }

      const results = await Promise.all(promises);

      for (const item of results) {
        if ('error' in item && item.error) {
          continue;
        }

        const data = (item as any).data;
        if (!data) continue;

        if (data.error) {
          crawlerLastError = data.error.error || `Torn API Error Code ${data.error.code}`;
          console.warn(`[Auto-Crawler] Torn API Error on ID #${item.pid}:`, crawlerLastError);
          continue;
        }

        if (data.player_id) {
          const rel = data.last_action?.relative || '';
          const isOffline =
            data.last_action?.status === 'Offline' ||
            rel.includes('month') ||
            rel.includes('year') ||
            parseInt(rel, 10) >= 30;

          if (isOffline && !existingMap.has(data.player_id)) {
            const entry: TargetEntry = {
              player_id: data.player_id,
              name: data.name || `User_${data.player_id}`,
              level: data.level || 1,
              gender: data.gender || 'Male',
              age: data.age || 100,
              rank: data.rank || 'Civilian',
              last_action: data.last_action || { status: 'Offline', timestamp: 0, relative: '30+ days ago' },
              status: data.status || { description: 'Okay', details: '', state: 'Okay', until: 0 },
              personalstats: data.personalstats,
              discoveredTimestamp: Date.now(),
            };

            currentDb.push(entry);
            existingMap.set(data.player_id, true);
            newFoundCount++;
          }
        }
      }

      // Small delay between chunk batches
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    if (newFoundCount > 0) {
      writeDbTargets(currentDb);
      console.log(`[Auto-Crawler] Added ${newFoundCount} new inactive targets. Total in DB: ${currentDb.length}`);
    }

    crawlerLastStatusMessage = `Scanned #${startId}-#${endId}: ${newFoundCount > 0 ? `+${newFoundCount} new targets!` : 'No new inactive targets'}`;
  } catch (err: any) {
    console.error('[Auto-Crawler] Execution cycle error:', err);
    crawlerLastError = err?.message || 'Crawler execution error';
  } finally {
    // ALWAYS advance ID range after scan attempt so crawler doesn't freeze on one range
    crawlerCurrentId += crawlerBatchSize;
    crawlerIsScanning = false;

    saveCrawlerConfig({
      enabled: crawlerEnabled,
      apiKey: crawlerApiKey,
      currentId: crawlerCurrentId,
      lastRun: crawlerLastRun,
      nextRun: crawlerNextRun,
      lastStatusMessage: crawlerLastStatusMessage,
      lastError: crawlerLastError,
    });
  }
}

// Start or reset crawler background loop
function startCrawlerLoop() {
  if (crawlerTimer) clearInterval(crawlerTimer);

  if (crawlerEnabled) {
    executeCrawlerCycle();
    crawlerTimer = setInterval(executeCrawlerCycle, crawlerIntervalMs);
  }
}

// API Endpoint to get all targets from persistent file DB
app.get('/api/torn/db-targets', (req, res) => {
  const targets = readDbTargets();
  return res.json({ targets, totalCount: targets.length });
});

// API Endpoint to get Crawler Status
app.get('/api/torn/crawler-status', (req, res) => {
  const reqKey = (req.query.key as string) || (req.headers['x-torn-key'] as string);
  if (reqKey && (!crawlerApiKey || crawlerApiKey !== reqKey)) {
    crawlerApiKey = reqKey;
    saveCrawlerConfig({ apiKey: crawlerApiKey });
  }

  const db = readDbTargets();
  return res.json({
    enabled: crawlerEnabled,
    currentId: crawlerCurrentId,
    batchSize: crawlerBatchSize,
    intervalSec: crawlerIntervalMs / 1000,
    totalInDb: db.length,
    lastRun: crawlerLastRun,
    nextRun: crawlerNextRun,
    lastStatusMessage: crawlerLastStatusMessage,
    lastError: crawlerLastError,
    isScanning: crawlerIsScanning,
    apiKeySet: Boolean(crawlerApiKey),
  });
});

// API Endpoint to Toggle / Update Crawler Config
app.post('/api/torn/crawler-toggle', (req, res) => {
  const { enabled, apiKey, startId } = req.body;

  if (enabled !== undefined) crawlerEnabled = Boolean(enabled);
  if (apiKey) crawlerApiKey = apiKey;
  if (startId) crawlerCurrentId = parseInt(startId, 10);

  saveCrawlerConfig({
    enabled: crawlerEnabled,
    apiKey: crawlerApiKey,
    currentId: crawlerCurrentId,
  });

  startCrawlerLoop();

  return res.json({
    success: true,
    enabled: crawlerEnabled,
    currentId: crawlerCurrentId,
    message: crawlerEnabled
      ? `Auto-Crawler started! Scanning 20 User IDs every 1m 30s starting at ID #${crawlerCurrentId}`
      : 'Auto-Crawler paused.',
  });
});

// API Endpoint to Force Scan Cycle Immediately
app.post('/api/torn/crawler-scan-now', async (req, res) => {
  const { apiKey, startId } = req.body || {};

  if (apiKey) crawlerApiKey = apiKey;
  if (startId) crawlerCurrentId = parseInt(startId, 10);

  saveCrawlerConfig({
    apiKey: crawlerApiKey,
    currentId: crawlerCurrentId,
  });

  await executeCrawlerCycle(apiKey);

  const db = readDbTargets();
  return res.json({
    success: true,
    currentId: crawlerCurrentId,
    totalInDb: db.length,
    lastRun: crawlerLastRun,
    lastStatusMessage: crawlerLastStatusMessage,
    lastError: crawlerLastError,
  });
});

// Proxy endpoint for Torn API User Profile
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
      const isNotFound = data.error.code === 6 || (data.error.error && data.error.error.includes('No user found'));
      const friendlyMsg = isNotFound
        ? 'User ID not found in Torn City. Please verify the User ID and try again.'
        : (data.error.error || 'Torn API Error');
      return res.status(400).json({ error: friendlyMsg, code: data.error.code });
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

// Batch Live User ID Range Scanner: Queries multiple User IDs live from Torn API
app.get('/api/torn/scan-range', async (req, res) => {
  try {
    const apiKey = (req.query.key as string) || (req.headers['x-torn-key'] as string);
    const startId = parseInt((req.query.startId as string) || '180000', 10);
    const count = Math.min(25, Math.max(5, parseInt((req.query.count as string) || '15', 10)));

    if (!apiKey) {
      return res.status(400).json({ error: 'Torn API Key is required' });
    }

    const targetUsers: any[] = [];
    const fetchPromises = [];

    for (let i = 0; i < count; i++) {
      const pid = startId + i;
      const cacheKey = `user_${pid}_${apiKey}`;
      const cached = getCached(cacheKey);

      if (cached) {
        if (!cached.error) targetUsers.push(cached);
      } else {
        fetchPromises.push(
          fetch(`https://api.torn.com/user/${pid}?selections=profile,personalstats&key=${apiKey}`)
            .then((r) => r.json())
            .then((data) => {
              if (data && !data.error && data.player_id) {
                setCache(cacheKey, data);
                targetUsers.push(data);
              }
            })
            .catch(() => {})
        );
      }
    }

    await Promise.all(fetchPromises);
    return res.json({ users: targetUsers, nextStartId: startId + count });
  } catch (err: any) {
    console.error('Batch Scan Error:', err);
    return res.status(500).json({ error: 'Failed batch scan' });
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

  // Start background auto-crawler loop if enabled in persistent config
  if (crawlerEnabled) {
    console.log(`[Auto-Crawler] Restoring active background crawler starting at ID #${crawlerCurrentId}`);
    startCrawlerLoop();
  }

  app.listen(PORT, () => {
    console.log(`Sargus server running on port ${PORT}`);
  });
}

startServer();
