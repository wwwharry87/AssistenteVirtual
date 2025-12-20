import React, { useState } from 'react';
import { apiFetch, API_BASE } from './api';


function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      // 1) verifica usuário
      const r1 = await apiFetch('/api/verificar-usuario', {
        method: 'POST',
        body: JSON.stringify({ username })
      });
      if (!r1.ok || !r1.data?.success) {
        setError(r1.data?.message || 'Usuário não encontrado.');
        return;
      }

      // 2) login
      const r2 = await apiFetch('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      if (!r2.ok || !r2.data?.success) {
        setError(r2.data?.message || 'Usuário ou senha inválidos.');
        return;
      }

      window.location.href = r2.data?.redirecionar || '/coordinforma';
    } catch (err) {
      console.error('[login] erro:', err);
      setError('Erro de rede. Tente novamente.');
    }
  };

  return (
    <form onSubmit={handleLogin} style={{ maxWidth: 360, margin: '40px auto' }}>
      <h1 style={{ fontWeight: 700, fontSize: 20, marginBottom: 16 }}>Entrar</h1>
      {error && (
        <div style={{ background:'#fee2e2', color:'#991b1b', padding:12, borderRadius:8, marginBottom:12 }}>
          {error}
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <label>Usuário</label>
        <input
          type="text"
          value={username}
          onChange={(e)=>setUsername(e.target.value)}
          style={{ width:'100%', padding:8, border:'1px solid #ccc', borderRadius:6 }}
          required
          autoComplete="username"
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label>Senha</label>
        <input
          type="password"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
          style={{ width:'100%', padding:8, border:'1px solid #ccc', borderRadius:6 }}
          required
          autoComplete="current-password"
        />
      </div>
      <button type="submit" style={{ width:'100%', padding:10, background:'#16a34a', color:'#fff', border:0, borderRadius:6 }}>
        Entrar
      </button>
      <div style={{ fontSize:12, color:'#64748b', marginTop:8 }}>
        API: {API_BASE}
      </div>
    </form>
  );
}

export default LoginForm;
