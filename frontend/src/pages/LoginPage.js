import React from 'react';
import LoginForm from '../components/LoginForm';

function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-green-200 to-green-400 font-sans">
      <div className="bg-white shadow-lg rounded-lg p-8 max-w-sm w-full">
        <div className="flex flex-col items-center mb-6">
          {/* Ajuste o caminho da imagem do seu logo */}
          <img src="/logo.png" alt="Logo" className="w-32 mb-4" />
          <h1 className="text-2xl font-bold text-green-700">BW Soluções Inteligentes</h1>
        </div>
        <LoginForm />
        <div className="mt-4 text-center">
          <span
            className="text-blue-600 cursor-pointer underline"
            onClick={() => window.location.href = '/redefinir'}
          >
            Esqueceu a senha?
          </span>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
