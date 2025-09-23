import React from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';

const HomePage = () => {
  const navigate = useNavigate();

  const handleCardClick = (path) => {
    navigate(path);
  };

  const cards = [
    {
      id: 'accounts',
      path: '/accounts',
      icon: '👤',
      title: 'Personal Accounts',
      description: 'Manage your profile & friends',
      gradient: 'from-blue-500 to-purple-600',
      stats: '12 Active'
    },
    {
      id: 'pages',
      path: '/pages',
      icon: '📄',
      title: 'Facebook Pages',
      description: 'Oversee your business & community',
      gradient: 'from-green-500 to-teal-600',
      stats: '5 Pages'
    },
    {
      id: 'test',
      path: '/facebook-posts',
      icon: '📊',
      title: 'Test Dashboard',
      description: 'Facebook Posts Analytics & Management',
      gradient: 'from-orange-500 to-red-600',
      stats: '2.4k Posts'
    }
  ];

  return (
    <div className="homepage">
      {/* Background Elements */}
      <div className="homepage-bg">
        <div className="bg-grid"></div>
        <div className="bg-gradient-1"></div>
        <div className="bg-gradient-2"></div>
        <div className="bg-gradient-3"></div>
      </div>

      <div className="homepage-container">
        {/* Header Section */}
        <div className="homepage-header">
          <div className="header-content">
            <div className="welcome-badge">
              <span className="badge-dot"></span>
              <span>Welcome back</span>
            </div>
            <h1 className="homepage-title">
              Hello, <span className="title-highlight">Farah Ahmed</span>
            </h1>
            <p className="homepage-subtitle">
              Choose your workspace to get started with your social media management
            </p>
          </div>
          
          {/* Stats Overview */}
          <div className="stats-overview">
            <div className="stat-item">
              <div className="stat-value">2.4k</div>
              <div className="stat-label">Total Posts</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">17</div>
              <div className="stat-label">Active Pages</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">98%</div>
              <div className="stat-label">Uptime</div>
            </div>
          </div>
        </div>
        
        {/* Cards Grid */}
        <div className="homepage-cards">
          {cards.map((card) => (
            <div 
              key={card.id}
              className={`homepage-card card-${card.id}`}
              onClick={() => handleCardClick(card.path)}
            >
              <div className="card-header">
                <div className={`card-icon bg-gradient-to-r ${card.gradient}`}>
                  <span>{card.icon}</span>
                </div>
                <div className="card-stats">{card.stats}</div>
              </div>
              
              <div className="card-content">
                <h3 className="card-title">{card.title}</h3>
                <p className="card-description">{card.description}</p>
              </div>
              
              <div className="card-footer">
                <div className="card-action">
                  <span>Open workspace</span>
                  <svg className="action-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
              
              {/* Card Glow Effect */}
              <div className={`card-glow bg-gradient-to-r ${card.gradient}`}></div>
            </div>
          ))}
        </div>
        
        {/* Quick Actions */}
        <div className="quick-actions">
          <div className="action-item">
            <div className="action-icon">⚡</div>
            <span>Quick Post</span>
          </div>
          <div className="action-item">
            <div className="action-icon">📈</div>
            <span>Analytics</span>
          </div>
          <div className="action-item">
            <div className="action-icon">⚙️</div>
            <span>Settings</span>
          </div>
        </div>
        
        {/* Footer */}
        <div className="homepage-footer">
          <div className="footer-content">
            <div className="user-info">
              <div className="user-avatar">
                <span>FA</span>
              </div>
              <div className="user-details">
                <span className="user-name">Farah Ahmed</span>
                <span className="user-role">Administrator</span>
              </div>
            </div>
            <button className="logout-btn">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 2H3C2.44772 2 2 2.44772 2 3V13C2 13.5523 2.44772 14 3 14H6M10 12L14 8M14 8L10 4M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;