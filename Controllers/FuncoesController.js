// Controllers/FuncoesController.js
const FuncoesCRUD = require('./FuncoesCRUD');
const PdfController = require('./PdfController');

/**
 * Helper para formatar moeda
 */
function FuncoesController_formatarMoeda(valor) {
    const numero = Number(valor) || 0;
    return numero.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

/**
 * Gera a Definição de Documento (JSON) para o pdfmake.
 * Substitui o antigo HTML.
 * @param {object} pedido - O objeto do pedido.
 * @returns {object} - O objeto docDefinition para o pdfmake.
 */
function FuncoesController_gerarDocDefinitionParaPedidoPdf(pedido) {
    
    // Cria o corpo da tabela (Array de Arrays)
    // Cabeçalho da tabela
    const tableBody = [
        [
            { text: 'PRODUTO (SUBPRODUTO)', style: 'tableHeader', alignment: 'left' },
            { text: 'UN', style: 'tableHeader', alignment: 'center' },
            { text: 'QTD.', style: 'tableHeader', alignment: 'center' },
            { text: 'VALOR UNIT.', style: 'tableHeader', alignment: 'right' },
            { text: 'VALOR TOTAL', style: 'tableHeader', alignment: 'right' }
        ]
    ];

    // Linhas de dados
    pedido.itens.forEach(item => {
        tableBody.push([
            { text: item.subProduto || '', style: 'tableCell', alignment: 'left' },
            { text: item.un || '', style: 'tableCell', alignment: 'center' },
            { text: Number(item.qtd).toLocaleString('pt-BR'), style: 'tableCell', alignment: 'center' },
            { text: FuncoesController_formatarMoeda(item.valorUnit), style: 'tableCell', alignment: 'right' },
            { text: FuncoesController_formatarMoeda(item.valorTotal), style: 'tableCell', alignment: 'right' }
        ]);
    });

    // Definição completa do documento
    const docDefinition = {
        content: [
            // Título (Nome do Fornecedor)
            { text: pedido.fornecedor, style: 'header' },
            
            // Grid de Informações (Empresa e CNPJ)
            {
                style: 'infoGrid',
                columns: [
                    {
                        width: '*',
                        text: [
                            { text: 'EMPRESA PARA FATURAMENTO:\n', bold: true, color: '#555' },
                            { text: pedido.empresaFaturada || '' }
                        ]
                    },
                    {
                        width: 'auto',
                        text: [
                            { text: 'CNPJ:\n', bold: true, color: '#555' },
                            { text: pedido.cnpj || 'Não informado' }
                        ]
                    }
                ]
            },
            // Condição de Pagamento
            {
                style: 'infoGrid',
                text: [
                    { text: 'CONDIÇÃO DE PAGAMENTO: ', bold: true, color: '#555' },
                    { text: pedido.condicaoPagamento || 'Não informada' }
                ],
                margin: [0, 5, 0, 15]
            },

            // Tabela
            {
                style: 'itensTable',
                table: {
                    headerRows: 1,
                    widths: ['*', 'auto', 'auto', 'auto', 'auto'], // '*' ocupa o resto, 'auto' ajusta ao conteúdo
                    body: tableBody
                },
                layout: {
                    hLineWidth: function (i, node) {
                        return (i === 0 || i === node.table.body.length) ? 1 : 1;
                    },
                    vLineWidth: function (i, node) {
                        return 0;
                    },
                    hLineColor: function (i, node) {
                        return (i === 0 || i === 1) ? '#aaaaaa' : '#eeeeee';
                    },
                    paddingTop: function(i, node) { return 5; },
                    paddingBottom: function(i, node) { return 5; }
                }
            },

            // Total Geral
            {
                text: [
                    { text: 'TOTAL DO PEDIDO: ', bold: true },
                    { text: FuncoesController_formatarMoeda(pedido.totalPedido) }
                ],
                style: 'totalFooter',
                alignment: 'right',
                margin: [0, 15, 0, 0]
            }
        ],
        styles: {
            header: {
                fontSize: 18,
                bold: true,
                margin: [0, 0, 0, 10],
                color: '#222'
            },
            infoGrid: {
                fontSize: 10,
                margin: [0, 2, 0, 2],
                color: '#333'
            },
            tableHeader: {
                bold: true,
                fontSize: 9,
                color: 'black',
                fillColor: '#f3f3f3',
                margin: [0, 3, 0, 3]
            },
            tableCell: {
                fontSize: 10,
                color: '#333'
            },
            totalFooter: {
                fontSize: 14,
                bold: true,
                color: '#000'
            }
        },
        defaultStyle: {
            font: 'Roboto' // Importante: deve bater com a config do PdfController
        }
    };

    return docDefinition;
}

// --- Rotas do Controller ---

async function FuncoesController_obterDadosGerenciarCotacoes(req, res) {
    try {
        const dados = await FuncoesCRUD.getDadosGerenciarCotacoes(req.sheets, req.ID_PLANILHA_PRINCIPAL);
        res.json({ success: true, dados: dados });
    } catch (e) {
        console.error("ERRO em obterDadosGerenciarCotacoes:", e);
        res.status(500).json({ success: false, message: e.message });
    }
}

async function FuncoesController_excluirFornecedoresDeCotacaoPortal(req, res) {
    try {
        const { idCotacao, nomesFornecedores } = req.body;
        if (!idCotacao || !Array.isArray(nomesFornecedores) || nomesFornecedores.length === 0) {
            return res.status(400).json({ success: false, message: "ID da Cotação e lista de Nomes dos Fornecedores são obrigatórios." });
        }

        const promises = nomesFornecedores.map(nomeFornecedor =>
            FuncoesCRUD.excluirFornecedorDaCotacaoPortal(req.sheets, req.ID_PLANILHA_PRINCIPAL, idCotacao, nomeFornecedor)
        );
        
        const results = await Promise.allSettled(promises);
        const sucessoCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const falhaCount = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

        if (falhaCount > 0) {
             const erros = results
                .filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success))
                .map(r => r.status === 'rejected' ? r.reason.message : r.value.message)
                .join('; ');
            throw new Error(`Falha ao excluir ${falhaCount} fornecedor(es): ${erros}`);
        }

        res.json({ success: true, message: `${sucessoCount} fornecedor(es) excluído(s) com sucesso.` });
    } catch (e) {
        console.error("ERRO em excluirFornecedoresDeCotacaoPortal:", e);
        res.status(500).json({ success: false, message: e.message });
    }
}

