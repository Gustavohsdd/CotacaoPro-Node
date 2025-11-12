// routes/fornecedores.js

const express = require('express');
const router = express.Router();

// Importa o Controller que contém a lógica de negócios
const FornecedoresController = require('../Controllers/FornecedoresController');

/*
 * Mapeamento das Rotas de Fornecedores:
 * O frontend (FornecedoresScript.ejs) chama esses endpoints.
 * O roteador os direciona para a função correspondente no Controller.
 */

// Rota: POST /api/fornecedores/listar
// (Usada por FornecedoresScript_carregarListaFornecedores)
// CORREÇÃO: Aponta para obterListaFornecedoresPaginada (corrigindo meu typo anterior)
router.post('/listar', FornecedoresController.obterListaFornecedoresPaginada);

// Rota: POST /api/fornecedores/criar
// (Usada por FornecedoresScript_submeterFormularioProduto - modo 'criar')
router.post('/criar', FornecedoresController.criarNovoFornecedor);

// Rota: POST /api/fornecedores/atualizar
// (Usada por FornecedoresScript_submeterFormularioProduto - modo 'editar')
router.post('/atualizar', FornecedoresController.atualizarFornecedor);

// Rota: POST /api/fornecedores/obterSubProdutos
// (Usada por FornecedoresScript_iniciarConfirmacaoExclusao)
router.post('/obterSubProdutos', FornecedoresController.obterSubProdutos);

// Rota: POST /api/fornecedores/obterOutros
// (Usada por FornecedoresScript_prepararModalRealocacao)
router.post('/obterOutros', FornecedoresController.obterOutrosFornecedores);

// Rota: POST /api/fornecedores/excluir
// (Usada por FornecedoresScript_executarExclusao)
router.post('/excluir', FornecedoresController.excluirFornecedor);


// Exporta o roteador para ser usado no server.js
module.exports = router;