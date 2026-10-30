import express from 'express';
import { createServer as createViteServer } from 'vite';
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
  country?: string;
  discoveredTimestamp: number;
}

// In-memory cache for discovered targets to avoid disk I/O bottlenecks
let inMemoryDbTargets: TargetEntry[] | null = null;

// Read discovered targets from persistent file DB (cached in memory)
function readDbTargets(): TargetEntry[] {
  if (inMemoryDbTargets !== null) {
    return inMemoryDbTargets;
  }
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const content = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      inMemoryDbTargets = Array.isArray(parsed) ? parsed : [];
      return inMemoryDbTargets;
    }
  } catch (e) {
    console.error('Failed to read targets DB:', e);
  }
  inMemoryDbTargets = [];
  return inMemoryDbTargets;
}

// Write discovered targets to persistent file DB and update cache
function writeDbTargets(targets: TargetEntry[]) {
  inMemoryDbTargets = targets;
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

// Robust Torn API Fetch Helper with headers and safe JSON/HTML handling
interface TornApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  code?: number;
  isHtml?: boolean;
  isTimeout?: boolean;
  durationMs: number;
}

const TORN_API_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 (compatible; TornScouter/2.5; +https://torn.com)',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchTornApi<T = any>(
  url: string,
  options?: { timeoutMs?: number }
): Promise<TornApiResponse<T>> {
  const timeoutMs = options?.timeoutMs || 10000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startTs = Date.now();

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: TORN_API_HEADERS,
    });
    clearTimeout(timer);
    const durationMs = Date.now() - startTs;
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const rawText = await res.text();
    const trimmed = rawText.trim();

    // Check if Torn or Cloudflare returned an HTML page (Cloudflare challenge, maintenance, etc.)
    if (trimmed.startsWith('<') || (!contentType.includes('application/json') && trimmed.includes('<html'))) {
      let friendlyError = 'Torn City API returned an unexpected HTML response.';
      if (trimmed.includes('Cloudflare') || trimmed.includes('Just a moment') || trimmed.includes('cf-browser-verification')) {
        friendlyError = 'Torn API request was intercepted by Cloudflare security check. Please try again in a few moments.';
      } else if (res.status === 429 || trimmed.toLowerCase().includes('rate limit') || trimmed.toLowerCase().includes('too many requests')) {
        friendlyError = 'Torn API rate limit reached. Please wait a few seconds before retrying.';
      } else if (res.status >= 500) {
        friendlyError = `Torn API server is temporarily unavailable (HTTP ${res.status}). Torn City servers may be undergoing maintenance.`;
      } else {
        friendlyError = `Torn API returned HTML response (HTTP ${res.status}).`;
      }

      return {
        ok: false,
        status: res.status,
        error: friendlyError,
        isHtml: true,
        durationMs,
      };
    }

    // Safely parse JSON
    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return {
        ok: false,
        status: res.status,
        error: 'Invalid JSON received from Torn API',
        durationMs,
      };
    }

    if (parsed && parsed.error) {
      const errCode = parsed.error.code;
      const errMsg = parsed.error.error || 'Torn API Error';
      return {
        ok: false,
        status: res.status,
        code: errCode,
        error: errMsg,
        data: parsed,
        durationMs,
      };
    }

    return {
      ok: res.ok,
      status: res.status,
      data: parsed,
      durationMs,
    };
  } catch (err: any) {
    clearTimeout(timer);
    const elapsed = Date.now() - startTs;
    const isTimeout =
      err.name === 'AbortError' ||
      err.name === 'TimeoutError' ||
      elapsed >= (timeoutMs - 100) ||
      (err.message && (err.message.includes('aborted') || err.message.includes('timeout')));

    return {
      ok: false,
      status: isTimeout ? 408 : 500,
      error: isTimeout
        ? `Torn API request timed out after ${Math.round(elapsed / 1000)}s`
        : err.message || 'Network error querying Torn API',
      isTimeout,
      durationMs: elapsed,
    };
  }
}


// File path for crawler state persistence
const CRAWLER_CONFIG_PATH = path.join(DATA_DIR, 'crawler_config.json');

