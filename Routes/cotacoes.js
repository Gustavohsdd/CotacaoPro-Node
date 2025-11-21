// routes/cotacoes.js
const express = require('express');
const router = express.Router();

// Importa o Controller que contém a lógica de negócios
const CotacoesController = require('../controllers/CotacoesController');

/*
 * ====================================================================
 * Mapeamento das Rotas de Cotações
 * ====================================================================
 */

/**
 * Rota: POST /api/cotacoes/listar
 * (Usada por CotacoesScript_carregarTodasCotacoes)
 * Obtém os resumos de todas as cotações.
 */
router.post('/listar', CotacoesController.obterResumosDeCotacoes);

/**
 * Rota: GET /api/cotacoes/opcoes
 * (Usada por CotacoesScript_abrirModalNovaCotacao)
 * Obtém as listas de categorias, fornecedores e produtos para o modal.
 */
router.get('/opcoes', CotacoesController.obterOpcoesNovaCotacao);

/**
 * Rota: POST /api/cotacoes/criar
 * (Usada por CotacoesScript_lidarComCriacaoNovaCotacao)
 * Cria uma nova cotação com base nos filtros selecionados.
 */
router.post('/criar', CotacoesController.criarNovaCotacao);

// Exporta o roteador para ser usado no server.js
module.exports = router;