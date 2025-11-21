const express = require('express');
const router = express.Router();
const controller = require('../controllers/NotasFiscaisController');

// GET: Listar notas com filtros
router.get('/listar', controller.NotasFiscaisController_listarNotas);

// POST: Desfazer conciliação (Ação Crítica)
router.post('/desfazer-conciliacao', controller.NotasFiscaisController_desfazerConciliacao);

// GET: Obter resumo financeiro
router.get('/resumo-financeiro/:chaveAcesso', controller.NotasFiscaisController_obterResumoFinanceiro);

// POST: Salvar faturas
router.post('/salvar-faturas', controller.NotasFiscaisController_salvarFaturas);

// POST: Salvar contas a pagar
router.post('/salvar-contas-pagar', controller.NotasFiscaisController_salvarContasAPagar);

// GET: Listar setores
router.get('/setores-rateio', controller.NotasFiscaisController_listarSetoresRegrasRateio);

router.post('/atualizar-status', controller.NotasFiscaisController_atualizarStatusNF);

module.exports = router;