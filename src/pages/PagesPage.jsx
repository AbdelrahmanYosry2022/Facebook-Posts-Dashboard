import React from 'react';
import { useNavigate } from 'react-router-dom';
import './PlaceholderPage.css';

const PagesPage = () => {
  const navigate = useNavigate();

  return (
    <div className="placeholder-page">
      <div className="page-header">
        <button 
          className="back-button"
          onClick={() => navigate('/')}
        >
          ← Back to Home
        </button>
        <h1>Facebook Pages</h1>
      </div>

      <div className="placeholder-content">
        <div className="placeholder-icon">📄</div>
        <h2>Facebook Pages Management</h2>
        <p>This section will allow you to manage your Facebook business pages.</p>
        <p>Features coming soon:</p>
        <ul>
          <li>View all connected Facebook pages</li>
          <li>Manage page content and posts</li>
          <li>View page analytics and insights</li>
          <li>Schedule posts for pages</li>
          <li>Respond to page messages and comments</li>
          <li>Manage page settings and permissions</li>
        </ul>
        
        <div className="coming-soon">
          🚧 Under Development 🚧
        </div>
      </div>
    </div>
  );
};

export default PagesPage;