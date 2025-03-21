import React, { useState, useEffect } from 'react';

function CoordInformaPage() {
  const [municipios, setMunicipios] = useState([]);
  const [selectedMunicipio, setSelectedMunicipio] = useState('');
  const [dataCSV, setDataCSV] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Estados para os filtros
  const [selectedEscola, setSelectedEscola] = useState('');
  const [selectedCoordenador, setSelectedCoordenador] = useState('');
  const [escolas, setEscolas] = useState([]);
  const [coordenadores, setCoordenadores] = useState([]);

  // Estados para envio de mensagens e barra de progresso
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendResult, setSendResult] = useState(null);

  // Carrega os municípios com dados do tipo 1
  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/api/municipios`)
      .then(res => res.json())
      .then(data => {
        const filtered = data.filter(item =>
          item.dados && item.dados.some(d => d.tipo === 1)
        );
        setMunicipios(filtered);
      })
      .catch(err => {
        console.error(err);
        setError('Erro ao carregar municípios.');
      });
  }, []);

  // Carrega os dados CSV para o tipo 1 quando um município for selecionado
  useEffect(() => {
    if (selectedMunicipio) {
      setLoading(true);
      fetch(`${process.env.REACT_APP_API_URL}/api/dados-csv?municipio=${encodeURIComponent(selectedMunicipio)}&tipo=1`)
        .then(res => {
          if (!res.ok) {
            throw new Error(`Erro ${res.status}: ${res.statusText}`);
          }
          return res.json();
        })
        .then(data => {
          // Limpa as chaves removendo BOM e espaços extras
          const cleanData = data.map(item => {
            const newItem = {};
            Object.keys(item).forEach(key => {
              const cleanKey = key.replace(/^\uFEFF/, '').trim();
              newItem[cleanKey] = item[key];
            });
            return newItem;
          });
          setDataCSV(cleanData);

          // Extrai valores únicos para preencher os dropdowns de "escola" e "coordenador"
          const uniqueEscolas = Array.from(new Set(cleanData.map(item => item.escola).filter(Boolean)));
          setEscolas(uniqueEscolas);
          const uniqueCoordenadores = Array.from(new Set(cleanData.map(item => item.coordenador).filter(Boolean)));
          setCoordenadores(uniqueCoordenadores);

          // Reseta os filtros ao trocar de município
          setSelectedEscola('');
          setSelectedCoordenador('');
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setError('Erro ao carregar dados.');
          setLoading(false);
        });
    } else {
      setDataCSV([]);
      setEscolas([]);
      setCoordenadores([]);
    }
  }, [selectedMunicipio]);

  // Atualiza o dropdown de Coordenador conforme a escola selecionada
  useEffect(() => {
    if (dataCSV.length) {
      if (selectedEscola) {
        const filteredCoordenadores = Array.from(new Set(
          dataCSV
            .filter(item => item.escola === selectedEscola)
            .map(item => item.coordenador)
            .filter(Boolean)
        ));
        setCoordenadores(filteredCoordenadores);
        if (!filteredCoordenadores.includes(selectedCoordenador)) {
          setSelectedCoordenador('');
        }
      } else {
        const uniqueCoordenadores = Array.from(new Set(
          dataCSV.map(item => item.coordenador).filter(Boolean)
        ));
        setCoordenadores(uniqueCoordenadores);
      }
    }
  }, [selectedEscola, dataCSV, selectedCoordenador]);

  // Filtra os dados para exibição na tabela conforme os filtros selecionados
  const filteredData = dataCSV.filter(item => {
    return (
      (!selectedEscola || item.escola === selectedEscola) &&
      (!selectedCoordenador || item.coordenador === selectedCoordenador)
    );
  });

  // Função para enviar as mensagens via API com barra de progresso simulada
  const sendMessages = () => {
    if (filteredData.length === 0) {
      alert("Nenhum dado para envio.");
      return;
    }
    setIsSending(true);
    setSendProgress(0);
    setSendResult(null);

    // Simula o progresso incrementando a cada 500ms até 90%
    const progressInterval = setInterval(() => {
      setSendProgress(prev => (prev < 90 ? prev + 5 : prev));
    }, 500);

    fetch(`${process.env.REACT_APP_API_URL}/api/coordinforma/send-messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        municipio: selectedMunicipio,
        dados: filteredData
      })
    })
      .then(res => res.json())
      .then(data => {
        clearInterval(progressInterval);
        setSendProgress(100);
        if (data.success) {
          setSendResult('Mensagens enviadas com sucesso!');
          // Após 3 segundos, recarrega a página para limpar a mensagem
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        } else {
          setSendResult('Erro ao enviar mensagens. Tente novamente.');
          setTimeout(() => {
            setIsSending(false);
            setSendProgress(0);
            setSendResult(null);
          }, 3000);
        }
      })
      .catch(err => {
        clearInterval(progressInterval);
        setIsSending(false);
        setSendProgress(0);
        console.error(err);
        setSendResult('Erro na comunicação com o servidor.');
        setTimeout(() => {
          setSendResult(null);
        }, 3000);
      });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Cabeçalho */}
      <header className="bg-white shadow-lg rounded-2xl p-6 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <img src="/logo_c.png" alt="Logo CoordInforma" className="h-16 w-16 object-contain p-2 bg-gray-100 rounded-xl" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-green-600">CoordInforma</h1>
            <p className="text-gray-500 text-sm md:text-base">Dashboard de Coordenação</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => window.location.href = '/respinforma'} 
            className="p-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
          >
            <i className="fas fa-exchange-alt text-xl"></i>
          </button>
          <button 
            onClick={() => window.location.href = '/logout'} 
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Coordenador</label>
            <select
              value={selectedCoordenador}
              onChange={(e) => setSelectedCoordenador(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
            >
              <option value="">Todos os Coordenadores</option>
              {coordenadores.map((coord, idx) => (
                <option key={idx} value={coord}>{coord}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Botão de Envio e Barra de Progresso */}
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
              ></div>
            </div>
          </div>
        )}
        {sendResult && (
          <div className="mt-2 p-2 bg-green-100 text-green-800 rounded text-center text-sm">
            {sendResult}
          </div>
        )}
      </div>

      {/* Tabela de Dados */}
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
                  <th className="px-1 py-1 text-left font-semibold text-gray-700 w-1/5">Turma</th>
                  <th className="px-1 py-1 text-left font-semibold text-gray-700 w-1/5">Professor</th>
                  <th className="px-1 py-1 text-left font-semibold text-gray-700 w-1/5">Disciplina</th>
                  <th className="px-1 py-1 text-left font-semibold text-gray-700 w-1/5">Data</th>
                  <th className="px-1 py-1 text-left font-semibold text-gray-700 w-1/5">Falta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-1 py-1 text-center text-gray-500">
                      Nenhum dado encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-1 py-1 text-[10px] text-gray-700 break-words">{item.nmturma || '-'}</td>
                      <td className="px-1 py-1 text-[10px] text-gray-700 break-words">{item.professor || '-'}</td>
                      <td className="px-1 py-1 text-[10px] text-gray-700 break-words">{item.disciplina || '-'}</td>
                      <td className="px-1 py-1 text-[10px] text-gray-700 break-words">{item.data || '-'}</td>
                      <td className="px-1 py-1 text-[10px] text-gray-700 break-words">{item.falta || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default CoordInformaPage;
