// routes/subprodutos.js

const express = require('express');
const router = express.Router();

// Importa o Controller (que ainda vamos migrar, mas já referenciamos)
const SubProdutosController = require('../controllers/SubProdutosController');

/*
 * ====================================================================
 * Rotas do Módulo de SubProdutos
 * ====================================================================
 */

/**
 * Rota: POST /api/subprodutos/listar
 * (Usada por SubProdutosScript_carregarListaSubProdutos)
 * Obtém a lista principal de subprodutos de forma paginada.
 */
router.post('/listar', SubProdutosController.obterListaSubProdutosPaginada);

/**
 * Rota: POST /api/subprodutos/criar
 * (Usada por SubProdutosScript_submeterFormularioSubProduto - modo 'criar')
 * Cria um novo subproduto.
 */
router.post('/criar', SubProdutosController.criarNovoSubProduto);

/**
 * Rota: POST /api/subprodutos/atualizar
 * (Usada por SubProdutosScript_submeterFormularioSubProduto - modo 'editar')
 * Atualiza um subproduto existente.
 */
router.post('/atualizar', SubProdutosController.atualizarSubProduto);

/**
 * Rota: POST /api/subprodutos/excluir
 * (Usada por SubProdutosScript_executarExcluirSubProduto)
 * Exclui um subproduto.
 */
router.post('/excluir', SubProdutosController.excluirSubProduto);

/**
 * Rota: POST /api/subprodutos/obterDetalhes
 * (Usada por SubProdutosScript_carregarSubProdutoParaEdicao)
 * Obtém os dados completos de um único subproduto pelo ID.
 */
router.post('/obterDetalhes', SubProdutosController.obterDetalhesSubProdutoPorId);

/**
 * Rota: POST /api/subprodutos/criarMultiplos
 * (Usada por SubProdutosScript_submeterFormularioMultiplosSubProdutos)
 * Cadastra vários subprodutos em lote.
 */
router.post('/criarMultiplos', SubProdutosController.cadastrarMultiplosSubProdutos);

/**
 * Rota: POST /api/subprodutos/listarPorPai
 * (Rota legada usada por FornecedoresScript.ejs - mantida para compatibilidade)
 * Lista subprodutos baseados em um 'Pai' (seja Fornecedor ou Produto).
 */
router.post('/listarPorPai', SubProdutosController.obterSubProdutosPorPai);


// Exporta o roteador
module.exports = router;