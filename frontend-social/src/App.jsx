import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import Discovery from './pages/Discovery';
import TraderProfile from './pages/TraderProfile';

// Placeholder Pages
const Analytics = () => <div className="text-2xl font-bold">Analytics Engine</div>;

function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-background text-textMain">
        <Sidebar />
        <main className="flex-1 ml-64 p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/discover" element={<Discovery />} />
            <Route path="/trader/:id" element={<TraderProfile />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
