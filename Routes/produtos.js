// routes/produtos.js

const express = require('express');
const router = express.Router();

// Importa o Controller que contém a nova lógica de negócios
const ProdutosController = require('../Controllers/ProdutosController');

// Importa o CRUD de Produtos (necessário para a rota legada usada pelo FornecedoresScript)
const ProdutosCRUD = require('../Controllers/ProdutosCRUD');

/**
 * Rota: GET /api/produtos/listarNomesIds
 * (Usada por FornecedoresScript.ejs e SubProdutosScript.html para popular o dropdown de "Produto Vinculado")
 * (Mantida como estava no arquivo original)
 */
router.get('/listarNomesIds', async (req, res) => {
  try {
    // req.sheets e req.ID_PLANILHA_PRINCIPAL vêm do middleware no server.js
    const produtos = await ProdutosCRUD.getNomesEIdsProdutosAtivos(req.sheets, req.ID_PLANILHA_PRINCIPAL); 
    res.json({ success: true, dados: produtos });
  } catch (e) {
    console.error("ERRO em GET /api/produtos/listarNomesIds:", e);
    res.status(500).json({ success: false, message: e.message });
  }
});


/*
 * ====================================================================
 * Novas Rotas do Módulo de Produtos (baseadas no ProdutosController)
 * ====================================================================
 */

/**
 * Rota: POST /api/produtos/listar
 * (Usada por ProdutosScript_carregarListaProdutos)
 * Obtém a lista principal de produtos de forma paginada.
 */
router.post('/listar', ProdutosController.obterListaProdutosPaginada);

/**
 * Rota: POST /api/produtos/criar
 * (Usada por ProdutosScript_submeterFormularioProduto - modo 'criar')
 * Cria um novo produto principal.
 */
router.post('/criar', ProdutosController.criarNovoProduto);

/**
 * Rota: POST /api/produtos/atualizar
 * (Usada por ProdutosScript_submeterFormularioProduto - modo 'editar')
 * Atualiza um produto principal existente.
 */
router.post('/atualizar', ProdutosController.atualizarProduto);

/**
 * Rota: POST /api/produtos/obterSubProdutos
 * (Usada por ProdutosScript_iniciarConfirmacaoExclusaoProduto)
 * Lista os subprodutos vinculados a um produto principal.
 */
router.post('/obterSubProdutos', ProdutosController.obterSubProdutos);

/**
 * Rota: POST /api/produtos/obterOutros
 * (Usada por ProdutosScript_prepararModalRealocacaoSubProdutosProduto)
 * Lista outros produtos para realocação (excluindo o ID atual).
 */
router.post('/obterOutros', ProdutosController.obterOutrosProdutos);

/**
 * Rota: POST /api/produtos/excluir
 * (Usada por ProdutosScript_executarExclusaoProduto)
 * Processa a exclusão de um produto, lidando com os subprodutos.
 */
router.post('/excluir', ProdutosController.excluirProduto);

/**
 * Rota: POST /api/produtos/getTodosFornecedores
 * (Usada por ProdutosScript_abrirModalGerenciarSubprodutos)
 * Busca a lista de todos os fornecedores para o dropdown de subprodutos.
 */
router.post('/getTodosFornecedores', ProdutosController.getTodosFornecedores);

/**
 * Rota: POST /api/produtos/adicionarSubProduto
 * (Usada por ProdutosScript_salvarNovoSubprodutoVinculadoHandler - modo 'criar')
 * Adiciona um novo subproduto vinculado a um produto.
 */
router.post('/adicionarSubProduto', ProdutosController.adicionarSubProduto);

/**
 * Rota: POST /api/produtos/atualizarSubProduto
 * (Usada por ProdutosScript_salvarNovoSubprodutoVinculadoHandler - modo 'editar')
 * Atualiza um subproduto vinculado a um produto.
 */
router.post('/atualizarSubProduto', ProdutosController.atualizarSubProduto);


// Exporta o roteador
module.exports = router;