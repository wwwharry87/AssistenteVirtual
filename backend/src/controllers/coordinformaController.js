const path = require('path');
const fs = require('fs');
const pdfMake = require('pdfmake');
const moment = require('moment');
// Importa o serviço do Venom-Bot
const whatsappService = require('../services/whatsappService');

const ajustarTelefone = (telefone) => {
    if (!telefone) return null;
    const telefoneLimpo = telefone.replace(/\D/g, '');
    if (telefoneLimpo.length === 11) {
        return `55${telefoneLimpo.replace(/^(\d{2})9/, '$1')}`;
    } else if (telefoneLimpo.length === 10) {
        return `55${telefoneLimpo}`;
    }
    return null;
};

const gerarPDF = async (dados, filePath) => {
    return new Promise((resolve, reject) => {
        const fonts = {
            Roboto: {
                normal: path.join(__dirname, '../fonts/Roboto-Regular.ttf'),
                bold: path.join(__dirname, '../fonts/Roboto-Bold.ttf'),
                italics: path.join(__dirname, '../fonts/Roboto-Italic.ttf'),
                bolditalics: path.join(__dirname, '../fonts/Roboto-BoldItalic.ttf'),
            },
        };

        const printer = new pdfMake(fonts);
        const startOfWeek = moment().subtract(1, 'weeks').startOf('isoWeek').format('DD/MM/YYYY');
        const endOfWeek = moment().subtract(1, 'weeks').endOf('isoWeek').format('DD/MM/YYYY');

        // Assume que todos os registros possuem a mesma escola; se não, use "Escola Desconhecida"
        const escola = dados[0] && dados[0].escola ? dados[0].escola : 'Escola Desconhecida';

        const tableBody = [
            [
                { text: 'Turma', style: 'tableHeader' },
                { text: 'Professor', style: 'tableHeader' },
                { text: 'Disciplina', style: 'tableHeader' },
                { text: 'Data', style: 'tableHeader' },
                { text: 'Faltas', style: 'tableHeader' }
            ]
        ];

        dados.forEach((item) => {
            tableBody.push([
                { text: item.turma || '-', style: 'tableData' },
                { text: item.professor || '-', style: 'tableData' },
                { text: item.disciplina || '-', style: 'tableData' },
                { text: item.data || '-', style: 'tableData' },
                { text: item.falta || '-', style: 'tableData' }
            ]);
        });

        const docDefinition = {
            content: [
                {
                    text: `Escola: ${escola}`,
                    style: 'schoolHeader'
                },
                { text: '\n' },
                {
                    text: `Relatório de Pendências do Diário de Classe\n(Referente ao período de ${startOfWeek} a ${endOfWeek})`,
                    style: 'header'
                },
                { text: '\n\n' },
                {
                    table: {
                        headerRows: 1,
                        widths: ['15%', '30%', '25%', '15%', '15%'],
                        body: tableBody
                    },
                    layout: {
                        fillColor: (rowIndex) => (rowIndex % 2 === 0 ? '#f3f3f3' : null),
                        hLineWidth: () => 0.5,
                        vLineWidth: () => 0.5,
                        hLineColor: () => '#ccc',
                        vLineColor: () => '#ccc'
                    }
                }
            ],
            styles: {
                schoolHeader: {
                    fontSize: 18,
                    bold: true,
                    alignment: 'center',
                    color: '#2E86C1'
                },
                header: {
                    fontSize: 16,
                    bold: true,
                    alignment: 'center'
                },
                tableHeader: {
                    bold: true,
                    fontSize: 12,
                    color: 'white',
                    fillColor: '#4CAF50',
                    alignment: 'center'
                },
                tableData: {
                    fontSize: 9,
                    alignment: 'left'
                }
            },
            defaultStyle: {
                font: 'Roboto'
            }
        };

        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        const stream = fs.createWriteStream(filePath);
        pdfDoc.pipe(stream);
        pdfDoc.end();

        stream.on('finish', resolve);
        stream.on('error', reject);
    });
};

exports.sendMessages = async (req, res, next) => {
    const { municipio, dados } = req.body;

    // Verifica se o cliente do Venom-Bot está pronto
    if (!whatsappService.isClientReady()) {
        return res.status(400).json({
            success: false,
            message: 'Venom-Bot não está conectado. Por favor, conecte antes de enviar mensagens.'
        });
    }

    if (!dados || dados.length === 0) {
        return res.status(400).json({ error: 'Nenhum dado para enviar mensagens.' });
    }

    try {
        const coordenadores = {};
        dados.forEach((item) => {
            const coordenador = item.coordenador || 'Desconhecido';
            if (!coordenadores[coordenador]) {
                coordenadores[coordenador] = [];
            }
            coordenadores[coordenador].push({
                turma: item.nmturma,
                professor: item.professor,
                disciplina: item.disciplina,
                data: item.data,
                falta: item.falta,
                escola: item.escola,
                telefone: item.telefone
            });
        });

        for (const [coordenador, professores] of Object.entries(coordenadores)) {
            const telefone = ajustarTelefone(dados.find((item) => item.coordenador === coordenador)?.telefone);
            if (!telefone) {
                console.warn(`Telefone inválido ou não encontrado para o coordenador ${coordenador}`);
                continue;
            }

            const pdfPath = path.join(__dirname, `../temp/${coordenador.replace(/\s+/g, '_')}.pdf`);
            console.log(`Gerando PDF em: ${pdfPath}`);
            await gerarPDF(professores, pdfPath);

            const message = `Olá *${coordenador}*,\n\n` +
                `Sou o Assistente Virtual da *Smart4WEB*. Segue em anexo o relatório referente à semana anterior.\n` +
                `Por favor, verifique o relatório e, se necessário, entre em contato com o técnico do Município.\n\n` +
                `Atenciosamente,\nSmart4WEB`;

            try {
                const client = whatsappService.getClient();
                await client.sendFile(
                    `${telefone}@c.us`,
                    pdfPath,
                    `${coordenador}.pdf`,
                    message
                );
                console.log(`Mensagem enviada para ${telefone}`);
            } catch (error) {
                console.error(`Erro ao enviar mensagem para ${telefone}:`, error.message);
            } finally {
                fs.unlinkSync(pdfPath);
            }
        }

        res.json({ success: true, message: 'Mensagens enviadas com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar mensagens:', error.message);
        next(error);
    }
};
