// routes/subprodutos.js

const express = require('express');
const router = express.Router();
const SubProdutosCRUD = require('../Controllers/SubProdutosCRUD');

/**
 * Rota: POST /api/subprodutos/listarPorPai
 * (Usada por FornecedoresScript.ejs para listar itens no modal)
 */
router.post('/listarPorPai', async (req, res) => {
  try {
    const { nomePai, tipoPai } = req.body;
    // Usa a ID_PLANILHA_PRINCIPAL ***
    const itens = await SubProdutosCRUD.getSubProdutosPorPai(req.sheets, req.ID_PLANILHA_PRINCIPAL, nomePai, tipoPai);
    res.json({ success: true, dados: itens });
  } catch (e) {
    console.error("ERRO em POST /api/subprodutos/listarPorPai:", e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * Rota: POST /api/subprodutos/obterDetalhes
 * (Usada por FornecedoresScript.ejs para editar um item no modal)
 */
router.post('/obterDetalhes', async (req, res) => {
  try {
    const { itemId } = req.body;
    // Usa a ID_PLANILHA_PRINCIPAL ***
    const item = await SubProdutosCRUD.getDetalhesSubProdutoPorId(req.sheets, req.ID_PLANILHA_PRINCIPAL, itemId);
    if (item) {
      res.json({ success: true, dados: item });
    } else {
      res.status(404).json({ success: false, message: "Item não encontrado" });
    }
  } catch (e) {
    console.error("ERRO em POST /api/subprodutos/obterDetalhes:", e);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * [NOVO] Rota: POST /api/subprodutos/criar
 * (Usada por FornecedoresScript.ejs para criar um novo subproduto)
 */
router.post('/criar', async (req, res) => {
    try {
        const dadosItem = req.body;
        // Usa a ID_PLANILHA_PRINCIPAL ***
        const resultado = await SubProdutosCRUD.criarNovoSubProduto(req.sheets, req.ID_PLANILHA_PRINCIPAL, dadosItem);
        res.json(resultado);
    } catch (e) {
        console.error("ERRO em POST /api/subprodutos/criar:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

/**
 * [NOVO] Rota: POST /api/subprodutos/atualizar
 * (Usada por FornecedoresScript.ejs para atualizar um subproduto)
 */
router.post('/atualizar', async (req, res) => {
    try {
        const dadosItem = req.body;
        // Usa a ID_PLANILHA_PRINCIPAL ***
        const resultado = await SubProdutosCRUD.atualizarSubProduto(req.sheets, req.ID_PLANILHA_PRINCIPAL, dadosItem);
        res.json(resultado);
    } catch (e) {
        console.error("ERRO em POST /api/subprodutos/atualizar:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

/**
 * [NOVO] Rota: POST /api/subprodutos/excluir
 * (Usada por FornecedoresScript.ejs para excluir um subproduto)
 */
router.post('/excluir', async (req, res) => {
    try {
        const { itemId } = req.body;
        // Usa a ID_PLANILHA_PRINCIPAL ***
        const resultado = await SubProdutosCRUD.excluirSubProduto(req.sheets, req.ID_PLANILHA_PRINCIPAL, itemId);
        res.json(resultado);
    } catch (e) {
        console.error("ERRO em POST /api/subprodutos/excluir:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});


module.exports = router;