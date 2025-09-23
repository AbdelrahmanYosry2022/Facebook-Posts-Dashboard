// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AccountsPage from './pages/AccountsPage';
import PagesPage from './pages/PagesPage';
import FacebookPostsPage from './pages/FacebookPostsPage';
import "./index.css";

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/pages" element={<PagesPage />} />
          <Route path="/test" element={<FacebookPostsPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
