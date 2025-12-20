const fs = require('fs');
const path = require('path');
const PdfPrinter = require('pdfmake');

const whatsappService = require('../services/whatsappService');
const {
  uploadMediaFromBuffer,
  sendDocument,
  sendTemplateAvisoFaltas,
  sendTemplateDocHeaderSafe,
  delay
} = require('../services/whatsappCloud');

// ===== Config =====
const MAX_INLINE     = 5;
const TEMPLATE_DOC   = 'aviso_faltas_multi_doc_v1';

// ===== Temp dir =====
const TEMP_DIR = path.join(__dirname, '..', 'temp');
function ensureTempDir() {
  try { if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true }); } catch {}
}

// ===== Utils =====
function toE164BR(raw) { return whatsappService.toE164(raw); }

function sanitizeParam(text) {
  return String(text ?? '')
    .replace(/[\r\n\t]+/g, ' | ')
    .replace(/ {5,}/g, '    ')
    .trim();
}

function asciiSafe(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 80) || 'arquivo';
}

function montarListaInline(alunos) {
  const partes = alunos.map((a) => {
    const nome  = a.aluno || '-';
    const turma = a.turma ? ` (${a.turma})` : '';
    const ocorr = a.ocorrencia === 'SIM' ? ' - Ocorrência: SIM' : '';
    return `• ${nome}${turma}${ocorr}`;
  });
  const SEP = ' | ', MAX = 1000;
  let texto = '', cortados = 0;
  for (let i = 0; i < partes.length; i++) {
    const cand = texto ? `${texto}${SEP}${partes[i]}` : partes[i];
    if (cand.length <= MAX) texto = cand; else { cortados = partes.length - i; break; }
  }
  if (cortados > 0) texto += ` | (+${cortados} mais)`;
  return sanitizeParam(texto);
}

// ===== PDF em arquivo =====
async function gerarPdfEmArquivo({ municipio, responsavel, periodo, alunos }) {
  ensureTempDir();

  const fonts = {
    Helvetica: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    }
  };
  const printer = new PdfPrinter(fonts);

  const rows = [
    [{ text: 'Aluno', bold: true }, { text: 'Escola', bold: true }, { text: 'Turma', bold: true }, { text: 'Ocorrência', bold: true }],
    ...alunos.map(a => ([
      a.aluno || '-',
      a.escola || '-',
      a.turma || '-',
      a.ocorrencia === 'SIM' ? 'SIM' : '-'
    ]))
  ];

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [36, 48, 36, 48],
    defaultStyle: { font: 'Helvetica', fontSize: 9, lineHeight: 1.15 },
    content: [
      { text: 'Relatório de Faltas', style: 'h1' },
      {
        columns: [
          { text: `Responsável: ${responsavel || '-'}` },
          { text: `Período/Data: ${periodo || '-'}`, alignment: 'right' }
        ],
        margin: [0, 4, 0, 2]
      },
      { text: `Município: ${municipio || '-'}`, margin: [0, 0, 0, 8], color: '#555' },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 1 }] },
      { text: 'Detalhamento', style: 'h2', margin: [0, 10, 0, 6] },
      {
        table: {
          headerRows: 1,
          widths: ['*', '*', 80, 80],
          body: rows
        },
        layout: {
          fillColor: (row) => (row === 0 ? '#F3F4F6' : null),
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#e5e7eb',
          vLineColor: () => '#e5e7eb',
        }
      },
      { text: 'Observação: Este relatório é informativo e visa apoiar o acompanhamento da frequência.', margin: [0, 8, 0, 0], italics: true, color: '#666' }
    ],
    styles: {
      h1: { fontSize: 14, bold: true, alignment: 'center', margin: [0, 0, 0, 6] },
      h2: { fontSize: 11, bold: true }
    },
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: `Gerado em ${new Date().toLocaleString()}`, color: '#777' },
        { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', color: '#777' }
      ],
      margin: [36, 8, 36, 0],
      fontSize: 8
    })
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  const safeResp = asciiSafe(responsavel || 'Responsavel');
  const filename = `Relatorio_Faltas_${safeResp}_${Date.now()}.pdf`;
  const filePath = path.join(TEMP_DIR, filename);

  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(filePath);
    pdfDoc.pipe(stream);
    pdfDoc.on('error', reject);
    stream.on('finish', resolve);
    stream.on('error', reject);
    pdfDoc.end();
  });

  const stats = fs.statSync(filePath);
  console.log('[RespInforma] PDF criado:', filePath, 'size=', stats.size, 'bytes');
  if (!stats.size) throw new Error('PDF gerado com 0 bytes');

  return { filePath, filename, size: stats.size };
}

