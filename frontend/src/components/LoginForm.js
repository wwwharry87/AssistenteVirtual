// LoginForm.js
import React, { useState } from 'react';

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
  
    try {
      // Verifica se o usuário existe
      const resUser = await fetch(`${process.env.REACT_APP_API_URL}/api/verificar-usuario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const dataUser = await resUser.json();
  
      if (!dataUser.success) {
        setError(dataUser.message || 'Usuário não encontrado.');
        return;
      }
  
      // Efetua login
      const resLogin = await fetch(`${process.env.REACT_APP_API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const dataLogin = await resLogin.json();
  
      if (dataLogin.success) {
        window.location.href = dataLogin.redirecionar;
      } else {
        setError(dataLogin.message || 'Senha inválida.');
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao fazer login.');
    }
  };  

  return (
    <form onSubmit={handleLogin}>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      <div className="mb-4">
        <label className="block text-gray-700 mb-1">Usuário</label>
        <input 
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring focus:border-blue-300"
          placeholder="Digite seu usuário"
          required
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-1">Senha</label>
        <input 
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring focus:border-blue-300"
          placeholder="Digite sua senha"
          required
        />
      </div>
      <button 
        type="submit"
        className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition-colors"
      >
        Entrar
      </button>
    </form>
  );
}

export default LoginForm;
