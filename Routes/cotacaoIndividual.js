// routes/cotacaoIndividual.js

const express = require('express');
const router = express.Router();

// Importa o Controller que contém a lógica de negócios
const CotacaoIndividualController = require('../controllers/CotacaoIndividualController');

/*
 * Mapeamento das Rotas de Cotação Individual:
 * O frontend (CotacaoIndividualScript.html, EtapasScript.html, etc.) chamará esses endpoints.
 */

// Rota: POST /api/cotacaoIndividual/obterDetalhes
// (Usada por CotacaoIndividualScript_carregarDadosCotacao)
router.post('/obterDetalhes', CotacaoIndividualController.obterDetalhesDaCotacao);

// Rota: POST /api/cotacaoIndividual/salvarCelula
// (Usada por CotacaoIndividualScript_salvarEdicaoInline)
router.post('/salvarCelula', CotacaoIndividualController.salvarEdicaoCelulaIndividual);

// Rota: POST /api/cotacaoIndividual/salvarModal
// (Usada por CotacaoIndividualScript_salvarEdicoesModalDetalhes)
router.post('/salvarModal', CotacaoIndividualController.salvarEdicoesModalDetalhes);

// Rota: POST /api/cotacaoIndividual/acrescentarItens
// (Usada por FuncoesScript_lidarComAcrescentarItens)
router.post('/acrescentarItens', CotacaoIndividualController.acrescentarItensCotacao);


// Exporta o roteador para ser usado no server.js
module.exports = router;