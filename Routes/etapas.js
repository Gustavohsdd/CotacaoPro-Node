// routes/etapas.js

const express = require('express');
const router = express.Router();

// Importa o Controller que contém a lógica de negócios
const EtapasController = require('../Controllers/EtapasController');

/*
 * Mapeamento das Rotas de Etapas:
 * O frontend (EtapasScript.ejs) chamará esses endpoints.
 */

// --- ETAPA 1 ---
// Rota: POST /api/etapas/salvarContagem
// (Usada por EtapasScript_salvarContagemEstoqueEtapa)
router.post('/salvarContagem', EtapasController.salvarContagemEstoque);

// --- ETAPA 2 ---
// Rota: POST /api/etapas/retirarProdutos
// (Usada por EtapasScript_manipularExclusaoProdutosRetirar)
router.post('/retirarProdutos', EtapasController.retirarProdutosCotacao);

// --- ETAPA 3 ---
// Rota: POST /api/etapas/gerarLinks
// (Usada por EtapasScript_iniciarEnvioParaFornecedores)
router.post('/gerarLinks', EtapasController.gerarLinksParaFornecedores);

// --- ETAPA 4 ---
// Rota: POST /api/etapas/retirarSubProdutos
// (Usada por EtapasScript_manipularExclusaoSubprodutosSemPreco)
router.post('/retirarSubProdutos', EtapasController.retirarSubProdutosCotacao);

// --- ETAPA 5 ---
// Rota: GET /api/etapas/dadosFaturamento
// (Usada por EtapasScript_ativarModoDefinirEmpresa)
router.get('/dadosFaturamento', EtapasController.obterDadosParaEtapaFaturamento);

// Rota: POST /api/etapas/salvarFaturamento
// (Usada por EtapasScript_salvarFaturamentoEmLote)
router.post('/salvarFaturamento', EtapasController.salvarEmpresasFaturadasEmLote);

// --- ETAPA 6 ---
// Rota: GET /api/etapas/dadosCondicoes
// (Usada por EtapasScript_ativarModoDefinirCondicoesPagamento)
router.get('/dadosCondicoes', EtapasController.obterDadosParaEtapaCondicoes);

// Rota: POST /api/etapas/salvarCondicoes
// (Usada por EtapasScript_salvarDadosCondicoesPagamento)
router.post('/salvarCondicoes', EtapasController.salvarCondicoesPagamento);

// --- ETAPA 7 ---
// Rota: POST /api/etapas/dadosImpressao
// (Usada por ImprimirPedidosScript - que chamaremos mais tarde)
router.post('/dadosImpressao', EtapasController.obterDadosParaImpressao);

// --- FUNÇÃO GERAL ---
// Rota: POST /api/etapas/atualizarStatus
// (Usada por várias funções de Etapas)
router.post('/atualizarStatus', EtapasController.atualizarStatusCotacao);


// Exporta o roteador para ser usado no server.js
module.exports = router;