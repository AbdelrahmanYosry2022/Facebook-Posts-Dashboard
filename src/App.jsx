// src/App.jsx
import { useEffect, useRef, useState } from "react";
import "./index.css";

/**
 * App.jsx - كامل ومحدث بالـ caching لتفادي حدود طلبات فيسبوك
 *
 * ميزات:
 * - Cache محلي في localStorage (افتراضي 30 دقيقة) لتقليل طلبات API
 * - fetchPosts: طلب واحد يجلب آخر 5 منشورات مع reactions.summary(true)
 * - fetchBreakdown(postId): يجلب breakdown لأنواع التفاعل **عند الطلب** (زر "عرض تفاصيل التفاعلات")
 * - يستخدم OG proxy (اختياري) لو حابب تجيب og:image من روابط البوست (تأكد من تشغيل البروكسي إذا أردت)
 * - واجهة محسنة مع أزرار تحميل، تحديث الآن، Auto-refresh قابلة للتعديل
 *
 * تذكير أمني: ضَع التوكن في .env.local كـ VITE_FB_ACCESS_TOKEN ولا تشاركه.
 */

/* ====== إعدادات ====== */
const REACTION_TYPES = ["LIKE", "LOVE", "HAHA", "WOW", "SAD", "ANGRY", "CARE"];
const REACTION_EMOJI = { LIKE: "👍", LOVE: "❤️", HAHA: "😂", WOW: "😮", SAD: "😢", ANGRY: "😡", CARE: "🤗" };

const CACHE_KEY = "fb_posts_cache_v1";
const CACHE_TTL_MINUTES = 30; // مدة صلاحية الكاش بالدقايق (غيرها لو عايز)
const OG_PROXY = "http://localhost:4000"; // غيّره لو البروكسي على بورت آخر أو تعطّله لو مش مستخدم
const METRICS_AUTO_KEY = "fb_metrics_auto";
const METRICS_INTERVAL_KEY = "fb_metrics_interval";

/* ====== Helpers للكاش ====== */
const makeCacheKey = (params = {}) => {
  try {
    const sp = new URLSearchParams();
    Object.keys(params).sort().forEach((k) => {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') sp.append(k, String(params[k]));
    });
    const suffix = sp.toString();
    return suffix ? `${CACHE_KEY}:${suffix}` : CACHE_KEY;
  } catch (e) {
    return CACHE_KEY;
  }
};

const readCache = (storageKey = CACHE_KEY) => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj.timestamp || !obj.data) return null;
    const ageMin = (Date.now() - obj.timestamp) / 1000 / 60;
    if (ageMin > CACHE_TTL_MINUTES) {
      localStorage.removeItem(storageKey);
      return null;
    }
    return obj.data;
  } catch (e) {
    console.warn("cache read err", e);
    return null;
  }
};

const writeCache = (storageKey = CACHE_KEY, data) => {
  try {
    const obj = { timestamp: Date.now(), data };
    localStorage.setItem(storageKey, JSON.stringify(obj));
  } catch (e) {
    console.warn("cache write err", e);
  }
};

/* ====== Component ====== */
function niceDate(dt) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt || "-";
  }
}

