import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './FacebookPostsPage.css';

// Facebook reaction types and emojis
const REACTION_TYPES = {
  LIKE: '👍',
  LOVE: '❤️',
  HAHA: '😆',
  WOW: '😮',
  SAD: '😢',
  ANGRY: '😡'
};

// Cache settings
const CACHE_KEY = 'fb-posts-cache';
const CACHE_TTL_MINUTES = 30;

// Optional OG proxy (set to null to disable)
const OG_PROXY = null; // 'https://api.allorigins.win/get?url=';

const FacebookPostsPage = () => {
  const navigate = useNavigate();
  
  // State variables
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [metrics, setMetrics] = useState(null);
  const [lastPostsCacheHit, setLastPostsCacheHit] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [metricsAutoRefresh, setMetricsAutoRefresh] = useState(false);
  const [metricsIntervalSec, setMetricsIntervalSec] = useState(10);
  const [invalidating, setInvalidating] = useState(false);
  const [toast, setToast] = useState('');
  
  // Filter states
  const [minReactions, setMinReactions] = useState('');
  const [minComments, setMinComments] = useState('');
  const [hasImage, setHasImage] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Collection mode states
  const [collectMode, setCollectMode] = useState(false);
  const [desiredCount, setDesiredCount] = useState(50);
  const [maxPages, setMaxPages] = useState(5);
  const [serverSortBy, setServerSortBy] = useState('');
  const [serverTop, setServerTop] = useState('');
  
  // UI states
  const [sortKey, setSortKey] = useState('created_time');
  const [breakdownLoading, setBreakdownLoading] = useState({});
  const [countdown, setCountdown] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
  
  // Cache helper functions
  const makeCacheKey = (params) => {
    const sortedParams = Object.keys(params).sort().reduce((result, key) => {
      result[key] = params[key];
      return result;
    }, {});
    return `${CACHE_KEY}-${JSON.stringify(sortedParams)}`;
  };
  
  const readCache = (key) => {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      
      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      const age = (now - timestamp) / 1000 / 60; // minutes
      
      if (age > CACHE_TTL_MINUTES) {
        localStorage.removeItem(key);
        return null;
      }
      
      return data;
    } catch (e) {
      return null;
    }
  };
  
  const writeCache = (key, data) => {
    try {
      const cacheEntry = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(cacheEntry));
    } catch (e) {
      console.warn('Failed to write cache:', e);
    }
  };
  
  const niceDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Auto-refresh logic
  useEffect(() => {
    let interval;
    if (autoRefresh && intervalMinutes > 0) {
      interval = setInterval(() => {
        fetchPosts();
      }, intervalMinutes * 60 * 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, intervalMinutes]);
  
  // Countdown ticker
  useEffect(() => {
    let ticker;
    if (autoRefresh && countdown > 0) {
      ticker = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => {
      if (ticker) clearInterval(ticker);
    };
  }, [autoRefresh, countdown]);
  
  // Load preferences from localStorage
  useEffect(() => {
    const savedMetricsAutoRefresh = localStorage.getItem('metricsAutoRefresh');
    const savedMetricsInterval = localStorage.getItem('metricsIntervalSec');
    const savedAutoRefresh = localStorage.getItem('autoRefresh');
    const savedIntervalMinutes = localStorage.getItem('intervalMinutes');
    
    if (savedMetricsAutoRefresh) setMetricsAutoRefresh(JSON.parse(savedMetricsAutoRefresh));
    if (savedMetricsInterval) setMetricsIntervalSec(parseInt(savedMetricsInterval));
    if (savedAutoRefresh) setAutoRefresh(JSON.parse(savedAutoRefresh));
    if (savedIntervalMinutes) setIntervalMinutes(parseInt(savedIntervalMinutes));
  }, []);
  
  const fetchOgImage = async (url) => {
    if (!OG_PROXY) return null;
    
    try {
      const proxyUrl = `${OG_PROXY}${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      const data = await response.json();
      const html = data.contents;
      
      const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["'][^>]*>/i);
      if (ogImageMatch) {
        return ogImageMatch[1];
      }
      
      const twitterImageMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']*)["'][^>]*>/i);
      if (twitterImageMatch) {
        return twitterImageMatch[1];
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to fetch OG image:', error);
      return null;
    }
  };
  
  const fetchPosts = async () => {
    setLoading(true);
    setError('');
    
    try {
      const params = {
        limit: collectMode ? desiredCount : 25,
        ...(minReactions && { min_reactions: minReactions }),
        ...(minComments && { min_comments: minComments }),
        ...(hasImage && { has_image: hasImage }),
        ...(dateFrom && { start_date: dateFrom }),
        ...(dateTo && { end_date: dateTo }),
        ...(collectMode && { collect: 'true' }),
        ...(collectMode && maxPages && { max_pages: maxPages }),
        ...(serverSortBy && { sort_by: serverSortBy }),
        ...(serverTop && { top: serverTop })
      };
      
      const cacheKey = makeCacheKey(params);
      const cachedData = readCache(cacheKey);
      
      if (cachedData) {
        console.log('Using cached data');
        setPosts(cachedData);
        setLastPostsCacheHit(true);
        setLastUpdated(new Date().toISOString());
        setCountdown(intervalMinutes * 60);
        return;
      }
      
      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`${API_BASE}/posts?${queryString}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Process posts to extract images and add OG images if needed
      const processedPosts = await Promise.all(data.posts.map(async (post) => {
        let imageUrl = null;
        
        // Try to get image from attachments
        if (post.attachments && post.attachments.data && post.attachments.data.length > 0) {
          const attachment = post.attachments.data[0];
          if (attachment.type === 'photo' && attachment.media && attachment.media.image) {
            imageUrl = attachment.media.image.src;
          } else if (attachment.subattachments && attachment.subattachments.data && attachment.subattachments.data.length > 0) {
            const subAttachment = attachment.subattachments.data[0];
            if (subAttachment.type === 'photo' && subAttachment.media && subAttachment.media.image) {
              imageUrl = subAttachment.media.image.src;
            }
          }
        }
        
        // If no image found and OG proxy is enabled, try to extract from links
        if (!imageUrl && OG_PROXY && post.message) {
          const urlRegex = /(https?:\/\/[^\s]+)/g;
          const urls = post.message.match(urlRegex);
          if (urls && urls.length > 0) {
            imageUrl = await fetchOgImage(urls[0]);
          }
        }
        
        return {
          ...post,
          imageUrl,
          totalReactions: post.reactions ? post.reactions.summary.total_count : 0,
          totalComments: post.comments ? post.comments.summary.total_count : 0
        };
      }));
      
      setPosts(processedPosts);
      setLastPostsCacheHit(false);
      setLastUpdated(new Date().toISOString());
      setCountdown(intervalMinutes * 60);
      
      // Cache the processed data
      writeCache(cacheKey, processedPosts);
      
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchBreakdown = async (postId) => {
    setBreakdownLoading(prev => ({ ...prev, [postId]: true }));
    
    try {
      const response = await fetch(`${API_BASE}/breakdown/${postId}`);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Update the post with breakdown data
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? { ...post, reactionBreakdown: data.breakdown }
            : post
        )
      );
      
    } catch (err) {
      console.error('Error fetching breakdown:', err);
      setError(`Failed to fetch breakdown: ${err.message}`);
    } finally {
      setBreakdownLoading(prev => ({ ...prev, [postId]: false }));
    }
  };
  
  const fetchMetrics = async () => {
    try {
      const response = await fetch(`${API_BASE}/metrics`);
      const data = await response.json();
      setMetrics(data);
    } catch (err) {
      console.error('Error fetching metrics:', err);
    }
  };
  
  // Auto-refresh metrics
  useEffect(() => {
    let interval;
    if (metricsAutoRefresh && metricsIntervalSec > 0) {
      fetchMetrics(); // Initial fetch
      interval = setInterval(fetchMetrics, metricsIntervalSec * 1000);
    }
    
    // Save preferences
    localStorage.setItem('metricsAutoRefresh', JSON.stringify(metricsAutoRefresh));
    localStorage.setItem('metricsIntervalSec', metricsIntervalSec.toString());
    localStorage.setItem('autoRefresh', JSON.stringify(autoRefresh));
    localStorage.setItem('intervalMinutes', intervalMinutes.toString());
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [metricsAutoRefresh, metricsIntervalSec, autoRefresh, intervalMinutes]);
  
  const invalidateCache = async () => {
    setInvalidating(true);
    
    try {
      // Clear browser cache
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(CACHE_KEY)) {
          localStorage.removeItem(key);
        }
      });
      
      // Clear server cache
      await fetch(`${API_BASE}/invalidate-cache`, { method: 'POST' });
      
      setToast('Cache cleared successfully!');
      setTimeout(() => setToast(''), 3000);
      
    } catch (err) {
      console.error('Error invalidating cache:', err);
      setToast('Failed to clear server cache');
      setTimeout(() => setToast(''), 3000);
    } finally {
      setInvalidating(false);
    }
  };
  
  // Process and filter posts
  const processedPosts = posts
    .filter(post => {
      if (hasImage === 'true' && !post.imageUrl) return false;
      if (hasImage === 'false' && post.imageUrl) return false;
      if (minReactions && post.totalReactions < parseInt(minReactions)) return false;
      if (minComments && post.totalComments < parseInt(minComments)) return false;
      
      if (dateFrom || dateTo) {
        const postDate = new Date(post.created_time);
        if (dateFrom && postDate < new Date(dateFrom)) return false;
        if (dateTo && postDate > new Date(dateTo + 'T23:59:59')) return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      switch (sortKey) {
        case 'created_time':
          return new Date(b.created_time) - new Date(a.created_time);
        case 'reactions':
          return b.totalReactions - a.totalReactions;
        case 'comments':
          return b.totalComments - a.totalComments;
        default:
          return 0;
      }
    });
  
  const totalReactions = processedPosts.reduce((sum, post) => sum + post.totalReactions, 0);
  
  return (
    <div className="facebook-posts-page">
      {/* Header with back button */}
      <div className="page-header">
        <button 
          className="back-button"
          onClick={() => navigate('/')}
        >
          ← Back to Home
        </button>
        <h1>Facebook Posts Dashboard</h1>
      </div>

      {/* Controls */}
      <div className="controls">
        <div className="control-group">
          <button 
            onClick={fetchPosts} 
            disabled={loading}
            className="fetch-button"
          >
            {loading ? 'Loading...' : 'Fetch Posts'}
          </button>
          
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh every
            <input
              type="number"
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(parseInt(e.target.value) || 1)}
              min="1"
              max="60"
              className="interval-input"
            />
            minutes {countdown > 0 && `(${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, '0')})`}
          </label>
        </div>
        
        {/* Date range filters */}
        <div className="control-group">
          <label>
            From:
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label>
            To:
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
        </div>
        
        {/* Image filter */}
        <div className="control-group">
          <label>
            Has Image:
            <select value={hasImage} onChange={(e) => setHasImage(e.target.value)}>
              <option value="">Any</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
        </div>
        
        {/* Collection mode */}
        <div className="control-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={collectMode}
              onChange={(e) => setCollectMode(e.target.checked)}
            />
            Collection Mode
          </label>
          
          {collectMode && (
            <>
              <label>
                Desired Count:
                <input
                  type="number"
                  value={desiredCount}
                  onChange={(e) => setDesiredCount(parseInt(e.target.value) || 50)}
                  min="1"
                  max="1000"
                />
              </label>
              <label>
                Max Pages:
                <input
                  type="number"
                  value={maxPages}
                  onChange={(e) => setMaxPages(parseInt(e.target.value) || 5)}
                  min="1"
                  max="20"
                />
              </label>
            </>
          )}
        </div>
        
        {/* Server-side sorting */}
        <div className="control-group">
          <label>
            Server Sort By:
            <select value={serverSortBy} onChange={(e) => setServerSortBy(e.target.value)}>
              <option value="">Default</option>
              <option value="reactions">Reactions</option>
              <option value="comments">Comments</option>
              <option value="created_time">Created Time</option>
            </select>
          </label>
          
          {serverSortBy && (
            <label>
              Top:
              <input
                type="number"
                value={serverTop}
                onChange={(e) => setServerTop(e.target.value)}
                placeholder="e.g., 10"
                min="1"
              />
            </label>
          )}
        </div>
        
        <div className="summary">
          Total reactions: <strong>{totalReactions.toLocaleString()}</strong>
        </div>
      </div>
      
      {/* Metrics */}
      {metrics && (
        <div className="metrics">
          <h3>Metrics</h3>
          <div className="metrics-grid">
            <div>FB API Calls: {metrics.fbApiCalls}</div>
            <div>Server Calls: {metrics.serverCalls}</div>
            <div>Cache Hit: {lastPostsCacheHit ? '✅' : '❌'}</div>
            <div>Last Updated: {lastUpdated ? niceDate(lastUpdated) : 'Never'}</div>
          </div>
          
          <div className="metrics-controls">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={metricsAutoRefresh}
                onChange={(e) => setMetricsAutoRefresh(e.target.checked)}
              />
              Auto-refresh metrics every
              <input
                type="number"
                value={metricsIntervalSec}
                onChange={(e) => setMetricsIntervalSec(parseInt(e.target.value) || 10)}
                min="1"
                max="300"
                className="interval-input"
              />
              seconds
            </label>
            
            <button 
              onClick={invalidateCache} 
              disabled={invalidating}
              className="invalidate-button"
            >
              {invalidating ? 'Clearing...' : 'Clear Cache'}
            </button>
          </div>
        </div>
      )}
      
      {error && (
        <div className="error">
          Error: {error}
        </div>
      )}
      
      {/* Filters */}
      <div className="filters">
        <div className="filter-group">
          <label>
            Has Image:
            <select value={hasImage} onChange={(e) => setHasImage(e.target.value)}>
              <option value="">Any</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
          
          <label>
            Min Reactions:
            <input
              type="number"
              value={minReactions}
              onChange={(e) => setMinReactions(e.target.value)}
              placeholder="e.g., 10"
              min="0"
            />
          </label>
          
          <label>
            Min Comments:
            <input
              type="number"
              value={minComments}
              onChange={(e) => setMinComments(e.target.value)}
              placeholder="e.g., 5"
              min="0"
            />
          </label>
        </div>
        
        <div className="filter-group">
          <label>
            From:
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          
          <label>
            To:
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
          
          <label>
            Sort by:
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
              <option value="created_time">Created Time</option>
              <option value="reactions">Reactions</option>
              <option value="comments">Comments</option>
            </select>
          </label>
          
          <button 
            onClick={() => {
              setMinReactions('');
              setMinComments('');
              setHasImage('');
              setDateFrom('');
              setDateTo('');
              setSortKey('created_time');
            }}
            className="reset-button"
          >
            Reset Filters
          </button>
        </div>
      </div>
      
      {/* Posts */}
      <div className="posts-container">
        {processedPosts.length === 0 && !loading && (
          <div className="no-posts">
            {posts.length === 0 ? 'No posts loaded. Click "Fetch Posts" to load data.' : 'No posts match the current filters.'}
          </div>
        )}
        
        <div className="posts-grid">
          {processedPosts.map((post) => (
            <div key={post.id} className="post-card">
              {post.imageUrl && (
                <div className="post-image">
                  <img src={post.imageUrl} alt="Post" />
                </div>
              )}
              
              <div className="post-content">
                <div className="post-date">
                  {niceDate(post.created_time)}
                </div>
                
                <div className="post-stats">
                  <span className="reactions">👍 {post.totalReactions}</span>
                  <span className="comments">💬 {post.totalComments}</span>
                </div>
                
                {post.message && (
                  <div className="post-message">
                    {post.message.length > 200 
                      ? `${post.message.substring(0, 200)}...` 
                      : post.message
                    }
                  </div>
                )}
                
                <div className="post-actions">
                  <button 
                    onClick={() => fetchBreakdown(post.id)}
                    disabled={breakdownLoading[post.id]}
                    className="breakdown-button"
                  >
                    {breakdownLoading[post.id] ? 'Loading...' : 'Get Breakdown'}
                  </button>
                  
                  <a 
                    href={`https://facebook.com/${post.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="view-button"
                  >
                    View on Facebook
                  </a>
                </div>
                
                {post.reactionBreakdown && (
                  <div className="reaction-breakdown">
                    <h4>Reaction Breakdown:</h4>
                    <div className="breakdown-grid">
                      {Object.entries(post.reactionBreakdown).map(([type, count]) => (
                        <div key={type} className="breakdown-item">
                          <span className="reaction-emoji">{REACTION_TYPES[type.toUpperCase()] || '❓'}</span>
                          <span className="reaction-count">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="footer">
        <p>Data is cached for {CACHE_TTL_MINUTES} minutes to improve performance.</p>
      </div>
      
      {toast && (
        <div className="toast">
          {toast}
        </div>
      )}
    </div>
  );
};

export default FacebookPostsPage;