export interface SkipRange {
  start: number;
  end: number;
  reason: string;
  count: number;
  timestamp: number;
}

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
  consecutiveDeadBatches?: number;
  consecutiveIncorrectIds?: number;
  totalDeadBlocksSkipped?: number;
  maxConsecutive404s?: number; // threshold to trigger auto-jump (default 10)
  timeoutMs?: number; // timeout threshold per ID request in ms (default 10000 = 10s)
  consecutiveTimeouts?: number;
  totalTimeoutsSkipped?: number;
  skipRanges?: SkipRange[];
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
    intervalMs: 30000,
    lastRun: 0,
    nextRun: 0,
    lastStatusMessage: 'Crawler initialized',
    lastError: '',
    consecutiveDeadBatches: 0,
    consecutiveIncorrectIds: 0,
    totalDeadBlocksSkipped: 0,
    maxConsecutive404s: 10,
    timeoutMs: 10000, // 10 seconds timeout
    consecutiveTimeouts: 0,
    totalTimeoutsSkipped: 0,
    skipRanges: [],
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
let crawlerIntervalMs = initialCrawlerConfig.intervalMs || 30 * 1000; // 30 seconds loop
let crawlerLastRun = initialCrawlerConfig.lastRun || 0;
let crawlerNextRun = initialCrawlerConfig.nextRun || 0;
let crawlerLastStatusMessage = initialCrawlerConfig.lastStatusMessage || 'Idle';
let crawlerLastError = initialCrawlerConfig.lastError || '';
let crawlerConsecutiveDeadBatches = initialCrawlerConfig.consecutiveDeadBatches || 0;
let crawlerConsecutiveIncorrectIds = initialCrawlerConfig.consecutiveIncorrectIds || 0;
let crawlerTotalDeadBlocksSkipped = initialCrawlerConfig.totalDeadBlocksSkipped || 0;
let crawlerMaxConsecutive404s = initialCrawlerConfig.maxConsecutive404s || 10;
let crawlerTimeoutMs = initialCrawlerConfig.timeoutMs || 10000; // 10-second timeout default
let crawlerConsecutiveTimeouts = initialCrawlerConfig.consecutiveTimeouts || 0;
let crawlerTotalTimeoutsSkipped = initialCrawlerConfig.totalTimeoutsSkipped || 0;
let crawlerLastJumpSize = 0;
let crawlerSkipRanges: SkipRange[] = Array.isArray(initialCrawlerConfig.skipRanges) ? initialCrawlerConfig.skipRanges : [];
let crawlerIsScanning = false;
let crawlerTimer: NodeJS.Timeout | null = null;

// Real-time Live-Scan Progress tracking
interface LiveScanState {
  isScanning: boolean;
  startId: number;
  endId: number;
  total: number;
  scannedCount: number;
  remaining: number;
  currentPid: number;
  isSkipping: boolean;
  skipReason: string;
  jumpStep?: number;
  jumpTargetId?: number;
  lastSkipTimestamp?: number;
}

const crawlerLiveScan: LiveScanState = {
  isScanning: false,
  startId: 180000,
  endId: 180019,
  total: 20,
  scannedCount: 0,
  remaining: 20,
  currentPid: 180000,
  isSkipping: false,
  skipReason: '',
  jumpStep: 0,
  jumpTargetId: 0,
  lastSkipTimestamp: 0,
};


// Bypass known dead/skip ranges
function bypassKnownSkipRanges(id: number): { nextId: number; jumped: boolean; range?: SkipRange } {
  let nextId = id;
  let jumped = false;
  let lastJumpRange: SkipRange | undefined;

  let changed = true;
  let iterations = 0;
  while (changed && iterations < 50) {
    changed = false;
    iterations++;
    for (const r of crawlerSkipRanges) {
      if (nextId >= r.start && nextId <= r.end) {
        nextId = r.end + 1;
        jumped = true;
        lastJumpRange = r;
        changed = true;
        break;
      }
    }
  }

  return { nextId, jumped, range: lastJumpRange };
}

// Register dead range in skip-list and merge overlapping or adjacent entries
function registerSkipRange(start: number, end: number, reason: string) {
  if (start > end) return;
  const count = end - start + 1;
  const newRange: SkipRange = {
    start,
    end,
    reason,
    count,
    timestamp: Date.now(),
  };

  let merged = false;
  for (const existing of crawlerSkipRanges) {
    if (
      (newRange.start >= existing.start && newRange.start <= existing.end + 1) ||
      (newRange.end >= existing.start - 1 && newRange.end <= existing.end) ||
      (newRange.start <= existing.start && newRange.end >= existing.end)
    ) {
      existing.start = Math.min(existing.start, newRange.start);
      existing.end = Math.max(existing.end, newRange.end);
      existing.count = existing.end - existing.start + 1;
      existing.timestamp = Date.now();
      existing.reason = reason;
      merged = true;
      break;
    }
  }

  if (!merged) {
    crawlerSkipRanges.push(newRange);
  }

  // Sort ranges and prune to max 100 entries
  crawlerSkipRanges.sort((a, b) => a.start - b.start);
  if (crawlerSkipRanges.length > 100) {
    crawlerSkipRanges = crawlerSkipRanges.slice(-100);
  }
}

// Strict Batch Validation Check before DB persistence
interface BatchValidationResult {
  validTargets: TargetEntry[];
  rejectedCount: number;
  reasons: Record<string, number>;
}