export default function App() {
  const [posts, setPosts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState(null); // { fbRequestsCount, serverRequestsCount }
  const [lastPostsCacheHit, setLastPostsCacheHit] = useState(null); // true | false | null
  const [lastUpdated, setLastUpdated] = useState(null); // timestamp (ms)
  const [metricsAutoRefresh, setMetricsAutoRefresh] = useState(false);
  const [metricsIntervalSec, setMetricsIntervalSec] = useState(30);
  const metricsIntervalRef = useRef(null);
  const [invalidating, setInvalidating] = useState(false);
  const [toast, setToast] = useState(null); // { msg, ts }
  const [minReactions, setMinReactions] = useState('');
  const [minComments, setMinComments] = useState('');
  const [hasImage, setHasImage] = useState('any'); // any | yes | no
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // New controls for server-driven fetching
  const [collectMode, setCollectMode] = useState(false);
  const [desiredCount, setDesiredCount] = useState('');
  const [maxPages, setMaxPages] = useState(10);
  const [serverSortBy, setServerSortBy] = useState(''); // reactions | comments | created_time
  const [serverTop, setServerTop] = useState(false);
  const [sortKey, setSortKey] = useState('created_desc'); // created_desc | created_asc | reactions_desc | reactions_asc | comments_desc | comments_asc

  const [breakdownLoading, setBreakdownLoading] = useState({}); // { postId: boolean }
  const [countdown, setCountdown] = useState(null); // ثواني متبقية للتحديث التلقائي
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(60); // افتراضي أطول لتقليل النداءات
  const intervalRef = useRef(null);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

  useEffect(() => {
    if (autoRefresh) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const ms = Math.max(1, Number(intervalMinutes)) * 60 * 1000;
      setCountdown(Math.floor(ms / 1000));
      intervalRef.current = setInterval(() => fetchPosts({ force: false }), ms);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setCountdown(null);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, intervalMinutes]);

  // countdown ticker
  useEffect(() => {
    if (!autoRefresh || countdown === null) return;
    if (countdown <= 0) return; // سيتم إعادة ضبطه عند تنفيذ fetchPosts بالدورة
    const t = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [countdown, autoRefresh]);

  // تحميل تفضيلات الـ metrics
  useEffect(() => {
    try {
      const autoPref = localStorage.getItem(METRICS_AUTO_KEY);
      if (autoPref === 'true') setMetricsAutoRefresh(true);
      const intervalPref = localStorage.getItem(METRICS_INTERVAL_KEY);
      if (intervalPref && !isNaN(Number(intervalPref))) setMetricsIntervalSec(Number(intervalPref));
    } catch { /* ignore */ }
  }, []);

  /* ------ دالة جلب عدد التفاعل لنوع واحد (تُستخدم فقط في fetchBreakdown) ------ */
  // لم نعد نستخدمها بعد الانتقال للباكإند (breakdown سيتم عبر /breakdown)
  const fetchReactionCount = async () => 0;

  /* ------ دالة OG proxy لجلب og:image من رابط (اختياري) ------ */
  const fetchOgImage = async (link) => {
    if (!link) return null;
    try {
      const res = await fetch(`${OG_PROXY}/og-image?url=${encodeURIComponent(link)}`);
      if (!res.ok) return null;
      const j = await res.json();
      return j.image || null;
    } catch {
      return null;
    }
  };

  /* ====== fetchPosts مع قراءة/كتابة الكاش ======
     options: { force: boolean } -> لو force=true يتجاهل الكاش ويعمل fetch جديد
  */
  const fetchPosts = async (options = { force: false }) => {
    setLoading(true);
    setError(null);

    try {
      // Build params to send to server according to controls
      const params = {};
      if (dateFrom) params.start_date = dateFrom;
      if (dateTo) params.end_date = dateTo;
      if (hasImage === 'yes') params.has_image = true;
      if (hasImage === 'no') params.has_image = false;
      if (serverSortBy) params.sort_by = serverSortBy;
      if (serverTop) params.top = true;
      if (collectMode) params.collect = true;
      if (desiredCount) params.desired = Number(desiredCount);
      if (maxPages) params.max_pages = Number(maxPages);
      params.limit = options.limit || 5;

      const cacheKey = makeCacheKey(params);

      // استخدم الكاش ما لم يُطلب الإلغاء بالقوة
      if (!options.force) {
        const cached = readCache(cacheKey);
        if (cached) {
          setPosts(cached);
          setLoading(false);
          setLastPostsCacheHit(true);
          return;
        }
      }

      const url = new URL(`${API_BASE}/posts`);
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined) url.searchParams.set(k, v); });
      const res = await fetch(url.toString());
      const data = await res.json();
      if (!res.ok || data.error) {
        let msg = data.error || "خطأ في استدعاء /posts";
        if (data.detail) {
          if (typeof data.detail === 'string') msg += `: ${data.detail}`;
          else if (data.detail.error && data.detail.error.message) msg += `: ${data.detail.error.message}`;
        }
        throw new Error(msg);
      }
  const postsList = data.data || [];
      // If server claims cached but returned an empty array, treat as cache miss and retry once
      if (data.cached && Array.isArray(postsList) && postsList.length === 0 && !options.force) {
        // retry with force
        console.warn('Cached empty response detected, retrying with force=true');
        return fetchPosts({ ...options, force: true });
      }
    setMetrics(data.metrics || null);
    setLastPostsCacheHit(!!data.cached);
  setLastUpdated(Date.now());
      if (autoRefresh) {
        // reset countdown
        const ms = Math.max(1, Number(intervalMinutes)) * 60 * 1000;
        setCountdown(Math.floor(ms / 1000));
      }

      // تبسيط البينات وحفظ reactions_total (الـ breakdown يتم طلبه عند الحاجة)
      const simplified = await Promise.all(
        postsList.map(async (p) => {
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
          // لو مفيش صورة جرب OG proxy على permalink_url (اختياري، بعمل طلب خارجي لذلك قد يكون بطيئًا)
          if (!image && p.permalink_url) {
            try {
              const og = await fetchOgImage(p.permalink_url);
              if (og) image = og;
            } catch {
              /* ignore */
            }
          }

          return {
            id: p.id,
            message: p.message,
            created_time: p.created_time,
            permalink_url: p.permalink_url,
            reactions_total: p.reactions?.summary?.total_count ?? 0,
            reactions_breakdown: null,
            attachment_image: image,
          };
        })
      );

  // خزّن في الكاش حسب الـ query ثم عرِّض
  writeCache(cacheKey, simplified);
  setPosts(simplified);
    } catch (err) {
      console.error(err);
      setError(err.message || "حصل خطأ");
    } finally {
      setLoading(false);
    }
  };

  /* ====== fetchBreakdown: يحسب أنواع التفاعلات لبوست واحد عند الطلب ====== */
  const fetchBreakdown = async (postId) => {
    if (!posts) return;
    const target = posts.find((p) => p.id === postId);
    if (!target) return;
    if (target.reactions_breakdown) {
      // لو موجود بالفعل نخفيه كبديل (toggle)
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, reactions_breakdown: null } : p)));
      return;
    }

    try {
      setBreakdownLoading((s) => ({ ...s, [postId]: true }));
  const res = await fetch(`${API_BASE}/breakdown/${postId}`);
  const data = await res.json();
  if (data.error) throw new Error("فشل جلب breakdown");
  const breakdown = data.data?.breakdown || {};
  if (data.metrics) setMetrics(data.metrics);
  setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, reactions_breakdown: breakdown } : p)));
  return breakdown;
    } catch (e) {
      console.error("breakdown err", e);
      setError("فشل جلب تفاصيل التفاعلات");
    } finally {
      setBreakdownLoading((s) => ({ ...s, [postId]: false }));
    }
  };

  const fetchMetrics = async () => {
    try {
      const res = await fetch(`${API_BASE}/metrics`);
      const data = await res.json();
      if (res.ok) setMetrics(data);
    } catch (e) { /* تجاهل أخطاء metrics */ }
  };

  // Auto refresh metrics interval management
  useEffect(() => {
    if (metricsAutoRefresh) {
      if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current);
      metricsIntervalRef.current = setInterval(fetchMetrics, Math.max(5, Number(metricsIntervalSec)) * 1000);
      fetchMetrics();
    } else {
      if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current);
      metricsIntervalRef.current = null;
    }
    try {
      localStorage.setItem(METRICS_AUTO_KEY, metricsAutoRefresh ? 'true' : 'false');
      localStorage.setItem(METRICS_INTERVAL_KEY, String(metricsIntervalSec));
    } catch { /* ignore */ }
    return () => { if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricsAutoRefresh, metricsIntervalSec]);

  const invalidateCache = async () => {
    try {
      setInvalidating(true);
      const res = await fetch(`${API_BASE}/invalidate-cache`, { method: 'POST' });
      if (!res.ok) throw new Error('invalidate failed');
      localStorage.removeItem(CACHE_KEY);
      setLastPostsCacheHit(null);
      setPosts(null);
      setMetrics((m) => m);
      setToast({ msg: 'تم تفريغ الكاش بنجاح', ts: Date.now() });
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setError('فشل تفريغ الكاش');
      setToast({ msg: 'فشل تفريغ الكاش', ts: Date.now() });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setInvalidating(false);
    }
  };

  const totalAll = (posts || []).reduce((s, p) => s + (p.reactions_total || 0), 0);

  // derive filtered + sorted posts
  const processedPosts = (posts || [])
    .filter(p => {
      if (hasImage === 'yes' && !p.attachment_image) return false;
      if (hasImage === 'no' && p.attachment_image) return false;
      if (minReactions && p.reactions_total < Number(minReactions)) return false;
      if (minComments && (p.comments_count || 0) < Number(minComments)) return false;
      if (dateFrom) {
        const fromTs = new Date(dateFrom).getTime();
        if (new Date(p.created_time).getTime() < fromTs) return false;
      }
      if (dateTo) {
        const toTs = new Date(dateTo).getTime();
        if (new Date(p.created_time).getTime() > (toTs + 86399999)) return false; // include whole day
      }
      return true;
    })
    .sort((a,b) => {
      switch (sortKey) {
        case 'created_asc': return new Date(a.created_time) - new Date(b.created_time);
        case 'created_desc': return new Date(b.created_time) - new Date(a.created_time);
        case 'reactions_asc': return (a.reactions_total||0) - (b.reactions_total||0);
        case 'reactions_desc': return (b.reactions_total||0) - (a.reactions_total||0);
        case 'comments_asc': return (a.comments_count||0) - (b.comments_count||0);
        case 'comments_desc': return (b.comments_count||0) - (a.comments_count||0);
        default: return 0;
      }
    });

  return (
    <div className="container">
      <header className="header">
        <div>
          <h1>لوحة بوستات فيسبوك</h1>
          <p className="subtitle">استرجاع منشورات مع خيارات نطاق تاريخي، صور، وترتيب (يمكن جمع عبر صفحات)</p>
        </div>

        <div className="controls">
          <button
            className="btn primary"
            onClick={() => fetchPosts({ force: true })}
            disabled={loading}
            title="جلب آخر المنشورات وتجاهل الكاش"
          >
            {loading ? <span className="spinner" /> : "تحميل البوستات"}
          </button>

          <div className="auto-wrap" style={{ marginLeft: 8 }}>
            <label className="auto-label">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} /> Auto-refresh
            </label>
            <input
              className="small-input"
              type="number"
              min="1"
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(e.target.value)}
              title="المدة بالدقائق (يفضل >= 15 لتفادي حدود الطلبات)"
            />
            <button
              className="btn"
              onClick={() => fetchPosts({ force: true })}
              title="تحديث الآن (يتجاهل الكاش)"
              style={{ marginLeft: 6 }}
            >
              تحديث الآن
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 12 }}>
            <label>Start: <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
            <label>End: <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
            <label>
              Has image:
              <select value={hasImage} onChange={(e) => setHasImage(e.target.value)}>
                <option value="any">Any</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
            <label>
              Collect mode:
              <input type="checkbox" checked={collectMode} onChange={(e) => setCollectMode(e.target.checked)} />
            </label>
            <label>Desired: <input type="number" min="1" value={desiredCount} onChange={(e) => setDesiredCount(e.target.value)} style={{width:80}}/></label>
            <label>Max pages: <input type="number" min="1" value={maxPages} onChange={(e) => setMaxPages(e.target.value)} style={{width:80}}/></label>
            <label>
              Server sort:
              <select value={serverSortBy} onChange={(e) => setServerSortBy(e.target.value)}>
                <option value="">(none)</option>
                <option value="reactions">Reactions</option>
                <option value="comments">Comments</option>
                <option value="created_time">Created Time</option>
              </select>
            </label>
            <label>Top: <input type="checkbox" checked={serverTop} onChange={(e) => setServerTop(e.target.checked)} /></label>
          </div>

          <div className="summary" style={{ marginLeft: "auto" }}>
            <div>مجموع التفاعلات: <strong>{totalAll}</strong></div>
          </div>
        </div>

        {autoRefresh && countdown !== null && (
          <div className="metrics-bar" style={{marginTop:10}}>
            <div className="metric-chip" title="الوقت المتبقي للتحديث التلقائي">
              التحديث التلقائي بعد: <strong>{countdown}s</strong>
            </div>
          </div>
        )}
      </header>

      {metrics && (
        <div className="metrics-bar">
          <div className="metric-chip" title="إجمالي عدد النداءات الفرعية فعلياً نحو فيسبوك">
            FB API: <strong>{metrics.fbRequestsCount}</strong>
          </div>
          <div className="metric-chip" title="عدد طلبات الواجهة نحو السيرفر">
            Server Calls: <strong>{metrics.serverRequestsCount}</strong>
          </div>
          {lastPostsCacheHit !== null && (
            <div className="metric-chip" title="حالة آخر جلب للبوستات من الكاش أو من فيسبوك">
              Posts Fetch: {lastPostsCacheHit ? <span style={{color:'#059669'}}>Cache Hit</span> : <span style={{color:'#dc2626'}}>Miss</span>}
            </div>
          )}
          {lastUpdated && (
            <div className="metric-chip" title="آخر وقت تم فيه تحديث قائمة البوستات">
              آخر تحديث: {new Date(lastUpdated).toLocaleTimeString()}
            </div>
          )}
          <div className="metric-chip" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={metricsAutoRefresh} onChange={(e) => setMetricsAutoRefresh(e.target.checked)} />
              <span style={{ fontSize: 11 }}>Auto Metrics</span>
            </label>
            <input
              type="number"
              className="metrics-input"
              min={5}
              value={metricsIntervalSec}
              onChange={(e) => setMetricsIntervalSec(e.target.value)}
              title="عدد الثواني بين كل تحديث للـ metrics"
            />
          </div>
          <button className="btn danger" style={{ padding: '6px 10px' }} onClick={invalidateCache} title="تفريغ كاش السيرفر + المتصفح" disabled={invalidating}>
            {invalidating ? '...جارٍ التفريغ' : 'تفريغ الكاش'}
          </button>
        </div>
      )}

      {error && <div className="error">خطأ: {error}</div>}

      {!posts && !loading && <div className="empty">اضغط "تحميل البوستات" لعرض النتائج (سيتم استخدام الكاش إذا كانت البيانات حديثة).</div>}

      <div className="filters-panel" style={{margin:'10px 0 18px',display:'flex',flexWrap:'wrap',gap:10,alignItems:'flex-end'}}>
        <div className="metric-chip" style={{display:'flex',flexDirection:'column',gap:4}}>
          <label style={{fontSize:11}}>Has Image</label>
          <select value={hasImage} onChange={e=>setHasImage(e.target.value)} style={{padding:'4px 6px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:12}}>
            <option value="any">Any</option>
            <option value="yes">With Image</option>
            <option value="no">Without Image</option>
          </select>
        </div>
        <div className="metric-chip" style={{display:'flex',flexDirection:'column',gap:4}}>
          <label style={{fontSize:11}}>Min Reactions</label>
          <input type="number" value={minReactions} onChange={e=>setMinReactions(e.target.value)} style={{padding:'4px 6px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:12,width:90}} />
        </div>
        <div className="metric-chip" style={{display:'flex',flexDirection:'column',gap:4}}>
          <label style={{fontSize:11}}>Min Comments</label>
          <input type="number" value={minComments} onChange={e=>setMinComments(e.target.value)} style={{padding:'4px 6px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:12,width:90}} />
        </div>
        <div className="metric-chip" style={{display:'flex',flexDirection:'column',gap:4}}>
          <label style={{fontSize:11}}>From (date)</label>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{padding:'4px 6px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:12}} />
        </div>
        <div className="metric-chip" style={{display:'flex',flexDirection:'column',gap:4}}>
          <label style={{fontSize:11}}>To (date)</label>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{padding:'4px 6px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:12}} />
        </div>
        <div className="metric-chip" style={{display:'flex',flexDirection:'column',gap:4}}>
          <label style={{fontSize:11}}>Sort</label>
          <select value={sortKey} onChange={e=>setSortKey(e.target.value)} style={{padding:'4px 6px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:12}}>
            <option value="created_desc">Newest</option>
            <option value="created_asc">Oldest</option>
            <option value="reactions_desc">Most Reactions</option>
            <option value="reactions_asc">Least Reactions</option>
            <option value="comments_desc">Most Comments</option>
            <option value="comments_asc">Least Comments</option>
          </select>
        </div>
        <button className="btn" onClick={()=>{setMinReactions('');setMinComments('');setHasImage('any');setDateFrom('');setDateTo('');setSortKey('created_desc')}}>Reset</button>
      </div>

      <main className="grid">
        {processedPosts && processedPosts.map((p) => (
          <article className="card" key={p.id}>
            <div className="media">
              {p.attachment_image ? (
                <img src={p.attachment_image} alt="attachment" className="post-image" />
              ) : (
                <div className="no-image">No image</div>
              )}
            </div>

            <div className="card-body">
              <div className="meta">
                <div className="date">{niceDate(p.created_time)}</div>
                <div className="total" title="Reactions">{p.reactions_total}</div>
              </div>

              <div className="message">{p.message ? p.message : <i>بدون نص</i>}</div>

              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  className="btn"
                  onClick={() => fetchBreakdown(p.id)}
                  disabled={breakdownLoading[p.id]}
                >
                  {breakdownLoading[p.id] ? "جارٍ التحميل..." : (p.reactions_breakdown ? "إخفاء التفاصيل" : "عرض تفاصيل التفاعلات")}
                </button>

                {p.permalink_url && (
                  <a className="btn" style={{ textDecoration: "none" }} href={p.permalink_url} target="_blank" rel="noreferrer">فتح البوست على فيسبوك</a>
                )}
              </div>

              {p.reactions_breakdown && (
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Object.entries(p.reactions_breakdown).map(([k, v]) => (
                    <div key={k} className="reaction-chip" title={k}>
                      <span className="emoji">{REACTION_EMOJI[k] || "•"}</span>
                      <span style={{ marginLeft: 6 }}>{k}: <strong>{v}</strong></span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 4, fontSize: 11, color: "#6b7280" }}>التعليقات: {p.comments_count ?? 0}</div>
              <div style={{ marginTop: 2, fontSize: 11, color: "#9ca3af" }}>id: {p.id}</div>
            </div>
          </article>
        ))}
      </main>



      <footer className="footer">
        <small>
          ملاحظة: التطبيق الآن يعتمد الكاش لتقليل عدد الطلبات. لو احتجت أن أرفع آلية التخزين أو أنقل الطلبات لسيرفر مركزي (server-side) مع Redis أو قاعدة بيانات للتخزين المؤقت، أقدر أعمل لك السيرفر ده.
        </small>
      </footer>
      {toast && (<div className="toast" role="status">{toast.msg}</div>)}
    </div>
  );
}
