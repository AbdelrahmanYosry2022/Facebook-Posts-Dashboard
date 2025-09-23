import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Settings, 
  Plus, 
  Search, 
  BarChart3, 
  RefreshCw, 
  CheckCircle, 
  Users, 
  TrendingUp, 
  MessageCircle, 
  Eye, 
  Edit, 
  Trash2, 
  Link, 
  Smartphone 
} from 'lucide-react';
import './AccountsPage.css';

const AccountsPage = () => {
  const navigate = useNavigate();
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Mock data for accounts
  const accounts = [
    {
      id: 1,
      name: 'Farah Ahmed',
      email: 'farah.ahmed@example.com',
      avatar: 'FA',
      status: 'active',
      followers: '12.5K',
      posts: 245,
      engagement: '4.2%',
      lastActive: '2 hours ago',
      verified: true,
      accountType: 'Personal'
    },
    {
      id: 2,
      name: 'Ahmed Hassan',
      email: 'ahmed.hassan@example.com',
      avatar: 'AH',
      status: 'active',
      followers: '8.3K',
      posts: 189,
      engagement: '3.8%',
      lastActive: '5 hours ago',
      verified: false,
      accountType: 'Personal'
    },
    {
      id: 3,
      name: 'Sara Mohamed',
      email: 'sara.mohamed@example.com',
      avatar: 'SM',
      status: 'inactive',
      followers: '15.2K',
      posts: 312,
      engagement: '5.1%',
      lastActive: '2 days ago',
      verified: true,
      accountType: 'Personal'
    },
    {
      id: 4,
      name: 'Omar Ali',
      email: 'omar.ali@example.com',
      avatar: 'OA',
      status: 'pending',
      followers: '3.7K',
      posts: 98,
      engagement: '2.9%',
      lastActive: '1 week ago',
      verified: false,
      accountType: 'Personal'
    }
  ];

  const stats = [
    {
      title: 'Total Accounts',
      value: '4',
      change: '+2',
      changeType: 'positive',
      icon: Users
    },
    {
      title: 'Active Accounts',
      value: '2',
      change: '0',
      changeType: 'neutral',
      icon: CheckCircle
    },
    {
      title: 'Total Followers',
      value: '39.7K',
      change: '+12.3%',
      changeType: 'positive',
      icon: TrendingUp
    },
    {
      title: 'Avg Engagement',
      value: '4.0%',
      change: '+0.5%',
      changeType: 'positive',
      icon: MessageCircle
    }
  ];

  const filteredAccounts = accounts.filter(account =>
    account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'status-active';
      case 'inactive': return 'status-inactive';
      case 'pending': return 'status-pending';
      default: return 'status-neutral';
    }
  };

  return (
    <div className="accounts-page">
      {/* Background Elements */}
      <div className="accounts-bg">
        <div className="bg-grid"></div>
        <div className="bg-gradient-1"></div>
        <div className="bg-gradient-2"></div>
      </div>

      <div className="accounts-container">
        {/* Header */}
        <div className="accounts-header">
          <div className="header-top">
            <button 
              className="back-button"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="back-icon" size={20} />
              <span>Back to Home</span>
            </button>
            
            <div className="header-actions">
              <button className="action-btn secondary">
                <Settings className="btn-icon" size={16} />
                Settings
              </button>
              <button className="action-btn primary">
                <Plus className="btn-icon" size={16} />
                Add Account
              </button>
            </div>
          </div>
          
          <div className="header-content">
            <div className="page-title">
              <h1>Personal Accounts</h1>
              <p className="page-subtitle">Manage and monitor your Facebook personal accounts</p>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="stats-grid">
          {stats.map((stat, index) => (
            <div key={index} className="stat-card">
              <div className="stat-header">
                <div className="stat-icon"><stat.icon size={20} /></div>
                <div className={`stat-change ${stat.changeType}`}>
                  {stat.change}
                </div>
              </div>
              <div className="stat-content">
                <div className="stat-value">{stat.value}</div>
                <div className="stat-title">{stat.title}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Search and Filters */}
        <div className="accounts-controls">
          <div className="search-container">
            <div className="search-input-wrapper">
              <Search className="search-icon" size={16} />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
          
          <div className="filter-controls">
            <select className="filter-select">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
            
            <select className="filter-select">
              <option value="all">All Types</option>
              <option value="personal">Personal</option>
              <option value="business">Business</option>
            </select>
          </div>
        </div>

        {/* Accounts Table */}
        <div className="accounts-table-container">
          <div className="table-header">
            <h3>Accounts Overview</h3>
            <div className="table-actions">
              <button className="table-action-btn">
                <BarChart3 size={16} />
                Export
              </button>
              <button className="table-action-btn">
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>
          </div>
          
          <div className="accounts-table">
            <div className="table-header-row">
              <div className="table-cell header">Account</div>
              <div className="table-cell header">Status</div>
              <div className="table-cell header">Followers</div>
              <div className="table-cell header">Posts</div>
              <div className="table-cell header">Engagement</div>
              <div className="table-cell header">Last Active</div>
              <div className="table-cell header">Actions</div>
            </div>
            
            {filteredAccounts.map((account) => (
              <div 
                key={account.id} 
                className={`table-row ${selectedAccount === account.id ? 'selected' : ''}`}
                onClick={() => setSelectedAccount(account.id)}
              >
                <div className="table-cell account-info">
                  <div className="account-avatar">
                    <span className="avatar-text">{account.avatar}</span>
                    {account.verified && <CheckCircle className="verified-badge" size={12} />}
                  </div>
                  <div className="account-details">
                    <div className="account-name">{account.name}</div>
                    <div className="account-email">{account.email}</div>
                  </div>
                </div>
                
                <div className="table-cell">
                  <span className={`status-badge ${getStatusColor(account.status)}`}>
                    {account.status}
                  </span>
                </div>
                
                <div className="table-cell metric">
                  <span className="metric-value">{account.followers}</span>
                </div>
                
                <div className="table-cell metric">
                  <span className="metric-value">{account.posts}</span>
                </div>
                
                <div className="table-cell metric">
                  <span className="metric-value engagement">{account.engagement}</span>
                </div>
                
                <div className="table-cell last-active">
                  {account.lastActive}
                </div>
                
                <div className="table-cell actions">
                  <button className="action-icon-btn" title="View Details">
                    <Eye size={16} />
                  </button>
                  <button className="action-icon-btn" title="Edit Account">
                    <Edit size={16} />
                  </button>
                  <button className="action-icon-btn danger" title="Remove Account">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          <h3>Quick Actions</h3>
          <div className="actions-grid">
            <div className="action-card">
              <div className="action-icon"><Link size={24} /></div>
              <div className="action-content">
                <h4>Connect New Account</h4>
                <p>Link a new Facebook personal account</p>
              </div>
              <button className="action-arrow">→</button>
            </div>
            
            <div className="action-card">
              <div className="action-icon"><BarChart3 size={24} /></div>
              <div className="action-content">
                <h4>Analytics Dashboard</h4>
                <p>View detailed account performance</p>
              </div>
              <button className="action-arrow">→</button>
            </div>
            
            <div className="action-card">
              <div className="action-icon"><Settings size={24} /></div>
              <div className="action-content">
                <h4>Account Settings</h4>
                <p>Manage permissions and preferences</p>
              </div>
              <button className="action-arrow">→</button>
            </div>
            
            <div className="action-card">
              <div className="action-icon"><Smartphone size={24} /></div>
              <div className="action-content">
                <h4>Mobile App</h4>
                <p>Download our mobile application</p>
              </div>
              <button className="action-arrow">→</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountsPage;