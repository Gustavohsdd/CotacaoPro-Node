// routes/fornecedores.js

const express = require('express');
const router = express.Router();

// Importa o Controller que contém a lógica de negócios
// *** CORREÇÃO: Importa a nova função listarNomesIds ***
const {
  obterListaFornecedoresPaginada,
  criarNovoFornecedor,
  atualizarFornecedor,
  obterSubProdutos,
  obterOutrosFornecedores,
  excluirFornecedor,
  listarNomesIds // <<< ADICIONADO
} = require('../controllers/FornecedoresController');

/*
 * Mapeamento das Rotas de Fornecedores:
 */

// Rota: POST /api/fornecedores/listar
router.post('/listar', obterListaFornecedoresPaginada);

// Rota: POST /api/fornecedores/criar
router.post('/criar', criarNovoFornecedor);

// Rota: POST /api/fornecedores/atualizar
router.post('/atualizar', atualizarFornecedor);

// Rota: POST /api/fornecedores/obterSubProdutos
router.post('/obterSubProdutos', obterSubProdutos);

// Rota: POST /api/fornecedores/obterOutros
router.post('/obterOutros', obterOutrosFornecedores);

// Rota: POST /api/fornecedores/excluir
router.post('/excluir', excluirFornecedor);

/**
 * [NOVA ROTA ADICIONADA]
 * Rota: GET /api/fornecedores/listarNomesIds
 * (Usada por SubProdutosScript.ejs para popular o dropdown de "Fornecedor")
 */
router.get('/listarNomesIds', listarNomesIds);


// Exporta o roteador para ser usado no server.js
module.exports = router;