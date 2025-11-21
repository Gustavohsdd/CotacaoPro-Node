// routes/funcoes.js
// Define as rotas de API para o módulo "Funções"

const express = require('express');
const router = express.Router();

// Importa o Controller que contém a lógica de negócios
const FuncoesController = require('../controllers/FuncoesController');

/*
 * ====================================================================
 * Rotas do Módulo "Funções" (migradas de FuncoesController.gs)
 * ====================================================================
 */

/**
 * Rota: POST /api/funcoes/obterDadosGerenciarCotacoes
 * (Usada por FuncoesScript para abrir o modal "Gerenciar Cotações (Portal)")
 */
router.post('/obterDadosGerenciarCotacoes', FuncoesController.obterDadosGerenciarCotacoes);

/**
 * Rota: POST /api/funcoes/excluirFornecedoresPortal
 * (Usada por FuncoesScript para excluir fornecedores do portal)
 */
router.post('/excluirFornecedoresPortal', FuncoesController.excluirFornecedoresDeCotacaoPortal);

/**
 * Rota: POST /api/funcoes/salvarTextoGlobalPortal
 * (Usada por FuncoesScript para salvar a mensagem padrão da cotação no portal)
 */
router.post('/salvarTextoGlobalPortal', FuncoesController.salvarTextoGlobalCotacaoPortal);

/**
 * Rota: POST /api/funcoes/preencherUltimosPrecos
 * (Usada por FuncoesScript para a função "Preencher com Últimos Preços")
 */
router.post('/preencherUltimosPrecos', FuncoesController.preencherUltimosPrecos);

/**
 * Rota: POST /api/funcoes/obterDadosImpressaoManual
 * (Usada por ImprimirPedidosScript.ejs - chamada 1)
 */
router.post('/obterDadosImpressaoManual', FuncoesController.gerarPdfsEnvioManual);

/**
 * --- CORREÇÃO APLICADA AQUI ---
 * Rota: POST /api/funcoes/gerarPdfsEnvioManual
 * Adicionamos esta rota de volta. Agora, tanto esta rota quanto a
 * '/obterDadosImpressaoManual' chamam a *mesma* função de geração de PDF.
 * (Usada por ImprimirPedidosScript.ejs - chamada 2)
 */
router.post('/gerarPdfsEnvioManual', FuncoesController.gerarPdfsEnvioManual);


// Exporta o roteador
module.exports = router;