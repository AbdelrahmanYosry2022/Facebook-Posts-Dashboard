// server.cjs (converted to CommonJS requires)
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const NodeCache = require("node-cache");
const path = require('path');

const app = express();
const APP_ID = process.env.FB_APP_ID || "";
const APP_SECRET = process.env.FB_APP_SECRET || "";
app.use(cors());
app.use(express.json());

// CONFIG
const PORT = process.env.PORT || 4000;
const FB_API_VERSION = "v23.0";
// Helper to read the access token on-demand. Calling this will re-load the .env file
// so updating `fb-server/.env` does not strictly require restarting the whole process.
function getAppAccessToken({ reloadEnv = true } = {}) {
  try {
    if (reloadEnv) {
      require('dotenv').config({ path: path.resolve(__dirname, '.env') });
    }
  } catch (e) {
    // ignore
  }
  return process.env.FB_APP_TOKEN || process.env.FB_USER_LONG_LIVED_TOKEN || "";
}

// Initial warning if token missing at startup
if (!getAppAccessToken({ reloadEnv: false })) {
  console.warn("تحذير: FB token غير معرف في متغيرات البيئة (FB_APP_TOKEN أو FB_USER_LONG_LIVED_TOKEN). ضع التوكن الخاص بك في ملف .env");
}

// CACHING
const cacheTTLSeconds = Number(process.env.CACHE_TTL_SECONDS || 60 * 30); // 30 دقيقة افتراضيًا
const cache = new NodeCache({ stdTTL: cacheTTLSeconds, checkperiod: 60 });

// METRICS (in-memory) — تحسب طلبات الفيسبوك الحقيقية وعدد طلبات السيرفر
let fbRequestsCount = 0;    // عدد sub-requests فعلياً للـ FB API
let serverRequestsCount = 0; // عدد طلبات لواجهات السيرفر (من الفرونت)

// Helper: Call FB API (single GET)
async function callFbGet(path, params = {}) {
  // يزيد عدّاد الويبـ-ريكوست للـ FB
  fbRequestsCount += 1;
  const url = `https://graph.facebook.com/${FB_API_VERSION}/${path}`;
  const token = getAppAccessToken();
  const res = await axios.get(url, { params: { ...params, access_token: token } });
  return res.data;
}

// Helper: Batch call to FB (minimize HTTP calls) — increments fbRequestsCount by number of subrequests
// batchRequests: [{ method:'GET', relative_url: 'me?fields=...' }, ...]
async function callFbBatch(batchRequests = []) {
  if (!Array.isArray(batchRequests) || batchRequests.length === 0) return [];
  // each subrequest counts as one FB request for metrics
  fbRequestsCount += batchRequests.length;
  const url = `https://graph.facebook.com/${FB_API_VERSION}/`;
  const token = getAppAccessToken();
  const res = await axios.post(url, null, {
    params: {
      access_token: token,
      batch: JSON.stringify(batchRequests),
    },
  });
  return res.data; // array responses
}

/**
 * GET /posts
 * Returns last 5 posts, with reactions.summary(true) totals, and tries to include an image (full_picture or attachment)
 * Caching: stores result for cacheTTLSeconds
 */
