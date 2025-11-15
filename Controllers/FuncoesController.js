// controllers/FuncoesController.js
// Lógica de negócios para o módulo "Funções".
// *** VERSÃO CORRIGIDA: Implementa geração de PDF com Puppeteer ***

const FuncoesCRUD = require('./FuncoesCRUD');
const PdfController = require('./PdfController'); // Importa o novo controller de PDF

/**
 * (Migrado de FuncoesController_obterDadosGerenciarCotacoes)
 * Obtém dados das cotações e seus fornecedores da aba Portal.
 */
async function obterDadosGerenciarCotacoes(req, res) {
    try {
        const dados = await FuncoesCRUD.getDadosGerenciarCotacoes(req.sheets, req.ID_PLANILHA_PRINCIPAL);
        res.json({ success: true, dados: dados });
    } catch (e) {
        console.error("ERRO em obterDadosGerenciarCotacoes:", e);
        res.status(500).json({ success: false, message: e.message });
    }
}

/**
 * (Migrado de FuncoesController_excluirFornecedoresDeCotacaoPortal)
 * Exclui uma lista de fornecedores de uma cotação na aba Portal.
 */
async function excluirFornecedoresDeCotacaoPortal(req, res) {
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

/**
 * (Migrado de FuncoesController_salvarTextoGlobalCotacaoPortal)
 * Salva o texto personalizado GLOBAL para uma cotação na aba Portal.
 */
async function salvarTextoGlobalCotacaoPortal(req, res) {
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

/**
 * (Migrado de FuncoesController_preencherUltimosPrecos)
 * Preenche os últimos preços em uma cotação.
 */
async function preencherUltimosPrecos(req, res) {
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

// =========================================================================
// FUNÇÃO DE GERAÇÃO DE PDF (LÓGICA REVERTIDA CONFORME SOLICITADO)
// =========================================================================

/**
 * Helper para formatar moeda (usado no HTML do PDF)
 */
function formatarMoeda(valor) {
    const numero = Number(valor) || 0;
    return numero.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

/**
 * Helper para gerar o HTML de um pedido (baseado no FuncoesCRUD.js do Apps Script)
 * @param {object} pedido - O objeto do pedido.
 * @returns {string} - O HTML completo para o PDF.
 */
function _gerarHtmlParaPedidoPdf(pedido) {
    let itensHtml = '';
    pedido.itens.forEach(item => {
        itensHtml += `
          <tr>
            <td>${item.subProduto}</td>
            <td class="col-un">${item.un}</td>
            <td class="col-qtd">${item.qtd}</td>
            <td class="col-valor">${formatarMoeda(item.valorUnit)}</td>
            <td class="col-valor">${formatarMoeda(item.valorTotal)}</td>
          </tr>
        `;
    });

    // Estilos CSS inline são mais confiáveis em HTML-para-PDF
    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Helvetica', 'Arial', sans-serif; color: #333; font-size: 10pt; }
          .pedido-container { border: 1px solid #ccc; padding: 20px; margin: 20px; }
          .pedido-header-fornecedor { border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 10px; }
          h2 { font-size: 16pt; margin: 0 0 10px 0; color: #000; }
          .info-grid { font-size: 9pt; }
          .info-grid p { margin: 4px 0; }
          .info-grid strong { font-weight: bold; color: #444; }
          .itens-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .itens-table th { background-color: #f2f2f2; padding: 8px; text-align: left; font-size: 8pt; text-transform: uppercase; border-bottom: 1px solid #ccc; }
          .itens-table td { padding: 8px; border-bottom: 1px solid #ddd; }
          .col-un, .col-qtd { text-align: center; }
          .col-valor { text-align: right; }
          .total-pedido-footer { margin-top: 15px; text-align: right; font-size: 12pt; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="pedido-container">
          <div class="pedido-header-fornecedor">
            <h2>${pedido.fornecedor}</h2>
            <div class="info-grid">
              <p><strong>EMPRESA PARA FATURAMENTO:</strong> ${pedido.empresaFaturada}</p>
              <p><strong>CNPJ:</strong> ${pedido.cnpj || 'Não informado'}</p>
              <p><strong>CONDIÇÃO DE PAGAMENTO:</strong> ${pedido.condicaoPagamento || 'Não informada'}</p>
            </div>
          </div>
          <table class="itens-table">
            <thead>
              <tr>
                <th>PRODUTO (SUBPRODUTO)</th>
                <th class="col-un">UN</th>
                <th class="col-qtd">QTD.</th>
                <th class="col-valor">VALOR UNIT.</th>
                <th class="col-valor">VALOR TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${itensHtml}
            </tbody>
          </table>
          <div class="total-pedido-footer">
            TOTAL DO PEDIDO: ${formatarMoeda(pedido.totalPedido)}
          </div>
        </div>
      </body>
    </html>
  `;
    return html;
}

/**
 * (Substitui EtapasController_gerarDadosParaEnvioManual)
 * Busca os dados dos pedidos, GERA ARQUIVOS PDF REAIS e retorna os links.
 */
async function gerarPdfsEnvioManual(req, res) {
    try {
        const { idCotacao } = req.body;
        if (!idCotacao) {
            return res.status(400).json({ success: false, message: "ID da Cotação não fornecido." });
        }

        // 1. Busca os dados dos pedidos (do EtapasCRUD.js que você já migrou)
        const dadosAgrupados = await FuncoesCRUD.obterDadosParaImpressaoManual(req.sheets, req.ID_PLANILHA_PRINCIPAL, idCotacao);

        if (!dadosAgrupados || Object.keys(dadosAgrupados).length === 0) {
            return res.json({ success: true, dados: [], message: "Nenhum pedido com itens a comprar foi encontrado." });
        }

        // 2. Processa todos os pedidos em paralelo
        const linksGeradosPromises = [];
        for (const nomeFornecedor in dadosAgrupados) {
            const pedidosDoFornecedor = dadosAgrupados[nomeFornecedor];
            
            for (const pedido of pedidosDoFornecedor) {
                // Para cada pedido, iniciamos uma promessa de geração de PDF
                const promise = (async () => {
                    try {
                        // Define um nome de arquivo único
                        const nomeArquivo = `Pedido-${idCotacao}-${pedido.fornecedor.replace(/[^a-zA-Z0-9]/g, '_')}-${pedido.empresaFaturada.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
                        
                        // Gera o HTML
                        const htmlPedido = _gerarHtmlParaPedidoPdf(pedido);
                        
                        // Chama o PdfController para gerar e salvar o arquivo
                        const urlRelativaPdf = await PdfController.generatePdfFromHtml(htmlPedido, nomeArquivo);

                        // Retorna o objeto completo para o cliente
                        return {
                            fornecedor: pedido.fornecedor,
                            empresaFaturada: pedido.empresaFaturada,
                            valorTotal: pedido.totalPedido,
                            linkPdf: urlRelativaPdf, // Esta é a URL que o cliente usará
                            numeroCotacao: idCotacao,
                            condicaoPagamento: pedido.condicaoPagamento || 'Não informada',
                            totalPedido: pedido.totalPedido
                        };
                    } catch (pdfError) {
                        console.error(`Falha ao gerar PDF para ${pedido.fornecedor}: ${pdfError.message}`);
                        return null; // Retorna null em caso de falha neste PDF específico
                    }
                })();
                linksGeradosPromises.push(promise);
            }
        }

        // 3. Aguarda todos os PDFs serem gerados
        const resultados = await Promise.all(linksGeradosPromises);
        const dadosParaCliente = resultados.filter(r => r !== null); // Filtra os que falharam

        res.json({
            success: true,
            dados: dadosParaCliente,
            message: `${dadosParaCliente.length} PDF(s) de pedido processados com sucesso.`
        });

    } catch (e) {
        console.error("ERRO em gerarPdfsEnvioManual:", e);
        res.status(500).json({ success: false, message: e.message });
    }
}


// --- Exporta todas as funções do controller ---
module.exports = {
    obterDadosGerenciarCotacoes,
    excluirFornecedoresDeCotacaoPortal,
    salvarTextoGlobalCotacaoPortal,
    preencherUltimosPrecos,
    gerarPdfsEnvioManual // <--- Nome da função corrigido
};