function validateBatchTargets(
  rawCandidates: any[],
  existingMap: Map<number, boolean>
): BatchValidationResult {
  const validTargets: TargetEntry[] = [];
  const seenInBatch = new Set<number>();
  const reasons: Record<string, number> = {
    invalid_id: 0,
    already_in_db: 0,
    duplicate_in_batch: 0,
    invalid_profile_data: 0,
    not_inactive_under_30d: 0,
  };

  for (const raw of rawCandidates) {
    // 1. Verify Player ID is a positive integer
    const pid = Number(raw.player_id);
    if (!pid || isNaN(pid) || pid <= 0 || !Number.isInteger(pid)) {
      reasons.invalid_id++;
      continue;
    }

    // 2. Deduplication check against persistent DB removed to allow updates

    // 3. Deduplication check within current batch
    if (seenInBatch.has(pid)) {
      reasons.duplicate_in_batch++;
      continue;
    }

    // 4. Sanity check profile structure
    if (!raw.name || typeof raw.name !== 'string' || raw.name.trim().length === 0) {
      reasons.invalid_profile_data++;
      continue;
    }

    // 5. Inactivity verification (must be >= 30 days offline)
    let daysOffline = 0;
    if (raw.last_action?.timestamp && raw.last_action.timestamp > 0) {
      const diffSec = Math.floor(Date.now() / 1000) - raw.last_action.timestamp;
      daysOffline = Math.max(0, Math.floor(diffSec / 86400));
    } else {
      const rel = (raw.last_action?.relative || '').toLowerCase();
      if (rel.includes('year')) {
        daysOffline = (parseInt(rel, 10) || 1) * 365;
      } else if (rel.includes('month')) {
        daysOffline = (parseInt(rel, 10) || 1) * 30;
      } else if (rel.includes('day')) {
        daysOffline = parseInt(rel, 10) || 1;
      }
    }

    if (daysOffline < 30) {
      reasons.not_inactive_under_30d++;
      continue;
    }

    // Extract country/location if present
    let country = 'Torn';
    if (raw.country && typeof raw.country === 'string') {
      country = raw.country.trim();
    } else if (raw.travel?.destination && typeof raw.travel.destination === 'string') {
      country = raw.travel.destination.trim();
    } else {
      const desc = (raw.status?.description || '').toLowerCase();
      const det = (raw.status?.details || '').trim();
      const known = ['Argentina', 'Canada', 'Cayman Islands', 'China', 'Hawaii', 'Japan', 'Mexico', 'South Africa', 'Switzerland', 'UAE', 'United Kingdom'];
      for (const k of known) {
        if (desc.includes(k.toLowerCase()) || det.toLowerCase().includes(k.toLowerCase())) {
          country = k;
          break;
        }
      }
      if (country === 'Torn' && raw.status?.state === 'Abroad' && det) {
        country = det;
      }
    }

    // 6. Passed all validations - construct sanitized entry
    const validatedEntry: TargetEntry = {
      player_id: pid,
      name: raw.name.trim(),
      level: Math.max(1, Math.min(100, Number(raw.level) || 1)),
      gender: raw.gender === 'Female' ? 'Female' : 'Male',
      age: Math.max(1, Number(raw.age) || 100),
      rank: typeof raw.rank === 'string' && raw.rank.trim() ? raw.rank.trim() : 'Civilian',
      last_action: {
        status: raw.last_action?.status || 'Offline',
        timestamp: Number(raw.last_action?.timestamp) || 0,
        relative: raw.last_action?.relative || `${daysOffline} days ago`,
      },
      status: {
        description: raw.status?.description || 'Okay',
        details: raw.status?.details || '',
        state: raw.status?.state || 'Okay',
        until: Number(raw.status?.until) || 0,
      },
      personalstats: raw.personalstats || {},
      country,
      discoveredTimestamp: Date.now(),
    };

    seenInBatch.add(pid);
    validTargets.push(validatedEntry);
  }

  const rejectedCount = Object.values(reasons).reduce((a, b) => a + b, 0);
  return { validTargets, rejectedCount, reasons };
}

