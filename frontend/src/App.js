// App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import CoordInformaPage from './pages/CoordInformaPage';
import RespInformaPage from './pages/RespInformaPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/coordinforma" element={<CoordInformaPage />} />
        <Route path="/respinforma" element={<RespInformaPage />} />
      </Routes>
    </Router>
  );
}

export default App;
