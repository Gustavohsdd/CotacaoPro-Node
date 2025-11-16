// CotacaoPro-Node/Routes/conciliacaonf.js
// VERSÃO FINAL E COMPLETA

const express = require('express');
const router = express.Router();
const conciliacaoController = require('../Controllers/ConciliacaoNFController');

// Endpoint para processar XMLs da pasta do Drive (o que já tínhamos)
router.post('/processar', conciliacaoController.processarXMLs);

// --- NOVAS ROTAS (MIGRADAS DO CONTROLLER COMPLETO) ---

// Endpoint para o upload manual de arquivos XML pela interface
router.post('/upload-xmls', conciliacaoController.uploadArquivos);

// Endpoint para buscar os dados iniciais da página de conciliação
router.get('/dados-pagina', conciliacaoController.getDadosPagina);

// Endpoint para salvar o lote de conciliações, rateios e status
router.post('/salvar-lote', conciliacaoController.salvarLoteUnificado);

// Endpoint para buscar um fornecedor por CNPJ (para o modal)
router.get('/fornecedor/:cnpj', conciliacaoController.buscarFornecedorPorCnpj);

// Endpoint para salvar um fornecedor (do modal)
router.post('/salvar-fornecedor', conciliacaoController.salvarFornecedorViaNF);

// Endpoint para salvar um novo produto (do mini-modal)
router.post('/salvar-produto-via-nf', conciliacaoController.salvarProdutoViaNF);

// Endpoint para buscar dados para o modal de cadastro de itens
router.get('/dados-cadastro-itens/:chaveAcesso', conciliacaoController.obterDadosParaCadastroItens);

// Endpoint para salvar novos subprodutos (do modal)
router.post('/salvar-subprodutos-via-nf', conciliacaoController.salvarSubProdutosViaNF);


module.exports = router;