// ===== Controller =====
exports.sendMessages = async (req, res, next) => {
  try {
    const { municipio, dados, templateVars } = req.body;

    if (!whatsappService.isClientReady()) {
      return res.status(503).json({
        error: 'WhatsApp Cloud API não configurado. Verifique WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID.'
      });
    }
    if (!Array.isArray(dados) || !dados.length) {
      return res.status(400).json({ error: 'Nenhum dado para envio.' });
    }

    // Agrupa por telefone
    const porTelefone = {};
    for (const item of dados) {
      if (!item?.telefone) continue;
      const e164 = toE164BR(item.telefone);
      if (!e164) continue;
      if (!porTelefone[e164]) porTelefone[e164] = [];
      porTelefone[e164].push(item);
    }

    const telefones = Object.keys(porTelefone);
    if (!telefones.length) {
      return res.status(400).json({ error: 'Nenhum telefone válido para envio.' });
    }

    const resultados = [];

    for (let i = 0; i < telefones.length; i += 5) { // Reduzi lote para 5
      const lote = telefones.slice(i, i + 5);

      for (const e164 of lote) {
        const alunoDados   = porTelefone[e164];
        const totalAlunos  = alunoDados.length;

        const v1_responsavel = sanitizeParam(alunoDados[0]?.responsavel || 'Responsável');
        const periodoBruto   = sanitizeParam(alunoDados[0]?.data || '');
        const v2_periodoFrase = periodoBruto ? `em ${periodoBruto}` : '';

        let tempFilePath = null;
        let tempFilename = null;

        try {
          console.log(`[RespInforma] Processando ${e164} com ${totalAlunos} alunos`);

          // 1) Gera e salva PDF
          const { filePath, filename, size } = await gerarPdfEmArquivo({
            municipio,
            responsavel: v1_responsavel,
            periodo: periodoBruto,
            alunos: alunoDados
          });
          tempFilePath = filePath;
          tempFilename = filename;

          // 2) Lê e sobe o PDF
          const buffer = fs.readFileSync(tempFilePath);
          console.log('[RespInforma] PDF lido, tamanho:', buffer.length, 'bytes');

          const media = await uploadMediaFromBuffer(buffer, 'application/pdf', tempFilename);
          console.log('[RespInforma] Upload realizado, media.id:', media?.id);

          if (totalAlunos <= MAX_INLINE) {
            // === até 5 alunos → template MULTI (3 vars) + documento separado ===
            const v3_lista = montarListaInline(alunoDados);

            let params3;
            if (Array.isArray(templateVars) && templateVars.length) {
              params3 = templateVars.map(sanitizeParam).slice(0, 3);
              while (params3.length < 3) params3.push('');
            } else {
              params3 = [v1_responsavel, periodoBruto, v3_lista];
            }

            console.log(`[RespInforma] Enviando template multi para ${e164}`);
            const respTpl = await sendTemplateAvisoFaltas(e164, {
              responsavel: params3[0],
              periodo: params3[1],
              lista: params3[2],
            });
            console.log('[RespInforma] Template enviado, aguardando 3s...');

            await delay(3000); // Aumentei para 3 segundos
            console.log(`[RespInforma] Enviando documento separado para ${e164}`);
            const respDoc = await sendDocument(e164, media.id, 'Relatório detalhado em anexo.', tempFilename);
            console.log('[RespInforma] Documento enviado com sucesso');

            resultados.push({ telefone: e164, status: 'enviado', messageId: respTpl?.messages?.[0]?.id || null });

          } else {
            // === 6+ alunos → header=DOCUMENT (fallback automático) + cópia garantida ===
            let params2;
            if (Array.isArray(templateVars) && templateVars.length) {
              params2 = templateVars.map(sanitizeParam).slice(0, 2);
              while (params2.length < 2) params2.push('');
            } else {
              params2 = [v1_responsavel, v2_periodoFrase];
            }

            console.log(`[RespInforma] Enviando template com header=Document para ${e164}`);
            const respTpl = await sendTemplateDocHeaderSafe(e164, {
              templateName: TEMPLATE_DOC,
              mediaId: media.id,
              filename: tempFilename,
              bodyParams: params2
            });
            console.log('[RespInforma] Template com header enviado');

            // 📎 CÓPIA GARANTIDA (controlada por env)
            const FORCE_COPY = String(process.env.WABA_FORCE_DOCUMENT_COPY || 'true').toLowerCase() === 'true';
            if (FORCE_COPY) {
              console.log(`[RespInforma] Enviando cópia de segurança do documento para ${e164}`);
              await delay(3000); // Aumentei para 3 segundos
              const respDoc = await sendDocument(e164, media.id, 'Relatório detalhado em anexo.', tempFilename);
              console.log('[RespInforma] Cópia de segurança enviada');
            }

            resultados.push({ telefone: e164, status: 'enviado', messageId: respTpl?.messages?.[0]?.id || null });
          }

          await delay(1000); // Delay entre mensagens do mesmo telefone
        } catch (err) {
          const apiErr = err?.response?.data || err?.message || String(err);
          console.error(`[RespInforma] Falha ao enviar para ${e164}:`, apiErr);
          resultados.push({ telefone: e164, status: 'falha', motivo: apiErr });
        } finally {
          try {
            if (tempFilePath && fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
              console.log(`[RespInforma] Arquivo temporário removido: ${tempFilePath}`);
            }
          } catch (cleanErr) {
            console.warn(`[RespInforma] Erro ao remover arquivo temporário:`, cleanErr);
          }
        }
      }

      // Delay entre lotes maior
      if (i + 5 < telefones.length) {
        console.log(`[RespInforma] Aguardando 5s antes do próximo lote...`);
        await delay(5000);
      }
    }

    const enviados = resultados.filter(r => r.status === 'enviado').length;
    const falhas   = resultados.length - enviados;

    return res.json({
      success: true,
      message: `Processo concluído • Enviados: ${enviados} • Falhas: ${falhas}`,
      resultados
    });
  } catch (error) {
    console.error('[RespInforma] Erro geral:', error);
    return next(error);
  }
};