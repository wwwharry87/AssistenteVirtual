import React, { useState, useEffect } from 'react';

function MunicipiosDropdown({ onSelect }) {
  const [municipios, setMunicipios] = useState([]);

  useEffect(() => {
    fetch('/api/municipios')
      .then(res => res.json())
      .then(data => setMunicipios(data))
      .catch(err => console.error('Erro ao carregar municípios:', err));
  }, []);

  return (
    <select 
      onChange={(e) => onSelect(e.target.value)}
      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
    >
      <option value="">Selecione um município</option>
      {municipios.map((mun, idx) => (
        <option key={idx} value={mun.nome}>
          {mun.nome}
        </option>
      ))}
    </select>
  );
}

export default MunicipiosDropdown;