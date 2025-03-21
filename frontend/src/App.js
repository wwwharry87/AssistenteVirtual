// App.js
import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import CoordInformaPage from './pages/CoordInformaPage';
import RespInformaPage from './pages/RespInformaPage';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/coordinforma" element={<CoordInformaPage />} />
        <Route path="/respinforma" element={<RespInformaPage />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