// Function that executes one auto-scan cycle with dynamic dead block jump and batch validation
async function executeCrawlerCycle(overrideApiKey?: string) {
  // Safety watchdog: if stuck scanning for >25 seconds, force-reset flag
  if (crawlerIsScanning) {
    if (Date.now() - crawlerLastRun > 25000) {
      console.warn('[Auto-Crawler] Resetting stuck scanning flag after watchdog timeout.');
      crawlerIsScanning = false;
    } else {
      return;
    }
  }

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

  // Pre-check skip ranges before starting scan
  const skipCheck = bypassKnownSkipRanges(crawlerCurrentId);
  if (skipCheck.jumped) {
    console.log(`[Auto-Crawler] Pre-check: Bypassed dead range. Fast-forwarded #${crawlerCurrentId} -> #${skipCheck.nextId}`);
    crawlerCurrentId = skipCheck.nextId;
  }

  crawlerIsScanning = true;
  crawlerLastRun = Date.now();
  crawlerNextRun = Date.now() + crawlerIntervalMs;
  crawlerLastError = '';

  const startId = crawlerCurrentId;
  const endId = startId + crawlerBatchSize - 1;
  crawlerLastStatusMessage = `Scanning User IDs #${startId} to #${endId}...`;
  console.log(`[Auto-Crawler] Running cycle... User IDs #${startId} to #${endId}`);

  // Initialize live scan progress
  crawlerLiveScan.isScanning = true;
  crawlerLiveScan.startId = startId;
  crawlerLiveScan.endId = endId;
  crawlerLiveScan.total = crawlerBatchSize;
  crawlerLiveScan.scannedCount = 0;
  crawlerLiveScan.remaining = crawlerBatchSize;
  crawlerLiveScan.currentPid = startId;
  crawlerLiveScan.isSkipping = crawlerConsecutiveIncorrectIds >= 5 || Boolean(skipCheck.jumped);
  crawlerLiveScan.skipReason = skipCheck.jumped
    ? `Fast-forwarded past dead range #${skipCheck.range?.start || startId}-#${skipCheck.range?.end || endId}`
    : crawlerConsecutiveIncorrectIds >= 5
    ? `Warning: ${crawlerConsecutiveIncorrectIds}/10 consecutive 404s encountered. Approaching auto-skip threshold.`
    : '';

  const currentDb = readDbTargets();
  const existingMap = new Map<number, boolean>(currentDb.map((t) => [t.player_id, true]));
  const rawBatchCandidates: any[] = [];
  let invalidIdCount = 0;
  let validAccountsFound = 0;
  let autoThresholdJumped = false;

  try {
    // Process in 4 batches of 5 concurrent requests with strict 10s timeout per ID
    const chunkSize = 5;
    for (let batchStart = 0; batchStart < crawlerBatchSize; batchStart += chunkSize) {
      if (autoThresholdJumped) break;

      const promises = [];
      for (let offset = 0; offset < chunkSize && (batchStart + offset) < crawlerBatchSize; offset++) {
        const pid = startId + batchStart + offset;
        promises.push(
          (async () => {
            const apiRes = await fetchTornApi(`https://api.torn.com/user/${pid}?selections=profile,personalstats&key=${activeKey}`, {
              timeoutMs: crawlerTimeoutMs,
            });
            return {
              pid,
              data: apiRes.data,
              error: apiRes.error ? { error: apiRes.error, code: apiRes.code } : undefined,
              isTimeout: Boolean(apiRes.isTimeout),
              isHtml: Boolean(apiRes.isHtml),
              durationMs: apiRes.durationMs,
            };
          })()
        );

      }

      const results = await Promise.all(promises);

      // Update live scan progress counter immediately after chunk finishes
      crawlerLiveScan.scannedCount = Math.min(crawlerBatchSize, batchStart + results.length);
      crawlerLiveScan.remaining = Math.max(0, crawlerBatchSize - crawlerLiveScan.scannedCount);
      if (results.length > 0) {
        crawlerLiveScan.currentPid = results[results.length - 1].pid;
      }

      for (const item of results) {
        // Condition A: 10-Second Timeout on getting ID
        if (item.isTimeout) {
          crawlerConsecutiveTimeouts++;
          console.warn(`[Auto-Crawler] ⏱️ 10s timeout reached fetching User ID #${item.pid} (${item.durationMs}ms >= ${crawlerTimeoutMs}ms limit)`);

          const jumpStep = 500;
          const deadBlockStart = item.pid;
          const deadBlockEnd = item.pid + jumpStep - 1;
          registerSkipRange(deadBlockStart, deadBlockEnd, `10s timeout reached fetching User ID #${item.pid} (${item.durationMs}ms)`);
          crawlerTotalDeadBlocksSkipped++;
          crawlerTotalTimeoutsSkipped++;
          crawlerLastJumpSize = jumpStep;

          const prospectiveId = item.pid + jumpStep;
          const postCheck = bypassKnownSkipRanges(prospectiveId);
          crawlerCurrentId = postCheck.nextId;
          crawlerConsecutiveIncorrectIds = 0;
          crawlerConsecutiveDeadBatches = 0;
          crawlerConsecutiveTimeouts = 0;
          autoThresholdJumped = true;

          crawlerLiveScan.isSkipping = true;
          crawlerLiveScan.skipReason = `⏱️ 10-Second Timeout reached on ID #${item.pid} (${Math.round(item.durationMs / 1000)}s). Auto-jumped +${jumpStep} IDs to #${crawlerCurrentId}!`;
          crawlerLiveScan.jumpStep = jumpStep;
          crawlerLiveScan.jumpTargetId = crawlerCurrentId;
          crawlerLiveScan.lastSkipTimestamp = Date.now();
          crawlerLiveScan.scannedCount = crawlerBatchSize;
          crawlerLiveScan.remaining = 0;

          crawlerLastStatusMessage = `⏱️ 10s timeout on ID #${item.pid}. Auto-jumped +${jumpStep} IDs to #${crawlerCurrentId}!`;
          console.log(`[Auto-Crawler] 10s timeout reached. Auto-jumped +${jumpStep} IDs to #${crawlerCurrentId} to maintain crawler throughput.`);
          break;
        }

        if ('error' in item && item.error) {
          continue;
        }

        const data = (item as any).data;
        if (!data) continue;

        if (data.error) {
          const errCode = data.error.code;
          const errMsg = data.error.error || '';
          const isInvalidId =
            errCode === 6 ||
            errMsg.toLowerCase().includes('incorrect id') ||
            errMsg.toLowerCase().includes('no user found');

          if (!isInvalidId) {
            // Only set crawlerLastError and log warning for true API / Auth / Rate Limit errors
            crawlerLastError = errMsg || `Torn API Error Code ${errCode}`;
            console.warn(`[Auto-Crawler] Torn API Error on ID #${item.pid}:`, crawlerLastError);
          } else {
            invalidIdCount++;
            crawlerConsecutiveIncorrectIds++;
            console.warn(`[Auto-Crawler] Torn API Error on ID #${item.pid}: Incorrect ID (consecutive: ${crawlerConsecutiveIncorrectIds}/${crawlerMaxConsecutive404s})`);

            // If getting close to threshold, enter skipping warning state
            if (crawlerConsecutiveIncorrectIds >= 5) {
              crawlerLiveScan.isSkipping = true;
              crawlerLiveScan.skipReason = `Warning: ${crawlerConsecutiveIncorrectIds}/${crawlerMaxConsecutive404s} consecutive 404s encountered. Approaching auto-skip threshold.`;
            }

            // Condition B: Exactly 10 (or configured threshold) consecutive 'Incorrect ID' 404 errors hit -> Trigger auto-jump of 500 IDs
            if (crawlerConsecutiveIncorrectIds >= crawlerMaxConsecutive404s) {
              const jumpStep = 500;
              const deadBlockStart = Math.max(1, item.pid - crawlerConsecutiveIncorrectIds + 1);
              const deadBlockEnd = item.pid + jumpStep - 1;
              registerSkipRange(deadBlockStart, deadBlockEnd, `10 consecutive 404s reached (${crawlerConsecutiveIncorrectIds} consecutive Incorrect IDs)`);
              crawlerTotalDeadBlocksSkipped++;
              crawlerLastJumpSize = jumpStep;

              const prospectiveId = item.pid + jumpStep;
              const postCheck = bypassKnownSkipRanges(prospectiveId);
              crawlerCurrentId = postCheck.nextId;
              crawlerConsecutiveIncorrectIds = 0;
              crawlerConsecutiveDeadBatches = 0;
              crawlerConsecutiveTimeouts = 0;
              autoThresholdJumped = true;

              // Mark skipping state active
              crawlerLiveScan.isSkipping = true;
              crawlerLiveScan.skipReason = `🚨 10 consecutive 404s reached (${crawlerMaxConsecutive404s} Incorrect IDs). Auto-jumped +${jumpStep} IDs to #${crawlerCurrentId}!`;
              crawlerLiveScan.jumpStep = jumpStep;
              crawlerLiveScan.jumpTargetId = crawlerCurrentId;
              crawlerLiveScan.lastSkipTimestamp = Date.now();
              crawlerLiveScan.scannedCount = crawlerBatchSize;
              crawlerLiveScan.remaining = 0;

              crawlerLastStatusMessage = `🚀 10 consecutive 404s reached. Auto-jumped +${jumpStep} IDs to #${crawlerCurrentId}!`;
              console.log(`[Auto-Crawler] 10 consecutive 404s reached. Auto-jumped +${jumpStep} IDs to #${crawlerCurrentId} to bypass dead ID block.`);
              break;
            }
          }
          continue;
        }

        if (data.player_id) {
          // Valid player account found! Reset consecutive counters
          crawlerConsecutiveIncorrectIds = 0;
          crawlerConsecutiveTimeouts = 0;
          validAccountsFound++;
          rawBatchCandidates.push(data);
        }
      }

      if (autoThresholdJumped) {
        break;
      }

      // Small delay between chunk batches
      await new Promise(resolve => setTimeout(resolve, 150));
    }


    // Refactored Step: Batch Validation Check before DB storage
    const { validTargets, rejectedCount, reasons } = validateBatchTargets(rawBatchCandidates, existingMap);

    if (validTargets.length > 0) {
      let addedCount = 0;
      let updatedCount = 0;
      for (const t of validTargets) {
        const existingIndex = currentDb.findIndex(existing => existing.player_id === t.player_id);
        if (existingIndex !== -1) {
          currentDb[existingIndex] = t; // Update
          updatedCount++;
        } else {
          currentDb.push(t); // Add new
          existingMap.set(t.player_id, true);
          addedCount++;
        }
      }
      writeDbTargets(currentDb);
      console.log(`[Auto-Crawler] [Batch Validation Passed] Saved ${addedCount} new and updated ${updatedCount} existing inactive targets. Total in DB: ${currentDb.length}`);
    }

    // Dynamic Range Jump & Dead Block Skipping Logic
    if (autoThresholdJumped) {
      // Current ID already advanced by +500 and skip range logged
    } else if (invalidIdCount >= 18) {
      crawlerConsecutiveDeadBatches++;
      registerSkipRange(startId, endId, 'Torn Incorrect ID / Empty Slot');

      if (crawlerConsecutiveDeadBatches >= 2) {
        // Extended dead zone detected! Implement automatic dynamic next-batch jump
        let jumpStep = 200;
        if (crawlerConsecutiveDeadBatches === 3) jumpStep = 500;
        else if (crawlerConsecutiveDeadBatches >= 4) jumpStep = Math.min(2500, 1000 * (crawlerConsecutiveDeadBatches - 2));

        const deadBlockEnd = startId + jumpStep - 1;
        registerSkipRange(startId, deadBlockEnd, `Consecutive dead block (${crawlerConsecutiveDeadBatches} dead batches)`);
        crawlerTotalDeadBlocksSkipped++;
        crawlerLastJumpSize = jumpStep;

        const prospectiveId = startId + jumpStep;
        const postCheck = bypassKnownSkipRanges(prospectiveId);
        crawlerCurrentId = postCheck.nextId;

        crawlerLastStatusMessage = `🚀 Dead zone bypassed (${crawlerConsecutiveDeadBatches} consecutive empty batches). Auto-jumped +${jumpStep} IDs to #${crawlerCurrentId}!`;
        console.log(`[Auto-Crawler] Extended dead ID block detected: Auto-jumped +${jumpStep} IDs to #${crawlerCurrentId} to ensure continuous DB population.`);
      } else {
        // 1st dead batch: advance standard batch size
        crawlerCurrentId += crawlerBatchSize;
        crawlerLastJumpSize = 0;
        crawlerLastStatusMessage = `Scanned #${startId}-#${endId}: ${invalidIdCount}/${crawlerBatchSize} IDs empty/invalid slots (skipped).`;
      }
    } else {
      // Valid player accounts were found in this batch!
      crawlerConsecutiveDeadBatches = 0;
      crawlerLastJumpSize = 0;
      crawlerCurrentId += crawlerBatchSize;

      if (validTargets.length > 0) {
        crawlerLastStatusMessage = `Scanned #${startId}-#${endId}: +${validTargets.length} verified inactive targets added to DB!`;
      } else if (validAccountsFound > 0) {
        crawlerLastStatusMessage = `Scanned #${startId}-#${endId}: Found ${validAccountsFound} active accounts (${reasons.not_inactive_under_30d || 0} offline <30d, 0 added).`;
      } else {
        crawlerLastStatusMessage = `Scanned #${startId}-#${endId}: No valid targets met criteria.`;
      }
    }
  } catch (err: any) {
    console.error('[Auto-Crawler] Execution cycle error:', err);
    crawlerLastError = err?.message || 'Crawler execution error';
    crawlerCurrentId += crawlerBatchSize;
  } finally {
    crawlerIsScanning = false;
    crawlerLiveScan.isScanning = false;
    crawlerLiveScan.scannedCount = crawlerLiveScan.total;
    crawlerLiveScan.remaining = 0;

    saveCrawlerConfig({
      enabled: crawlerEnabled,
      apiKey: crawlerApiKey,
      currentId: crawlerCurrentId,
      lastRun: crawlerLastRun,
      nextRun: crawlerNextRun,
      lastStatusMessage: crawlerLastStatusMessage,
      lastError: crawlerLastError,
      consecutiveIncorrectIds: crawlerConsecutiveIncorrectIds,
      consecutiveDeadBatches: crawlerConsecutiveDeadBatches,
      totalDeadBlocksSkipped: crawlerTotalDeadBlocksSkipped,
      maxConsecutive404s: crawlerMaxConsecutive404s,
      timeoutMs: crawlerTimeoutMs,
      consecutiveTimeouts: crawlerConsecutiveTimeouts,
      totalTimeoutsSkipped: crawlerTotalTimeoutsSkipped,
      skipRanges: crawlerSkipRanges,
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
app.get(['/api/torn/db-targets', '/api/db-targets'], (req, res) => {
  const targets = readDbTargets();
  return res.json({ targets, totalCount: targets.length });
});

// API Endpoint to get Crawler Status
app.get(['/api/torn/crawler-status', '/api/crawler-status', '/api/crawler/status'], (req, res) => {
  const reqKey = (req.query.key as string) || (req.headers['x-torn-key'] as string);
  if (reqKey && (!crawlerApiKey || crawlerApiKey !== reqKey)) {
    crawlerApiKey = reqKey;
    saveCrawlerConfig({ apiKey: crawlerApiKey });
  }

  const db = readDbTargets();
  const isRecentSkip = Boolean(crawlerLiveScan.lastSkipTimestamp && (Date.now() - crawlerLiveScan.lastSkipTimestamp < 15000));
  const isSkippingState = Boolean(crawlerLiveScan.isSkipping || isRecentSkip || crawlerConsecutiveIncorrectIds >= 5 || crawlerConsecutiveDeadBatches >= 2);

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
    consecutiveIncorrectIds: crawlerConsecutiveIncorrectIds,
    consecutiveDeadBatches: crawlerConsecutiveDeadBatches,
    totalDeadBlocksSkipped: crawlerTotalDeadBlocksSkipped,
    maxConsecutive404s: crawlerMaxConsecutive404s,
    timeoutMs: crawlerTimeoutMs,
    consecutiveTimeouts: crawlerConsecutiveTimeouts,
    totalTimeoutsSkipped: crawlerTotalTimeoutsSkipped,
    lastJumpSize: crawlerLastJumpSize,
    skipRangesCount: crawlerSkipRanges.length,
    liveScan: {
      isScanning: crawlerIsScanning,
      startId: crawlerLiveScan.startId,
      endId: crawlerLiveScan.endId,
      total: crawlerLiveScan.total,
      scannedCount: crawlerLiveScan.scannedCount,
      remaining: crawlerLiveScan.remaining,
      currentPid: crawlerLiveScan.currentPid,
      isSkipping: isSkippingState,
      skipReason: crawlerLiveScan.skipReason || (
        crawlerConsecutiveIncorrectIds >= 5
          ? `High 404 frequency: ${crawlerConsecutiveIncorrectIds}/${crawlerMaxConsecutive404s} consecutive Incorrect IDs`
          : crawlerConsecutiveDeadBatches >= 2
          ? `Consecutive dead batches (${crawlerConsecutiveDeadBatches} empty batches). Fast-forwarding.`
          : ''
      ),
      jumpStep: crawlerLiveScan.jumpStep || crawlerLastJumpSize,
      jumpTargetId: crawlerLiveScan.jumpTargetId || crawlerCurrentId,
    },
  });
});

// API Endpoint to Toggle / Update Crawler Config
app.post(['/api/torn/crawler-toggle', '/api/crawler-toggle'], (req, res) => {
  const { enabled, apiKey, startId, maxConsecutive404s, timeoutMs } = req.body;

  if (enabled !== undefined) crawlerEnabled = Boolean(enabled);
  if (apiKey) crawlerApiKey = apiKey;
  if (startId) {
    crawlerCurrentId = parseInt(startId, 10);
    crawlerConsecutiveIncorrectIds = 0;
    crawlerConsecutiveTimeouts = 0;
  }
  if (typeof maxConsecutive404s === 'number' && maxConsecutive404s > 0) {
    crawlerMaxConsecutive404s = maxConsecutive404s;
  }
  if (typeof timeoutMs === 'number' && timeoutMs >= 2000) {
    crawlerTimeoutMs = timeoutMs;
  }

  saveCrawlerConfig({
    enabled: crawlerEnabled,
    apiKey: crawlerApiKey,
    currentId: crawlerCurrentId,
    consecutiveIncorrectIds: crawlerConsecutiveIncorrectIds,
    consecutiveTimeouts: crawlerConsecutiveTimeouts,
    maxConsecutive404s: crawlerMaxConsecutive404s,
    timeoutMs: crawlerTimeoutMs,
  });

  startCrawlerLoop();

  return res.json({
    success: true,
    enabled: crawlerEnabled,
    currentId: crawlerCurrentId,
    maxConsecutive404s: crawlerMaxConsecutive404s,
    timeoutMs: crawlerTimeoutMs,
    message: crawlerEnabled
      ? `Auto-Crawler started! Scanning 20 User IDs every 30s starting at ID #${crawlerCurrentId}`
      : 'Auto-Crawler paused.',
  });
});

// API Endpoint to Update Crawler Config Settings (e.g. 404 threshold, timeout, batch size)
app.post(['/api/torn/crawler-config', '/api/crawler-config'], (req, res) => {
  const { maxConsecutive404s, timeoutMs, batchSize } = req.body || {};
  if (typeof maxConsecutive404s === 'number' && maxConsecutive404s > 0) {
    crawlerMaxConsecutive404s = maxConsecutive404s;
  }
  if (typeof timeoutMs === 'number' && timeoutMs >= 2000) {
    crawlerTimeoutMs = timeoutMs;
  }
  if (typeof batchSize === 'number' && batchSize >= 5 && batchSize <= 50) {
    crawlerBatchSize = batchSize;
  }
  saveCrawlerConfig({
    maxConsecutive404s: crawlerMaxConsecutive404s,
    timeoutMs: crawlerTimeoutMs,
    batchSize: crawlerBatchSize,
  });
  return res.json({
    success: true,
    maxConsecutive404s: crawlerMaxConsecutive404s,
    timeoutMs: crawlerTimeoutMs,
    batchSize: crawlerBatchSize,
  });
});

// API Endpoint to Manually Jump Crawler ID Forward (e.g. +200, +500, +1000)
app.post(['/api/torn/crawler-jump', '/api/crawler-jump'], (req, res) => {
  const { step, targetId } = req.body || {};
  let newId = crawlerCurrentId;

  if (typeof targetId === 'number' && targetId > 0) {
    newId = targetId;
  } else if (typeof step === 'number') {
    newId = Math.max(1, crawlerCurrentId + step);
  }

  const check = bypassKnownSkipRanges(newId);
  crawlerCurrentId = check.nextId;
  crawlerConsecutiveDeadBatches = 0;
  crawlerConsecutiveIncorrectIds = 0;
  crawlerLastJumpSize = step || 0;
  crawlerLastStatusMessage = `Manually jumped crawler forward to User ID #${crawlerCurrentId}`;

  crawlerLiveScan.isSkipping = true;
  crawlerLiveScan.skipReason = `Manually fast-forwarded +${step || 0} IDs to #${crawlerCurrentId}`;
  crawlerLiveScan.jumpStep = step || 0;
  crawlerLiveScan.jumpTargetId = crawlerCurrentId;
  crawlerLiveScan.lastSkipTimestamp = Date.now();

  saveCrawlerConfig({
    currentId: crawlerCurrentId,
    consecutiveDeadBatches: 0,
    consecutiveIncorrectIds: 0,
    lastStatusMessage: crawlerLastStatusMessage,
  });

  return res.json({
    success: true,
    currentId: crawlerCurrentId,
    message: crawlerLastStatusMessage,
  });
});

// API Endpoint to Force Scan Cycle Immediately
app.post(['/api/torn/crawler-scan-now', '/api/crawler-scan-now'], async (req, res) => {
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
app.get(['/api/torn/user', '/api/user'], async (req, res) => {
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

    const result = await fetchTornApi(endpoint);

    if (!result.ok || !result.data) {
      const isNotFound = result.code === 6 || (result.error && result.error.includes('No user found'));
      const friendlyMsg = isNotFound
        ? 'User ID not found in Torn City. Please verify the User ID and try again.'
        : (result.error || 'Torn API Error');
      return res.status(result.status || 400).json({ error: friendlyMsg, code: result.code });
    }

    setCache(cacheKey, result.data);
    return res.json(result.data);
  } catch (err: any) {
    console.error('Torn User API Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to query Torn API' });
  }
});

// Proxy endpoint for Faction Members scanning
app.get(['/api/torn/faction/:factionId', '/api/faction/:factionId'], async (req, res) => {
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
    const result = await fetchTornApi(endpoint);

    if (!result.ok || !result.data) {
      return res.status(result.status || 400).json({ error: result.error || 'Failed to fetch faction data' });
    }

    setCache(cacheKey, result.data);
    return res.json(result.data);
  } catch (err: any) {
    console.error('Torn Faction API Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch faction' });
  }
});

