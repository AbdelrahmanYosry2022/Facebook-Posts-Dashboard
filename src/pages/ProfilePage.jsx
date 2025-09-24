import React, { useState, useEffect } from 'react';
import './ProfilePage.css';
import './AccountsPage.css';

const ProfilePage = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [performanceFilter, setPerformanceFilter] = useState('all');

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const response = await fetch('http://localhost:4000/posts');
      const data = await response.json();
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.message?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
    const matchesType = typeFilter === 'all' || post.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || post.status === statusFilter;
    
    let matchesPerformance = true;
    if (performanceFilter === 'high') {
      const engagement = (post.reactions?.summary?.total_count || 0) + (post.comments?.summary?.total_count || 0);
      matchesPerformance = engagement > 50;
    } else if (performanceFilter === 'low') {
      const engagement = (post.reactions?.summary?.total_count || 0) + (post.comments?.summary?.total_count || 0);
      matchesPerformance = engagement <= 10;
    }
    
    return matchesSearch && matchesType && matchesStatus && matchesPerformance;
  });

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (performanceFilter === 'highest') {
      const aEngagement = (a.reactions?.summary?.total_count || 0) + (a.comments?.summary?.total_count || 0);
      const bEngagement = (b.reactions?.summary?.total_count || 0) + (b.comments?.summary?.total_count || 0);
      return bEngagement - aEngagement;
    } else if (performanceFilter === 'lowest') {
      const aEngagement = (a.reactions?.summary?.total_count || 0) + (a.comments?.summary?.total_count || 0);
      const bEngagement = (b.reactions?.summary?.total_count || 0) + (b.comments?.summary?.total_count || 0);
      return aEngagement - bEngagement;
    }
    return new Date(b.created_time) - new Date(a.created_time);
  });

  return (
    <div className="profile-page">
      <div className="profile-bg">
        <div className="bg-grid"></div>
        <div className="bg-gradient-1"></div>
        <div className="bg-gradient-2"></div>
      </div>

      <div className="profile-sidebar">
        <div className="sidebar-header">
          <div className="platform-logo">
            <div className="logo-icon">FB</div>
            <span className="logo-text">Facebook</span>
          </div>
          <div className="user-info">
            <div className="user-avatar">U</div>
            <div className="user-details">
              <h4>User Account</h4>
              <p>Facebook Profile</p>
            </div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <ul className="nav-menu">
            <li className="nav-item"><a className="nav-link active" href="#">📝 Posts</a></li>
            <li className="nav-item"><a className="nav-link" href="#">📈 Analytics</a></li>
            <li className="nav-item"><a className="nav-link" href="#">✏️ Create</a></li>
          </ul>
        </nav>
        <div className="sidebar-footer">
          <ul className="footer-nav">
            <li className="nav-item"><a className="nav-link" href="#">⚙️ Settings</a></li>
            <li className="nav-item"><a className="nav-link" href="#">🚪 Logout</a></li>
          </ul>
        </div>
      </div>

      <div className="profile-main">
        <div className="profile-container">
          <div className="profile-header">
            <div className="header-content">
              <div className="page-title">
                <h1>Posts</h1>
                <p className="page-subtitle">Manage and view your Facebook posts</p>
              </div>
            </div>

            <div className="profile-controls">
              <div className="search-container">
                <div className="search-input-wrapper">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search posts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="filter-controls">
                <select className="filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option value="all">All Types</option>
                  <option value="photo">Photo</option>
                  <option value="video">Video</option>
                  <option value="status">Status</option>
                </select>

                <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All Status</option>
                  <option value="published">Published</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="error">Error</option>
                </select>

                <select className="filter-select" value={performanceFilter} onChange={(e) => setPerformanceFilter(e.target.value)}>
                  <option value="all">All Performance</option>
                  <option value="highest">Highest Engagement</option>
                  <option value="lowest">Lowest Engagement</option>
                  <option value="high">High Performance</option>
                  <option value="low">Low Performance</option>
                </select>
              </div>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon">📝</div>
                <div className="stat-change neutral"> </div>
              </div>
              <div className="stat-content">
                <div className="stat-value">{posts.length}</div>
                <div className="stat-title">Total Posts</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon">👍</div>
                <div className="stat-change neutral"> </div>
              </div>
              <div className="stat-content">
                <div className="stat-value">{posts.reduce((s, p) => s + ((p.reactions?.summary?.total_count)||0), 0)}</div>
                <div className="stat-title">Total Reactions</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon">💬</div>
                <div className="stat-change neutral"> </div>
              </div>
              <div className="stat-content">
                <div className="stat-value">{posts.reduce((s, p) => s + ((p.comments?.summary?.total_count)||0), 0)}</div>
                <div className="stat-title">Total Comments</div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading posts...</p>
            </div>
          ) : (
            <div className="accounts-table-container">
              <div className="table-header">
                <h3>Posts Overview</h3>
                <div className="table-actions">
                  <button className="table-action-btn">Export</button>
                </div>
              </div>

              <div className="accounts-table">
                <div className="table-header-row">
                  <div className="table-cell header">Post</div>
                  <div className="table-cell header">Status</div>
                  <div className="table-cell header">Reactions</div>
                  <div className="table-cell header">Comments</div>
                  <div className="table-cell header">Shares</div>
                  <div className="table-cell header">Date</div>
                  <div className="table-cell header">Actions</div>
                </div>

                {sortedPosts.length > 0 ? (
                  sortedPosts.map((post) => {
                    const likesCount = post.reactions?.summary?.total_count || 0;
                    const commentsCount = post.comments?.summary?.total_count || 0;
                    const sharesCount = post.shares?.count || 0;
                    return (
                      <div key={post.id} className="table-row">
                        <div className="table-cell account-info">
                          <div className="account-avatar">
                            {post.full_picture ? (
                              <img src={post.full_picture} alt="post" className="avatar-image" />
                            ) : (
                              <span className="avatar-text">P</span>
                            )}
                          </div>
                          <div className="account-details">
                            <div className="account-name">{(post.message || '').substring(0, 80) || 'Untitled post'}</div>
                            <div className="account-email">{post.permalink_url || ''}</div>
                          </div>
                        </div>

                        <div className="table-cell">
                          <span className={`status-badge status-published`}>published</span>
                        </div>

                        <div className="table-cell metric">
                          <span className="metric-value followers">{likesCount}</span>
                        </div>

                        <div className="table-cell metric">
                          <span className="metric-value posts">{commentsCount}</span>
                        </div>

                        <div className="table-cell metric">
                          <span className="metric-value engagement">{sharesCount}</span>
                        </div>

                        <div className="table-cell last-active">{new Date(post.created_time).toLocaleString()}</div>

                        <div className="table-cell actions">
                          <button className="action-icon-btn">View</button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">📝</div>
                    <h3>No posts found</h3>
                    <p>No posts match your current filters. Try adjusting your search or filter criteria.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;