const axios = require('axios');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { uploadedCsvExists, getCsvPath } = require('./csvStorageController');

function uploadedLocationFromConfiguredUrl(url) {
  try {
    // Exemplo atual:
    // .../arquivos/upload/1130/geral/numbers.csv
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/upload\/(\d+)\/geral\/(numbers|responsavel)\.csv$/i);
    if (!match) return null;
    return {
      codigo: match[1],
      arquivo: `${match[2].toLowerCase()}.csv`
    };
  } catch (_) {
    return null;
  }
}

function parseCsvStream(stream, res, errorLabel) {
  const results = [];
  stream
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => res.json(results))
    .on('error', (error) => {
      console.error(errorLabel, error.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erro ao processar o arquivo CSV.' });
      }
    });
}

exports.getDadosCsv = async (req, res) => {
  const { municipio, tipo } = req.query;

  if (!municipio || !tipo) {
    return res.status(400).json({ error: 'Município e tipo são obrigatórios.' });
  }

  const municipioFilePath = path.join(__dirname, '..', 'data', 'municipio.txt');
  if (!fs.existsSync(municipioFilePath)) {
    return res.status(404).json({ error: 'Arquivo municipio.txt não encontrado.' });
  }

  const municipios = {};
  try {
    const data = fs.readFileSync(municipioFilePath, 'utf-8').trim();
    const linhas = data.split('\n');
    linhas.forEach((linha) => {
      const [nome, dTipo, url] = linha.split(';');
      if (!municipios[nome]) municipios[nome] = [];
      municipios[nome].push({
        tipo: parseInt(dTipo, 10),
        url: (url || '').trim()
      });
    });
  } catch (error) {
    console.error('Erro ao ler o arquivo municipio.txt:', error.message);
    return res.status(500).json({ error: 'Erro ao ler o arquivo municipio.txt.' });
  }

  if (!municipios[municipio]) {
    return res.status(404).json({ error: 'Município não encontrado.' });
  }

  const dadosEntry = municipios[municipio].find((entry) => entry.tipo === parseInt(tipo, 10));
  if (!dadosEntry) {
    return res.status(404).json({ error: 'Dados para o tipo informado não encontrados para o município.' });
  }

  // Compatibilidade de transição:
  // se já chegou um CSV pela nova rota, ele tem prioridade.
  // Se a instância reiniciou e o temporário sumiu, mantém fallback para a URL antiga do S3.
  if (dadosEntry.url.startsWith('http')) {
    const uploaded = uploadedLocationFromConfiguredUrl(dadosEntry.url);
    if (uploaded && uploadedCsvExists(uploaded.codigo, uploaded.arquivo)) {
      const localPath = getCsvPath(uploaded.codigo, uploaded.arquivo);
      return parseCsvStream(
        fs.createReadStream(localPath),
        res,
        'Erro ao processar o CSV temporário:'
      );
    }

    try {
      const response = await axios.get(dadosEntry.url, { responseType: 'stream' });
      return parseCsvStream(response.data, res, 'Erro ao processar o CSV remoto:');
    } catch (error) {
      console.error('Erro ao baixar o CSV remoto:', error.message);
      return res.status(500).json({ error: 'Erro ao baixar o CSV remoto.' });
    }
  }

  const csvFilePath = path.join(__dirname, '..', 'data', dadosEntry.url);
  if (!fs.existsSync(csvFilePath)) {
    return res.status(404).json({ error: 'Arquivo CSV não encontrado.' });
  }

  return parseCsvStream(
    fs.createReadStream(csvFilePath),
    res,
    'Erro ao processar o arquivo CSV:'
  );
};