// Batch Live User ID Range Scanner: Queries multiple User IDs live from Torn API with 10s timeout and 10x 404 auto-skip
app.get(['/api/torn/scan-range', '/api/scan-range'], async (req, res) => {
  try {
    const apiKey = (req.query.key as string) || (req.headers['x-torn-key'] as string);
    let startId = parseInt((req.query.startId as string) || '180000', 10);
    const count = Math.min(25, Math.max(5, parseInt((req.query.count as string) || '15', 10)));

    if (!apiKey) {
      return res.status(400).json({ error: 'Torn API Key is required' });
    }

    // Pre-check skip ranges
    const preCheck = bypassKnownSkipRanges(startId);
    if (preCheck.jumped) {
      startId = preCheck.nextId;
    }

    const targetUsers: any[] = [];
    let consecutive404s = 0;
    let timedOutCount = 0;
    let didAutoSkip = false;
    let skippedNextId = startId + count;
    let skipReason = '';

    for (let i = 0; i < count; i++) {
      if (didAutoSkip) break;
      const pid = startId + i;
      const cacheKey = `user_${pid}_${apiKey}`;
      const cached = getCached(cacheKey);

      if (cached) {
        if (!cached.error && cached.player_id) {
          consecutive404s = 0;
          targetUsers.push(cached);
        } else if (cached.error) {
          consecutive404s++;
        }
      } else {
        const apiRes = await fetchTornApi(`https://api.torn.com/user/${pid}?selections=profile,personalstats&key=${apiKey}`, {
          timeoutMs: crawlerTimeoutMs,
        });

        if (apiRes.isTimeout) {
          timedOutCount++;
          console.warn(`[Batch Scan] ⏱️ 10s timeout fetching User ID #${pid}`);
          // Trigger 10s timeout auto-skip
          const jumpStep = 500;
          registerSkipRange(pid, pid + jumpStep - 1, `10s timeout on ID #${pid} in live scanner`);
          skippedNextId = pid + jumpStep;
          const postCheck = bypassKnownSkipRanges(skippedNextId);
          skippedNextId = postCheck.nextId;
          didAutoSkip = true;
          skipReason = `⏱️ 10-second timeout reached fetching ID #${pid}. Auto-jumped +${jumpStep} IDs to #${skippedNextId}`;
          break;
        }

        const data = apiRes.data;
        if (data && !data.error && data.player_id) {
          consecutive404s = 0;
          setCache(cacheKey, data);
          targetUsers.push(data);
        } else if (data?.error || apiRes.error) {
          const errCode = data?.error?.code || apiRes.code;
          const errMsg = data?.error?.error || apiRes.error || '';
          const isInvalidId =
            errCode === 6 ||
            errMsg.toLowerCase().includes('incorrect id') ||
            errMsg.toLowerCase().includes('no user found');

          if (isInvalidId) {
            consecutive404s++;
          }
        }

        // Trigger 10x 404 auto-skip
        if (consecutive404s >= crawlerMaxConsecutive404s) {
          const jumpStep = 500;
          registerSkipRange(startId, pid + jumpStep - 1, `10 consecutive 404s in live scanner`);
          skippedNextId = pid + jumpStep;
          const postCheck = bypassKnownSkipRanges(skippedNextId);
          skippedNextId = postCheck.nextId;
          didAutoSkip = true;
          skipReason = `🚨 10 consecutive 404s ('Incorrect ID') reached. Auto-jumped +${jumpStep} IDs to #${skippedNextId}`;
          break;
        }
      }
    }

    return res.json({
      users: targetUsers,
      nextStartId: skippedNextId,
      skipped: didAutoSkip,
      skipReason,
      timedOut: timedOutCount > 0,
      jumpStep: didAutoSkip ? 500 : 0,
    });
  } catch (err: any) {
    console.error('Batch Scan Error:', err);
    return res.status(500).json({ error: 'Failed batch scan' });
  }
});

async function startServer() {
  // Ensure any unmatched API route returns JSON instead of falling through to Vite SPA HTML
  app.all('/api/*', (req, res) => {
    return res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
  });

  // Global API error handler ensuring JSON responses
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api')) {
      console.error('Unhandled API error:', err);
      return res.status(500).json({ error: err?.message || 'Internal Server Error' });
    }
    next(err);
  });

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
