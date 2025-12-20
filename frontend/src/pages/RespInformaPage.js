// frontend/src/pages/RespInformaPage.js
import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'react-qr-code';
import { apiFetch, API_BASE } from '../api';

function RespInformaPage() {
  const [municipios, setMunicipios] = useState([]);
  const [selectedMunicipio, setSelectedMunicipio] = useState('');
  const [dataCSV, setDataCSV] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filtros
  const [selectedEscola, setSelectedEscola] = useState('');
  const [selectedResponsavel, setSelectedResponsavel] = useState('');
  const [escolas, setEscolas] = useState([]);
  const [responsaveis, setResponsaveis] = useState([]);

  // Envio
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendResult, setSendResult] = useState(null);

  // Status do WhatsApp
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [qrString, setQrString] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // ===== Helpers =====
  const toArray = (json) => {
    if (Array.isArray(json)) return json;
    if (Array.isArray(json?.rows)) return json.rows;
    if (Array.isArray(json?.resultados)) return json.resultados;
    return [];
  };

  const cleanHeaders = (arr) =>
    arr.map((item) => {
      const out = {};
      Object.keys(item || {}).forEach((key) => {
        const cleanKey = key.replace(/^\uFEFF/, '').trim();
        out[cleanKey] = item[key];
      });
      return out;
    });

  // ===== WhatsApp status (Cloud API não mostra QR; WPP antigo pode mostrar) =====
  useEffect(() => {
    let alive = true;
    const fetchWhatsappStatus = async () => {
      try {
        const { data } = await apiFetch('/api/whatsapp-status');
        if (!alive) return;

        const isDisabled = data?.state === 'WPP_DISABLED';
        if (isDisabled) {
          setWhatsappConnected(true);
          setQrString(null);
          setShowModal(false);
          return;
        }

        setWhatsappConnected(Boolean(data.connected));
        setQrString(data.qrString || null);
        setShowModal(!data.connected && !!data.qrString);
      } catch {
        // silencioso
      }
    };

    fetchWhatsappStatus();
    const interval = setInterval(fetchWhatsappStatus, 60000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  // ===== Carrega municípios (tipo=2 para RespInforma) =====
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: json } = await apiFetch('/api/municipios');
        if (!alive) return;
        const filtered = (Array.isArray(json) ? json : []).filter(
          (item) => item?.dados && item.dados.some((d) => d.tipo === 2)
        );
        setMunicipios(filtered);
      } catch (err) {
        if (!alive) return;
        console.error(err);
        setError('Erro ao carregar municípios.');
      }
    })();
    return () => { alive = false; };
  }, []);

  // ===== Carrega CSV (tipo=2) por município =====
  useEffect(() => {
    let alive = true;

    const loadCSV = async () => {
      if (!selectedMunicipio) {
        setDataCSV([]);
        setEscolas([]);
        setResponsaveis([]);
        return;
      }
      setLoading(true);
      setError('');

      try {
        const { data: json } = await apiFetch(`/api/dados-csv?municipio=${encodeURIComponent(selectedMunicipio)}&tipo=2`);
        const arr = cleanHeaders(toArray(json));
        if (!alive) return;

        setDataCSV(arr);

        const uniqueEscolas = Array.from(new Set(arr.map((i) => i.escola).filter(Boolean)));
        setEscolas(uniqueEscolas);

        const uniqueResps = Array.from(new Set(arr.map((i) => i.responsavel).filter(Boolean)));
        setResponsaveis(uniqueResps);

        setSelectedEscola('');
        setSelectedResponsavel('');
      } catch (err) {
        console.error(err);
        if (!alive) return;
        setError('Erro ao carregar dados.');
        setDataCSV([]);
        setEscolas([]);
        setResponsaveis([]);
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadCSV();
    return () => { alive = false; };
  }, [selectedMunicipio]);

  // ===== Atualiza responsáveis ao trocar escola =====
  useEffect(() => {
    if (!dataCSV.length) {
      setResponsaveis([]);
      return;
    }
    if (selectedEscola) {
      const filtered = Array.from(
        new Set(
          dataCSV
            .filter((it) => it.escola === selectedEscola)
            .map((it) => it.responsavel)
            .filter(Boolean)
        )
      );
      setResponsaveis(filtered);
      if (!filtered.includes(selectedResponsavel)) setSelectedResponsavel('');
    } else {
      const all = Array.from(new Set(dataCSV.map((it) => it.responsavel).filter(Boolean)));
      setResponsaveis(all);
    }
  }, [selectedEscola, dataCSV, selectedResponsavel]);

  // ===== Filtro em memória =====
  const filteredData = useMemo(() => {
    const arr = Array.isArray(dataCSV) ? dataCSV : [];
    return arr.filter((item) => {
      return (
        (!selectedEscola || item.escola === selectedEscola) &&
        (!selectedResponsavel || item.responsavel === selectedResponsavel)
      );
    });
  }, [dataCSV, selectedEscola, selectedResponsavel]);

  // ===== Envio =====
  const sendMessages = async () => {
    if (!filteredData.length) {
      alert('Nenhum dado para envio.');
      return;
    }
    setIsSending(true);
    setSendProgress(0);
    setSendResult(null);

    const progressTimer = setInterval(() => {
      setSendProgress((prev) => (prev < 90 ? prev + 5 : prev));
    }, 500);

    try {
      const { status, data } = await apiFetch('/api/respinforma/send-messages', {
        method: 'POST',
        body: JSON.stringify({
          municipio: selectedMunicipio,
          dados: filteredData
        })
      });

      clearInterval(progressTimer);
      setSendProgress(100);

      if (status === 503 && data?.reconnect) {
        // modo WPP antigo: tenta abrir QR
        try {
          const { data: s } = await apiFetch('/api/whatsapp-status');
          setQrString(s.qrString || null);
          if (s.qrString) setShowModal(true);
        } catch {}
        setSendResult(data?.error || 'Reconexão necessária.');
        return;
      }

      if (data?.success) {
        const ok = Array.isArray(data.resultados)
          ? data.resultados.filter((r) => r.status === 'enviado').length
          : 0;
        const fail = Array.isArray(data.resultados)
          ? data.resultados.filter((r) => r.status !== 'enviado').length
          : 0;

        setSendResult(`Enviado: ${ok} • Falhas: ${fail}`);
        setTimeout(() => window.location.reload(), 2500);
      } else {
        setSendResult(data?.error || 'Erro ao enviar mensagens.');
        setTimeout(() => {
          setIsSending(false);
          setSendProgress(0);
          setSendResult(null);
        }, 2500);
      }
    } catch (err) {
      clearInterval(progressTimer);
      setIsSending(false);
      setSendProgress(0);
      console.error(err);
      setSendResult('Erro na comunicação com o servidor.');
      setTimeout(() => setSendResult(null), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Modal de QR Code (só aparece se backend realmente fornecer QR) */}
      {showModal && !whatsappConnected && qrString && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg relative max-w-sm mx-auto">
            <button onClick={() => setShowModal(false)} className="absolute top-2 right-2 text-gray-600 hover:text-gray-800 text-2xl">
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4 text-center">Conecte o WhatsApp</h2>
            <p className="mb-4 text-center">Escaneie o QR Code abaixo para conectar:</p>
            <div className="flex justify-center">
              <QRCode value={qrString} size={200} />
            </div>
          </div>
        </div>
      )}

      {/* Cabeçalho */}
      <header className="bg-white shadow-lg rounded-2xl p-6 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <img
            src="/logo_r.png"
            alt="Logo RespInforma"
            className="h-16 w-16 object-contain p-2 bg-gray-100 rounded-xl"
          />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-green-600">RespInforma</h1>
            <p className="text-gray-500 text-sm md:text-base">Dashboard dos Responsáveis</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => (window.location.href = '/coordinforma')}
            className="p-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
          >
            <i className="fas fa-exchange-alt text-xl"></i>
          </button>
          <button
            onClick={() => (window.location.href = `${API_BASE}/api/logout`)}
            className="p-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
          >
            <i className="fas fa-sign-out-alt text-xl"></i>
          </button>
        </div>
      </header>

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Município</label>
            <select
              value={selectedMunicipio}
              onChange={(e) => setSelectedMunicipio(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
            >
              <option value="">Selecione um município</option>
              {municipios.map((mun, idx) => (
                <option key={idx} value={mun.nome}>{mun.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Escola</label>
            <select
              value={selectedEscola}
              onChange={(e) => setSelectedEscola(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
            >
              <option value="">Todas as Escolas</option>
              {escolas.map((escola, idx) => (
                <option key={idx} value={escola}>{escola}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Responsável</label>
            <select
              value={selectedResponsavel}
              onChange={(e) => setSelectedResponsavel(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
            >
              <option value="">Todos os Responsáveis</option>
              {responsaveis.map((resp, idx) => (
                <option key={idx} value={resp}>{resp}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Envio e progresso */}
      <div className="mb-4">
        <button
          onClick={sendMessages}
          disabled={isSending}
          className={`w-full block py-3 text-white font-bold ${isSending ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'} rounded-lg transition-colors`}
        >
          Enviar Mensagens
        </button>
        {isSending && (
          <div className="mt-2">
            <p className="text-center font-semibold text-sm">Enviando mensagens... {sendProgress}%</p>
            <div className="w-full bg-gray-300 h-2 rounded">
              <div
                className="bg-green-600 h-2 rounded transition-all duration-200"
                style={{ width: `${sendProgress}%` }}
              />
            </div>
          </div>
        )}
        {sendResult && (
          <div className="mt-2 p-2 bg-green-100 text-green-800 rounded text-center text-sm">
            {sendResult}
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
          </div>
        ) : error ? (
          <div className="text-center text-red-500 py-6">{error}</div>
        ) : (
          <div>
            <table className="table-fixed w-full text-[10px] whitespace-normal break-words">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-1 py-1 text-left font-semibold text-gray-700 w-1/4">Aluno</th>
                  <th className="px-1 py-1 text-left font-semibold text-gray-700 w-1/4">Turma</th>
                  <th className="px-1 py-1 text-left font-semibold text-gray-700 w-1/4">Data</th>
                  <th className="px-1 py-1 text-left font-semibold text-gray-700 w-1/4">Ocorrência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-1 py-2 text-center text-gray-500">
                      Nenhum dado encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-1 py-1 text-[10px] text-gray-700 break-words">{item.aluno || '-'}</td>
                      <td className="px-1 py-1 text-[10px] text-gray-700 break-words">{item.turma || '-'}</td>
                      <td className="px-1 py-1 text-[10px] text-gray-700 break-words">{item.data || '-'}</td>
                      <td className="px-1 py-1 text-[10px] text-gray-700 break-words">{item.ocorrencia || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rodapé com base da API para conferência */}
      <div className="text-xs text-gray-400 mt-4 text-center">
        API: {API_BASE}
      </div>
    </div>
  );
}

export default RespInformaPage;