app.get("/posts", async (req, res) => {
  serverRequestsCount += 1;
  try {
    const token = getAppAccessToken();
    if (!token) {
      return res.status(500).json({ error: "missing_token", detail: "خالي: عرّف FB_USER_LONG_LIVED_TOKEN في .env", metrics: { fbRequestsCount, serverRequestsCount } });
    }
  const pageId = (req.query.page_id || 'me').trim();
  const limitRaw = parseInt(req.query.limit, 10);
  const limit = (isNaN(limitRaw) || limitRaw <= 0) ? 5 : Math.min(limitRaw, 100);
  const after = req.query.after ? String(req.query.after) : null;
  const before = req.query.before ? String(req.query.before) : null;

  // New query options
  const startDateRaw = req.query.start_date || null; // ISO or timestamp
  const endDateRaw = req.query.end_date || null; // ISO or timestamp
  const hasImage = req.query.has_image === '1' || req.query.has_image === 'true';
  const sortBy = req.query.sort_by || null; // 'reactions' | 'comments' | 'created_time'
  const top = req.query.top === '1' || req.query.top === 'true';

    // Build field expansion with pagination modifiers
    let modifiers = `.limit(${Math.min(limit, 100)})`;
    if (after) modifiers += `.after(${after})`;
    if (before) modifiers += `.before(${before})`;
  const fieldsSpec = `posts${modifiers}{id,message,created_time,full_picture,attachments,permalink_url,reactions.summary(true),comments.summary(true).limit(0)}`;

  const cacheKey = `posts_${pageId}_${limit}_${after || ''}_${before || ''}_sd${startDateRaw || ''}_ed${endDateRaw || ''}_img${hasImage ? 1 : 0}_sort${sortBy || ''}_top${top ? 1 : 0}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ cached: true, data: cached.data, paging: cached.paging, metrics: { fbRequestsCount, serverRequestsCount } });
    }

  // Prepare params for FB request. If user provided a date range, forward since/until.
  const fbParams = { fields: fieldsSpec };
  if (startDateRaw) fbParams.since = startDateRaw;
  if (endDateRaw) fbParams.until = endDateRaw;

    // Decide whether to fetch a single page or collect across pages until we
    // have enough matching posts.
    const desiredRaw = parseInt(req.query.desired, 10);
    const desired = (!isNaN(desiredRaw) && desiredRaw > 0) ? desiredRaw : null;
    const collectMode = desired || req.query.collect === '1' || req.query.collect === 'true';

    // Helper to map FB post object to simplified shape
    const mapPost = (p) => {
      const total = p.reactions?.summary?.total_count ?? 0;
      const commentsCount = p.comments?.summary?.total_count ?? 0;
      let image = p.full_picture || null;
      if (!image) {
        try {
          const att = p.attachments?.data?.[0];
          image =
            att?.media?.image?.src ||
            att?.subattachments?.data?.[0]?.media?.image?.src ||
            att?.target?.image_url ||
            null;
        } catch (e) {
          image = null;
        }
      }
      return {
        id: p.id,
        message: p.message,
        created_time: p.created_time,
        permalink_url: p.permalink_url,
        reactions_total: total,
        comments_count: commentsCount,
        reactions_breakdown: null,
        attachment_image: image,
      };
    };

    let simplified = [];
    let finalPaging = null;
    const parseDate = (s) => {
      try { return new Date(s); } catch (e) { return null; }
    };
    const startDate = startDateRaw ? parseDate(startDateRaw) : null;
    const endDate = endDateRaw ? parseDate(endDateRaw) : null;

    if (collectMode) {
      // Paginated collection mode: fetch pages from `${pageId}/posts` until we
      // collect `desired` matching posts (or stop when pages exhausted / maxPages reached).
      const maxPages = Math.min(50, Math.max(1, parseInt(req.query.max_pages || '10', 10)));
      const perPage = Math.min(100, Math.max(25, limit));
      const fbPostsParams = {
        fields: 'id,message,created_time,full_picture,attachments,permalink_url,reactions.summary(true),comments.summary(true).limit(0)',
        limit: perPage,
      };
      if (startDateRaw) fbPostsParams.since = startDateRaw;
      if (endDateRaw) fbPostsParams.until = endDateRaw;

      let afterCursor = null;
      let pageCount = 0;
      let done = false;
      let fallbackToSingle = false;
      while (!done && pageCount < maxPages) {
        pageCount += 1;
        try {
          // Use field expansion pagination: call `GET /{pageId}?fields=posts.limit(N).after(cursor){...}`
          const fieldsForPage = `posts.limit(${perPage})${afterCursor ? `.after(${afterCursor})` : ''}{id,message,created_time,full_picture,attachments,permalink_url,reactions.summary(true),comments.summary(true).limit(0)}`;
          const pageRes = await callFbGet(pageId, { fields: fieldsForPage, since: startDateRaw || undefined, until: endDateRaw || undefined });
          const pageList = pageRes.posts?.data || [];
        // map and apply server-side filters immediately
        for (const p of pageList) {
          const mapped = mapPost(p);
          const pDate = new Date(mapped.created_time);
          if (startDateRaw && startDate && pDate < startDate) {
            // we've passed older posts than desired start; stop scanning
            done = true;
            break;
          }
          if (endDateRaw && endDate && pDate > endDate) {
            // newer than endDate — skip
            continue;
          }
          if (hasImage && !mapped.attachment_image) continue;
          simplified.push(mapped);
          if (desired && simplified.length >= desired) {
            done = true;
            break;
          }
        }
          finalPaging = pageRes.posts?.paging || null;
          afterCursor = pageRes.posts?.paging?.cursors?.after || null;
          if (!afterCursor) break;
        } catch (errPage) {
          // If the API responds with the 'New Pages Experience Is Not Supported' error,
          // fallback to a single-request approach (the earlier code path).
          const ferr = errPage.response?.data || errPage.message || {};
          if (ferr && ferr.error && ferr.error.code === 200 && ferr.error.error_subcode === 2069030) {
            fallbackToSingle = true;
            console.warn('FB pages endpoint not supported for this page, falling back to single-request mode');
            break;
          }
          throw errPage;
        }
      }
      if (fallbackToSingle) {
        const fbRes = await callFbGet(pageId, fbParams);
        const postsList = fbRes.posts?.data || [];
        simplified = postsList.map(mapPost);
        finalPaging = fbRes.posts?.paging || null;
      }
    } else {
      // single request to get posts with reactions.summary(true)
      const fbRes = await callFbGet(pageId, fbParams);
      const postsList = fbRes.posts?.data || [];
      simplified = postsList.map(mapPost);
      finalPaging = fbRes.posts?.paging || null;
    }
    // Filter by date range server-side (in case provider returned more items)
    let filtered = simplified;
    if (startDate) {
      filtered = filtered.filter((it) => new Date(it.created_time) >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((it) => new Date(it.created_time) <= endDate);
    }

    // Filter by image presence
    if (hasImage) {
      filtered = filtered.filter((it) => it.attachment_image);
    }

    // Sorting / top selection
    if (sortBy === 'reactions') {
      filtered.sort((a, b) => (b.reactions_total || 0) - (a.reactions_total || 0));
    } else if (sortBy === 'comments') {
      filtered.sort((a, b) => (b.comments_count || 0) - (a.comments_count || 0));
    } else {
      // default: newest first
      filtered.sort((a, b) => new Date(b.created_time) - new Date(a.created_time));
    }

    // If 'top' requested, return top `limit` posts by the chosen sort; otherwise take the first `limit` posts.
    const resultSlice = top ? filtered.slice(0, limit) : filtered.slice(0, Math.min(limit, filtered.length));

    // cache and return (use finalPaging collected during fetch)
    const paging = {
      cursors: {
        before: finalPaging?.cursors?.before || null,
        after: finalPaging?.cursors?.after || null,
      },
      hasNext: Boolean(finalPaging?.next),
      hasPrevious: Boolean(finalPaging?.previous),
      limit,
      pageId
    };
    cache.set(cacheKey, { data: resultSlice, paging });
    return res.json({ cached: false, data: resultSlice, paging, metrics: { fbRequestsCount, serverRequestsCount } });
  } catch (err) {
    const fbErr = err.response?.data || err.message;
    console.error("GET /posts error:", fbErr);
    // إذا انتهى التوكن (code=190)
    if (fbErr && fbErr.error && fbErr.error.code === 190) {
      return res.status(401).json({
        error: "token_expired",
        detail: fbErr.error,
        metrics: { fbRequestsCount, serverRequestsCount }
      });
    }
    // مرر الرسالة الداخلية لو وُجدت
    return res.status(500).json({
      error: "failed_fetch_posts",
      detail: fbErr,
      metrics: { fbRequestsCount, serverRequestsCount }
    });
  }
});
/**
 * GET /breakdown/:postId
 * Returns reactions breakdown for one post.
 * Uses FB batch endpoint to fetch reactions.type(X).summary(total_count) for all types in one HTTP call.
 * Counts each subrequest towards fbRequestsCount (we incremented in callFbBatch)
 */
app.get("/breakdown/:postId", async (req, res) => {
  serverRequestsCount += 1;
  const { postId } = req.params;
  if (!postId) return res.status(400).json({ error: "missing_postId" });

  const cacheKey = `breakdown_${postId}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json({ cached: true, data: cached, metrics: { fbRequestsCount, serverRequestsCount } });
  }

  try {
    // build batch requests: one sub-request per reaction type
    const reactionTypes = ["LIKE", "LOVE", "HAHA", "WOW", "SAD", "ANGRY", "CARE"];
    const batchReq = reactionTypes.map((t) => ({
      method: "GET",
      relative_url: `${postId}/reactions?type=${t}&summary=total_count&limit=0`,
    }));

    const batchRes = await callFbBatch(batchReq); // single HTTP POST, multiple subrequests counted
    // batchRes is array; each item has { code, headers, body } (body is string JSON)
    const breakdown = {};
    let total = 0;
    batchRes.forEach((item, idx) => {
      try {
        const body = JSON.parse(item.body || "{}");
        const cnt = body?.summary?.total_count ?? 0;
        breakdown[reactionTypes[idx]] = cnt;
        total += cnt;
      } catch (e) {
        breakdown[reactionTypes[idx]] = 0;
      }
    });

    const result = { breakdown, total };
    cache.set(cacheKey, result, 60 * 10); // cache breakdown 10 minutes
    return res.json({ cached: false, data: result, metrics: { fbRequestsCount, serverRequestsCount } });
  } catch (err) {
    console.error("GET /breakdown error:", err.response?.data || err.message);
    return res.status(500).json({ error: "failed_fetch_breakdown", detail: err.response?.data || err.message, metrics: { fbRequestsCount, serverRequestsCount } });
  }
});

