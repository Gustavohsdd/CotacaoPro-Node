// controllers/FuncoesController.js
// Lógica de negócios para o módulo "Funções", migrado de FuncoesController.js

const FuncoesCRUD = require('./FuncoesCRUD');
const EtapasCRUD = require('./EtapasCRUD'); // Funções de Etapas são necessárias
const CotacaoIndividualCRUD = require('./CotacaoIndividualCRUD'); // Funções de Cotação são necessárias

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

        // No Node.js, é mais eficiente fazer as exclusões em paralelo
        const promises = nomesFornecedores.map(nomeFornecedor =>
            FuncoesCRUD.excluirFornecedorDaCotacaoPortal(req.sheets, req.ID_PLANILHA_PRINCIPAL, idCotacao, nomeFornecedor)
        );
        
        const results = await Promise.allSettled(promises);
        
        const sucessoCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const falhaCount = results.filter(r => r.status === 'rejected' || !r.value.success).length;

        if (falhaCount > 0) {
             const erros = results
                .filter(r => r.status === 'rejected' || !r.value.success)
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

/**
 * (SUBSTITUI FuncoesController_gerarPdfsParaEnvioManual)
 * Apenas obtém os dados para a impressão/envio manual.
 * A geração do HTML/PDF agora será feita no cliente.
 */
async function obterDadosImpressaoManual(req, res) {
    try {
        const { idCotacao } = req.body;
        if (!idCotacao) {
            return res.status(400).json({ success: false, message: "ID da Cotação não fornecido." });
        }
        
        // Reutiliza a função do FuncoesCRUD
        const dadosAgrupados = await FuncoesCRUD.obterDadosParaImpressaoManual(req.sheets, req.ID_PLANILHA_PRINCIPAL, idCotacao);
        
        if (!dadosAgrupados || Object.keys(dadosAgrupados).length === 0) {
             return res.json({ success: true, dados: [], message: "Nenhum pedido com itens a comprar foi encontrado." });
        }
        
        // Transforma o objeto em um array simples para o cliente
        const dadosParaCliente = [];
        for (const nomeFornecedor in dadosAgrupados) {
            dadosAgrupados[nomeFornecedor].forEach(pedido => {
                dadosParaCliente.push({
                    ...pedido,
                    numeroCotacao: idCotacao // Adiciona o ID da cotação para a mensagem
                });
            });
        }
        
        res.json({ success: true, dados: dadosParaCliente });
        
    } catch (e) {
        console.error("ERRO em obterDadosImpressaoManual:", e);
        res.status(500).json({ success: false, message: e.message });
    }
}


// --- Exporta todas as funções do controller ---
module.exports = {
    obterDadosGerenciarCotacoes,
    excluirFornecedoresDeCotacaoPortal,
    salvarTextoGlobalCotacaoPortal,
    preencherUltimosPrecos,
    obterDadosImpressaoManual
    // Funções de Etapas e Relatórios irão para seus próprios controllers
};