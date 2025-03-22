const whatsappService = require('../services/whatsappService');
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

exports.sendMessages = async (req, res, next) => {
  const { municipio, dados } = req.body;

  let client;
  try {
    client = whatsappService.getClient();
  } catch (error) {
    console.error('Erro ao obter o cliente do WhatsApp:', error.message);
    return res.status(500).json({ error: 'WhatsApp não está conectado ou indisponível.' });
  }

  if (!client) {
    console.error('Cliente do WhatsApp não está conectado ou indisponível.');
    return res.status(500).json({ error: 'WhatsApp não está conectado ou indisponível.' });
  }
  console.log('Cliente do WhatsApp obtido.');

  if (!dados || !Array.isArray(dados) || dados.length === 0) {
    return res.status(400).json({ error: 'Nenhum dado para envio.' });
  }

  const resultados = [];
  try {
    // Agrupa os dados por telefone com validação extra
    const responsaveis = {};
    dados.forEach((item) => {
      if (!item.telefone) {
        console.error('Item sem campo "telefone":', item);
        return;
      }
      let numero = item.telefone.replace(/\D/g, '');
      if (numero.length < 10) {
        console.error('Telefone com dígitos insuficientes:', item.telefone);
        return;
      }
      if (numero.length === 11) {
        numero = numero.replace(/^(\d{2})9/, '$1');
      }
      // Para Venom-Bot, o sufixo deve ser '@c.us'
      const telefone = numero ? `55${numero}@c.us` : null;
      if (!telefone) {
        console.error(`Telefone inválido para o responsável: ${item.responsavel}`);
        return;
      }
      if (!responsaveis[telefone]) {
        responsaveis[telefone] = [];
      }
      responsaveis[telefone].push(item);
    });

    const telefones = Object.keys(responsaveis);
    console.log(`Total de responsáveis agrupados: ${telefones.length}`);
    for (let i = 0; i < telefones.length; i += 10) {
      const lote = telefones.slice(i, i + 10);
      for (const telefone of lote) {
        const alunoDados = responsaveis[telefone];
        const responsavel = alunoDados[0].responsavel;
        const dataFalta = alunoDados[0].data;
        let mensagem = `📢 *Atenção, ${responsavel}!* 📢\n` +
                       `Aqui é o *Assistente Virtual da Smart4WEB*, com informações sobre os alunos sob sua responsabilidade. 🏫\n\n` +
                       `❌ *Alunos com ausência no dia ${dataFalta}:*\n\n`;
        alunoDados.forEach((aluno) => {
          mensagem += `🎓 *Nome:* ${aluno.aluno}\n` +
                      `📍 *Escola:* ${aluno.escola}\n` +
                      `📚 *Turma:* ${aluno.turma}\n`;
          if (aluno.ocorrencia === "SIM") {
            mensagem += `⚠️ *Ocorrência:* Foi registrada uma ocorrência. Entre em contato com a escola.\n`;
          }
          mensagem += `\n`;
        });
        mensagem += `⚠️ Por favor, entre em contato com as escolas para mais informações.`;

        try {
          console.log(`Enviando mensagem para: ${telefone}`);
          await client.sendText(telefone, mensagem);
          resultados.push({ telefone, status: 'enviado' });
        } catch (sendError) {
          console.error(`Erro ao enviar mensagem para ${telefone}:`, sendError);
          resultados.push({ telefone, status: 'falha', motivo: sendError.message });
        }
      }
      if (i + 10 < telefones.length) {
        console.log('Pausa de 4 segundos antes do próximo lote...');
        await delay(4000);
      }
    }
    res.json({
      success: true,
      message: 'Processo de envio concluído.',
      resultados
    });
  } catch (error) {
    console.error('Erro ao enviar mensagens:', error);
    next(error);
  }
};