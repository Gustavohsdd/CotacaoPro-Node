const express = require('express');
const router = express.Router();
const ConciliacaoNFController = require('../Controllers/ConciliacaoNFController');
const controller = require('../Controllers/ConciliacaoNFController');

// --- Rotas de Inicialização e Leitura ---
router.get('/dados-pagina', ConciliacaoNFController.getDadosPagina);
router.get('/fornecedor/:cnpj', ConciliacaoNFController.buscarFornecedorPorCnpj);
router.get('/dados-cadastro-itens/:chaveAcesso', ConciliacaoNFController.obterDadosParaCadastroItens);

// --- Rotas de Processamento de Arquivos ---
router.post('/processar', ConciliacaoNFController.processarXMLs); // Processamento via pasta do Drive
router.post('/upload-xmls', ConciliacaoNFController.uploadArquivos); // Upload direto via interface

// --- Rotas de Ação (Conciliação e Status) - [MODIFICADO] ---
// Novas rotas para salvamento individual/inline
router.post('/concluir', ConciliacaoNFController.concluirConciliacao);
router.post('/atualizar-status', ConciliacaoNFController.atualizarStatusNF);

// Rota antiga removida (mantida comentada apenas para referência):
// router.post('/salvar-lote', ConciliacaoNFController.salvarLoteUnificado); 

// --- Rotas de Cadastros Auxiliares ---
router.post('/salvar-fornecedor', ConciliacaoNFController.salvarFornecedorViaNF);
router.post('/salvar-produto-via-nf', ConciliacaoNFController.salvarProdutoViaNF);
router.post('/salvar-subprodutos-via-nf', ConciliacaoNFController.salvarSubProdutosViaNF);
router.get('/notas-para-ratear', controller.ConciliacaoNFController_obterNotasParaRatear);
router.post('/relatorio/detalhado', controller.ConciliacaoNFController_buscarDadosRelatorioDetalhado);
router.post('/relatorio/sintetico', controller.ConciliacaoNFController_buscarDadosRelatorioSintetico);

module.exports = router;