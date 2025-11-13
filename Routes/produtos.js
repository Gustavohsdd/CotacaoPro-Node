// routes/produtos.js

const express = require('express');
const router = express.Router();

// Importa o CRUD de Produtos
const ProdutosCRUD = require('../Controllers/ProdutosCRUD');
// (Vamos criar o ProdutosController mais tarde, por enquanto o CRUD resolve)

/**
 * Rota: GET /api/produtos/listarNomesIds
 * (Usada por FornecedoresScript.ejs para popular o dropdown de "Produto Vinculado")
 */
router.get('/listarNomesIds', async (req, res) => {
  try {
    // req.sheets e req.constants vêm do middleware no server.js
    const produtos = await ProdutosCRUD.getNomesEIdsProdutosAtivos(req.sheets, req.constants.ID_PLANILHA_NF); 
    res.json({ success: true, dados: produtos });
  } catch (e) {
    console.error("ERRO em GET /api/produtos/listarNomesIds:", e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// Exporta o roteador
module.exports = router;