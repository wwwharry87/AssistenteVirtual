// backend/src/controllers/coordinformaController.js
const PdfPrinter = require('pdfmake');
const moment = require('moment');

const whatsappService = require('../services/whatsappService');
const {
  uploadMediaFromBuffer,
  sendTemplateDocHeaderSafe,
  sendDocument,
  delay
} = require('../services/whatsappCloud');

// ===== Config =====
const TEMPLATE_COORD_DOC = 'pendencias_diario_doc_v2';
const FORCE_COPY = String(process.env.WABA_FORCE_DOCUMENT_COPY || 'true').toLowerCase() === 'true';
const TEMPLATE_LANG = process.env.WABA_TEMPLATE_LANG || 'pt_BR';

// ===== Utils =====
function toE164BR(raw) { return whatsappService.toE164(raw); }
function sanitizeParam(text) {
  return String(text ?? '').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
}
function getPeriodoSemanaAnteriorSegSex() {
  const seg = moment().subtract(1, 'week').startOf('isoWeek');
  const sex = seg.clone().add(4, 'days');
  return `${seg.format('DD/MM/YYYY')} a ${sex.format('DD/MM/YYYY')}`;
}
function formatEscolasHeader(escolasArr, maxLen = 150) {
  const lista = (escolasArr || []).map(sanitizeParam).filter(Boolean);
  if (!lista.length) return '-';
  const full = lista.join(', ');
  if (full.length <= maxLen) return full;
  let out = ''; let count = 0;
  for (const nome of lista) {
    const cand = out ? `${out}, ${nome}` : nome;
    if (cand.length > maxLen) break;
    out = cand; count++;
  }
  const restantes = lista.length - count;
  return restantes > 0 ? `${out} +${restantes}` : out;
}
function groupBy(arr, key) {
  const map = new Map();
  for (const it of arr || []) {
    const k = sanitizeParam(it?.[key] || '-');
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(it);
  }
  return map;
}

// ===== PDF =====
async function gerarPdfPendencias({ escolasHeader, periodo, linhas }) {
  const fonts = {
    Helvetica: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    }
  };
  const printer = new PdfPrinter(fonts);

  const headerRow = [
    { text: 'Turma', bold: true },
    { text: 'Professor', bold: true },
    { text: 'Disciplina', bold: true },
    { text: 'Data', bold: true, alignment: 'center' },
    { text: 'Faltas', bold: true, alignment: 'center' },
  ];

  const grupos = groupBy(linhas, 'escola');
  const blocos = [];
  for (const [escola, items] of grupos.entries()) {
    const body = [headerRow].concat(
      (items || []).map(item => ([
        sanitizeParam(item.nmturma || '-'),
        sanitizeParam(item.professor || '-'),
        sanitizeParam(item.disciplina || '-'),
        { text: sanitizeParam(item.data || '-'), alignment: 'center', noWrap: true },
        { text: sanitizeParam(item.falta || '-'), alignment: 'center', noWrap: true },
      ]))
    );
    blocos.push(
      { text: escola, style: 'h2', margin: [0, 10, 0, 6] },
      {
        table: { headerRows: 1, widths: [140, 190, 200, 90, 110], body },
        layout: {
          fillColor: (row) => (row === 0 ? '#F3F4F6' : row % 2 === 0 ? null : '#FBFBFB'),
          hLineWidth: (i) => (i === 1 ? 1 : 0.5),
          vLineWidth: () => 0.5,
          hLineColor: () => '#e5e7eb',
          vLineColor: () => '#e5e7eb',
          paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 4, paddingBottom: () => 4,
        }
      }
    );
  }

  const docDefinition = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [28, 36, 28, 36],
    defaultStyle: { font: 'Helvetica', fontSize: 9, lineHeight: 1.1 },
    content: [
      { text: 'Relatório de Pendências do Diário de Classe', style: 'h1' },
      {
        columns: [
          { text: `Escola(s): ${sanitizeParam(escolasHeader || '-')}` },
          { text: `Período: ${sanitizeParam(periodo || '-')}`, alignment: 'right' },
        ],
        margin: [0, 6, 0, 8],
      },
      ...blocos,
      { text: 'Este relatório visa apoiar o acompanhamento pedagógico.', margin: [0, 10, 0, 0], italics: true, color: '#666' }
    ],
    styles: {
      h1: { fontSize: 13, bold: true, alignment: 'center', margin: [0, 0, 0, 4] },
      h2: { fontSize: 11, bold: true, color: '#111827' }
    },
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: `Gerado em ${new Date().toLocaleString()}`, color: '#777' },
        { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', color: '#777' }
      ],
      margin: [28, 6, 28, 0],
      fontSize: 8
    })
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  const chunks = [];
  return await new Promise((resolve, reject) => {
    pdfDoc.on('data', (c) => chunks.push(c));
    pdfDoc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const safeHeader = String(escolasHeader || 'Escola').replace(/[^\p{L}\p{N}\s._-]/gu, '').substring(0, 60) || 'MULTI';
      const filename = `Pendencias_Diario_${safeHeader}_${Date.now()}.pdf`;
      resolve({ buffer, filename });
    });
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}

