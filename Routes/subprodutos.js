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
    const itens = await SubProdutosCRUD.getSubProdutosPorPai(req.sheets, req.constants.ID_PLANILHA_NF, nomePai, tipoPai);
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
    const item = await SubProdutosCRUD.getDetalhesSubProdutoPorId(req.sheets, req.constants.ID_PLANILHA_NF, itemId);
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

// (As rotas /criar, /atualizar, /excluir serão adicionadas depois)

module.exports = router;