async function FuncoesController_salvarTextoGlobalCotacaoPortal(req, res) {
    try {
        const { idCotacao, textoPersonalizado } = req.body;
        if (!idCotacao) {
            return res.status(400).json({ success: false, message: "ID da Cotação é obrigatório." });
        }
        const resultado = await FuncoesCRUD.salvarTextoGlobalCotacaoPortal(req.sheets, req.ID_PLANILHA_PRINCIPAL, idCotacao, textoPersonalizado);
        res.json(resultado);
    } catch (e) {
        console.error("ERRO em salvarTextoGlobalCotacaoPortal:", e);
        res.status(500).json({ success: false, message: e.message });
    }
}

async function FuncoesController_preencherUltimosPrecos(req, res) {
    try {
        const { idCotacao } = req.body;
        if (!idCotacao) {
            return res.status(400).json({ success: false, message: "ID da Cotação não fornecido." });
        }
        const resultado = await FuncoesCRUD.preencherUltimosPrecos(req.sheets, req.ID_PLANILHA_PRINCIPAL, idCotacao);
        res.json(resultado);
    } catch (e) {
        console.error("ERRO em preencherUltimosPrecos:", e);
        res.status(500).json({ success: false, message: e.message });
    }
}

async function FuncoesController_gerarPdfsEnvioManual(req, res) {
    try {
        const { idCotacao } = req.body;
        if (!idCotacao) {
            return res.status(400).json({ success: false, message: "ID da Cotação não fornecido." });
        }

        const dadosAgrupados = await FuncoesCRUD.obterDadosParaImpressaoManual(req.sheets, req.ID_PLANILHA_PRINCIPAL, idCotacao);

        if (!dadosAgrupados || Object.keys(dadosAgrupados).length === 0) {
            return res.json({ success: true, dados: [], message: "Nenhum pedido com itens a comprar foi encontrado." });
        }

        // Pega a URL base ou localhost
        const baseUrl = process.env.BASE_URL || 'http://localhost:8080';

        const linksGeradosPromises = [];
        for (const nomeFornecedor in dadosAgrupados) {
            const pedidosDoFornecedor = dadosAgrupados[nomeFornecedor];
            
            for (const pedido of pedidosDoFornecedor) {
                const promise = (async () => {
                    try {
                        const fornSafe = pedido.fornecedor.replace(/[^a-zA-Z0-9]/g, '_');
                        const empSafe = pedido.empresaFaturada.replace(/[^a-zA-Z0-9]/g, '_');
                        const nomeArquivo = `Pedido-${idCotacao}-${fornSafe}-${empSafe}.pdf`;
                        
                        const docDefinition = FuncoesController_gerarDocDefinitionParaPedidoPdf(pedido);
                        
                        // O PdfController agora retorna o TOKEN CRIPTOGRAFADO
                        const tokenSeguro = await PdfController.generateAndUploadPdf(docDefinition, nomeArquivo);

                        // Montamos o link com o token
                        // Ex: https://seu-site.com/pedido/a8f9s8d7f98sd7f98sd7f...
                        const linkComToken = `${baseUrl}/pedido/${tokenSeguro}`;

                        return {
                            fornecedor: pedido.fornecedor,
                            empresaFaturada: pedido.empresaFaturada,
                            valorTotal: pedido.totalPedido,
                            linkPdf: linkComToken, // Envia o link bonito e seguro
                            numeroCotacao: idCotacao,
                            condicaoPagamento: pedido.condicaoPagamento || 'Não informada',
                            totalPedido: pedido.totalPedido,
                            itens: pedido.itens
                        };
                    } catch (pdfError) {
                        console.error(`Falha ao gerar PDF para ${pedido.fornecedor}: ${pdfError.message}`);
                        return null;
                    }
                })();
                linksGeradosPromises.push(promise);
            }
        }

        const resultados = await Promise.all(linksGeradosPromises);
        const dadosParaCliente = resultados.filter(r => r !== null);

        res.json({
            success: true,
            dados: dadosParaCliente,
            message: `${dadosParaCliente.length} PDF(s) gerados. Links seguros criados.`
        });

    } catch (e) {
        console.error("ERRO em gerarPdfsEnvioManual:", e);
        res.status(500).json({ success: false, message: e.message });
    }
}

module.exports = {
    obterDadosGerenciarCotacoes: FuncoesController_obterDadosGerenciarCotacoes,
    excluirFornecedoresDeCotacaoPortal: FuncoesController_excluirFornecedoresDeCotacaoPortal,
    salvarTextoGlobalCotacaoPortal: FuncoesController_salvarTextoGlobalCotacaoPortal,
    preencherUltimosPrecos: FuncoesController_preencherUltimosPrecos,
    gerarPdfsEnvioManual: FuncoesController_gerarPdfsEnvioManual
};