// ===== Controller =====
exports.sendMessages = async (req, res, next) => {
  try {
    const { municipio, dados, periodo } = req.body;

    if (!whatsappService.isClientReady()) {
      return res.status(503).json({
        error: 'WhatsApp Cloud API não configurado. Verifique WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID.'
      });
    }
    if (!Array.isArray(dados) || dados.length === 0) {
      return res.status(400).json({ error: 'Nenhum dado para envio.' });
    }

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

    const periodoPadrao = getPeriodoSemanaAnteriorSegSex();
    const periodoFinal = sanitizeParam(periodo || periodoPadrao);

    const resultados = [];

    for (let i = 0; i < telefones.length; i += 5) { // Reduzi lote para 5
      const lote = telefones.slice(i, i + 5);

      for (const e164 of lote) {
        const linhas = porTelefone[e164] || [];
        const escolasList = Array.from(new Set(linhas.map(l => sanitizeParam(l.escola)).filter(Boolean)));
        const escolasHeader = formatEscolasHeader(escolasList);

        try {
          console.log(`[CoordInforma] Processando ${e164} com ${linhas.length} linhas`);

          // 1) PDF + upload
          const { buffer, filename } = await gerarPdfPendencias({ escolasHeader, periodo: periodoFinal, linhas });
          if (!buffer?.length) throw new Error('PDF vazio');
          
          console.log(`[CoordInforma] PDF gerado, tamanho: ${buffer.length} bytes`);
          const media = await uploadMediaFromBuffer(buffer, 'application/pdf', filename);
          console.log('[CoordInforma] Upload realizado, media.id:', media?.id);

          // 2) Template com header=Document
          console.log(`[CoordInforma] Enviando template com header=Document para ${e164}`);
          const resp = await sendTemplateDocHeaderSafe(e164, {
            templateName: TEMPLATE_COORD_DOC,
            mediaId: media.id,
            filename,
            language: TEMPLATE_LANG,
            bodyParams: [ escolasHeader, periodoFinal ]
          });
          console.log('[CoordInforma] Template enviado com sucesso');

          // 3) Fallback opcional: mandar também o DOC separado
          if (FORCE_COPY) {
            console.log(`[CoordInforma] Enviando cópia de segurança do documento para ${e164}`);
            await delay(3000); // Aumentei para 3 segundos
            const caption = 'Relatório detalhado em anexo.';
            const respDoc = await sendDocument(e164, media.id, caption, filename);
            console.log('[CoordInforma] Cópia de segurança enviada');
          }

          resultados.push({ telefone: e164, status: 'enviado', messageId: resp?.messages?.[0]?.id || null });
          await delay(1000); // Delay entre mensagens do mesmo telefone
        } catch (err) {
          const apiErr = err?.response?.data || err?.message || String(err);
          console.error(`[CoordInforma] Falha ao enviar para ${e164}:`, apiErr);
          resultados.push({ telefone: e164, status: 'falha', motivo: apiErr });
        }
      }

      // Delay entre lotes maior
      if (i + 5 < telefones.length) {
        console.log(`[CoordInforma] Aguardando 5s antes do próximo lote...`);
        await delay(5000);
      }
    }

    const enviados = resultados.filter(r => r.status === 'enviado').length;
    const falhas   = resultados.length - enviados;

    return res.json({ success: true, message: `Processo concluído • Enviados: ${enviados} • Falhas: ${falhas}`, resultados });
  } catch (error) {
    console.error('[CoordInforma] Erro geral:', error);
    return next(error);
  }
};