const axios = require('axios');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

exports.getDadosCsv = async (req, res) => {
  const { municipio, tipo } = req.query;

  if (!municipio || !tipo) {
    return res.status(400).json({ error: 'Município e tipo são obrigatórios.' });
  }

  // Caminho do arquivo municipio.txt (na pasta data)
  const municipioFilePath = path.join(__dirname, '..', 'data', 'municipio.txt');
  if (!fs.existsSync(municipioFilePath)) {
    return res.status(404).json({ error: 'Arquivo municipio.txt não encontrado.' });
  }

  let municipios = {};
  try {
    const data = fs.readFileSync(municipioFilePath, 'utf-8').trim();
    const linhas = data.split('\n');
    linhas.forEach(linha => {
      const [nome, dTipo, url] = linha.split(';');
      if (!municipios[nome]) {
        municipios[nome] = [];
      }
      municipios[nome].push({
        tipo: parseInt(dTipo, 10),
        url: url.trim()
      });
    });
  } catch (error) {
    console.error('Erro ao ler o arquivo municipio.txt:', error.message);
    return res.status(500).json({ error: 'Erro ao ler o arquivo municipio.txt.' });
  }

  if (!municipios[municipio]) {
    return res.status(404).json({ error: 'Município não encontrado.' });
  }

  const dadosEntry = municipios[municipio].find(entry => entry.tipo === parseInt(tipo, 10));
  if (!dadosEntry) {
    return res.status(404).json({ error: 'Dados para o tipo informado não encontrados para o município.' });
  }

  const results = [];

  // Se a URL começa com "http", é um arquivo remoto
  if (dadosEntry.url.startsWith('http')) {
    try {
      const response = await axios.get(dadosEntry.url, { responseType: 'stream' });
      response.data
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          res.json(results);
        })
        .on('error', (error) => {
          console.error('Erro ao processar o CSV remoto:', error.message);
          res.status(500).json({ error: 'Erro ao processar o CSV remoto.' });
        });
    } catch (error) {
      console.error('Erro ao baixar o CSV remoto:', error.message);
      return res.status(500).json({ error: 'Erro ao baixar o CSV remoto.' });
    }
  } else {
    // Caso seja um caminho de arquivo local
    const csvFilePath = path.join(__dirname, '..', 'data', dadosEntry.url);
    if (!fs.existsSync(csvFilePath)) {
      return res.status(404).json({ error: 'Arquivo CSV não encontrado.' });
    }
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        res.json(results);
      })
      .on('error', (error) => {
        console.error('Erro ao processar o arquivo CSV:', error.message);
        res.status(500).json({ error: 'Erro ao processar o arquivo CSV.' });
      });
  }
};