/**
 * GET /metrics
 * Returns counters so frontend can display them
 */
app.get("/metrics", (req, res) => {
  serverRequestsCount += 1;
  return res.json({
    fbRequestsCount,
    serverRequestsCount,
    cacheStats: cache.getStats ? cache.getStats() : null,
  });
});

// DEBUG endpoints (temporary) - list cache keys and get a cache entry
app.get('/debug/cache-keys', (req, res) => {
  try {
    serverRequestsCount += 1;
    const keys = cache.keys ? cache.keys() : [];
    return res.json({ keys, count: keys.length });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

app.get('/debug/cache-get', (req, res) => {
  try {
    serverRequestsCount += 1;
    const k = req.query.key;
    if (!k) return res.status(400).json({ error: 'missing_key' });
    const v = cache.get(k);
    return res.json({ key: k, value: v });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

// GET /og-image?url=...  => fetches the page and returns an og:image URL if present
app.get('/og-image', async (req, res) => {
  serverRequestsCount += 1;
  const target = req.query.url;
  if (!target) return res.status(400).json({ error: 'missing_url' });
  try {
    const resp = await axios.get(String(target), { timeout: 7000, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OG-Proxy/1.0)' } });
    const html = resp.data;
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    let img = $('meta[property="og:image"]').attr('content') || $('meta[name="og:image"]').attr('content') || $('meta[property="twitter:image"]').attr('content') || $('link[rel="image_src"]').attr('href') || null;
    if (!img) {
      const firstImg = $('img').first().attr('src');
      img = firstImg || null;
    }
    // normalize protocol-relative and relative URLs
    if (img && img.startsWith('//')) img = 'https:' + img;
    if (img && img.startsWith('/')) {
      try {
        const base = new URL(String(target));
        img = base.origin + img;
      } catch (e) {
        // leave as-is
      }
    }
    return res.json({ image: img });
  } catch (e) {
    console.error('GET /og-image error:', e.message || e);
    // return 200 with image:null to avoid noisy 404s on client
    return res.json({ image: null });
  }
});

/**
 * POST /invalidate-cache  (optional) => clear cache
 */
app.post("/invalidate-cache", (req, res) => {
  serverRequestsCount += 1;
  cache.flushAll();

  return res.json({ ok: true });
});

// Endpoint: /auth/status
app.get("/auth/status", async (req, res) => {
  try {
    // reload .env and tokens
    require('dotenv').config({ path: path.resolve(__dirname, '.env') });
    const token = getAppAccessToken({ reloadEnv: false }) || '';
    const appId = process.env.FB_APP_ID || APP_ID || '';
    const appSecret = process.env.FB_APP_SECRET || APP_SECRET || '';
    if (!token || !appId || !appSecret) {
      return res.status(400).json({ error: "missing_token_or_app_keys" });
    }
    const url = `https://graph.facebook.com/debug_token?input_token=${token}&access_token=${appId}|${appSecret}`;
    const resp = await axios.get(url);
    const d = resp.data.data;
    return res.json({
      valid: d.is_valid,
      expires_at: d.expires_at,
      expires_at_iso: d.expires_at ? new Date(d.expires_at * 1000).toISOString() : null,
      seconds_remaining: d.expires_at ? d.expires_at - Math.floor(Date.now()/1000) : null,
      scopes: d.scopes,
      type: d.type,
      user_id: d.user_id,
      error: d.error || null
    });
  } catch (err) {
    return res.status(500).json({ error: "failed_debug_token", detail: err.response?.data || err.message });
  }
});
// Log registered simple routes on startup
console.log('Registered routes: /posts, /breakdown/:postId, /metrics, /invalidate-cache, /auth/status');

app.listen(PORT, () => {
  console.log(`FB proxy + cache server running on port ${PORT} (cache TTL ${cacheTTLSeconds}s)`);
});
