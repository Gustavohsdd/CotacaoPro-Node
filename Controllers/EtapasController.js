// controllers/EtapasController.js
// Migrado de src/EtapasController.js

// Importa a camada de acesso a dados (CRUD)
const EtapasCRUD = require('./EtapasCRUD');

/**
 * Controller para salvar os dados da contagem de estoque.
 * (Migrado de EtapasController_salvarContagemEstoque)
 * Rota: POST /api/etapas/salvarContagem
 */
async function salvarContagemEstoque(req, res) {
  try {
    const { idCotacao, dadosContagem } = req.body;
    if (!idCotacao) {
      return res.status(400).json({ success: false, message: "ID da Cotação não fornecido." });
    }
    if (!dadosContagem || !Array.isArray(dadosContagem) || dadosContagem.length === 0) {
      return res.status(400).json({ success: false, message: "Nenhum dado de contagem para salvar." });
    }
    
    // Chama o CRUD
    const resultado = await EtapasCRUD.salvarDadosContagemEstoque(
      req.sheets,
      req.ID_PLANILHA_PRINCIPAL,
      idCotacao,
      dadosContagem
    );
    
    res.json(resultado); // Repassa a resposta do CRUD

  } catch (error) {
    console.error(`ERRO em salvarContagemEstoque: ${error.toString()}`, error.stack);
    res.status(500).json({ success: false, message: "Erro no controller ao salvar contagem: " + error.message });
  }
}

/**
 * Controller para atualizar o status de uma cotação.
 * (Migrado de EtapasController_atualizarStatusCotacao)
 * Rota: POST /api/etapas/atualizarStatus
 */
async function atualizarStatusCotacao(req, res) {
  try {
    const { idCotacao, novoStatus } = req.body;
    if (!idCotacao) {
      return res.status(400).json({ success: false, message: "ID da Cotação não fornecido." });
    }
    if (!novoStatus) {
      return res.status(400).json({ success: false, message: "Novo status não fornecido." });
    }
    
    const resultado = await EtapasCRUD.atualizarStatusCotacao(
      req.sheets,
      req.ID_PLANILHA_PRINCIPAL,
      idCotacao,
      novoStatus
    );
    
    res.json(resultado);

  } catch (error) {
    console.error(`ERRO em atualizarStatusCotacao: ${error.toString()}`, error.stack);
    res.status(500).json({ success: false, message: "Erro no controller ao atualizar status: " + error.message });
  }
}

/**
 * Controller para retirar produtos (por Produto Principal).
 * (Migrado de EtapasController_retirarProdutosCotacao)
 * Rota: POST /api/etapas/retirarProdutos
 */
async function retirarProdutosCotacao(req, res) {
  try {
    const { idCotacao, nomesProdutosPrincipaisParaExcluir } = req.body;
    if (!idCotacao) {
      return res.status(400).json({ success: false, message: "ID da Cotação não fornecido." });
    }
    if (!nomesProdutosPrincipaisParaExcluir || !Array.isArray(nomesProdutosPrincipaisParaExcluir)) {
      return res.status(400).json({ success: false, message: "Lista de produtos para exclusão inválida." });
    }
    
    const resultado = await EtapasCRUD.excluirLinhasDaCotacaoPorProdutoPrincipal(
      req.sheets,
      req.ID_PLANILHA_PRINCIPAL,
      idCotacao,
      nomesProdutosPrincipaisParaExcluir
    );
    
    res.json(resultado);

  } catch (error) {
    console.error(`ERRO em retirarProdutosCotacao: ${error.toString()}`, error.stack);
    res.status(500).json({ success: false, message: "Erro no controller ao retirar produtos: " + error.message });
  }
}

/**
 * Controller para a etapa "Enviar para Fornecedores" (gera links).
 * (Migrado de EtapasController_gerarLinksParaFornecedoresParaEtapaEnvio)
 * Rota: POST /api/etapas/gerarLinks
 */
async function gerarLinksParaFornecedores(req, res) {
  try {
    const { idCotacao } = req.body;
    if (!idCotacao) {
      return res.status(400).json({ success: false, message: "ID da Cotação não fornecido." });
    }
    
    const resultado = await EtapasCRUD.gerarOuAtualizarLinksPortal(
      req.sheets,
      req.ID_PLANILHA_PRINCIPAL,
      idCotacao
    );
    
    res.json(resultado);

  } catch (error) {
    console.error(`ERRO em gerarLinksParaFornecedores: ${error.toString()}`, error.stack);
    res.status(500).json({ success: false, message: "Erro no controller ao gerar links: " + error.message });
  }
}

/**
 * Controller para retirar subprodutos individuais (Etapa 4).
 * (Migrado de EtapasController_retirarSubProdutosCotacao)
 * Rota: POST /api/etapas/retirarSubProdutos
 */
async function retirarSubProdutosCotacao(req, res) {
  try {
    const { idCotacao, subProdutosParaExcluir } = req.body;
    if (!idCotacao) {
      return res.status(400).json({ success: false, message: "ID da Cotação não fornecido." });
    }
    if (!subProdutosParaExcluir || !Array.isArray(subProdutosParaExcluir)) {
      return res.status(400).json({ success: false, message: "Lista de subprodutos para exclusão inválida." });
    }
    
    const resultado = await EtapasCRUD.excluirLinhasDaCotacaoPorSubProduto(
      req.sheets,
      req.ID_PLANILHA_PRINCIPAL,
      idCotacao,
      subProdutosParaExcluir
    );
    
    res.json(resultado);

  } catch (error) {
    console.error(`ERRO em retirarSubProdutosCotacao: ${error.toString()}`, error.stack);
    res.status(500).json({ success: false, message: "Erro no Controller ao retirar subprodutos: " + error.message });
  }
}

/**
 * Controller para obter dados da Etapa 5 (Faturamento).
 * (Migrado de EtapasController_obterDadosParaEtapaFaturamento)
 * Rota: GET /api/etapas/dadosFaturamento
 */
async function obterDadosParaEtapaFaturamento(req, res) {
  try {
    const [empresasResult, pedidosMinimosResult] = await Promise.all([
      EtapasCRUD.obterEmpresasParaFaturamento(req.sheets, req.ID_PLANILHA_PRINCIPAL),
      EtapasCRUD.obterPedidosMinimosFornecedores(req.sheets, req.ID_PLANILHA_PRINCIPAL)
    ]);

    if (!empresasResult.success || !pedidosMinimosResult.success) {
      return res.status(500).json({ success: false, message: (empresasResult.message || "") + " " + (pedidosMinimosResult.message || "") });
    }
    
    res.json({
      success: true,
      empresas: empresasResult.empresas,
      pedidosMinimos: pedidosMinimosResult.pedidosMinimos
    });
    
  } catch (error) {
    console.error(`ERRO em obterDadosParaEtapaFaturamento: ${error.toString()}`, error.stack);
    res.status(500).json({ success: false, message: "Erro no controller ao buscar dados da Etapa 5: " + error.message });
  }
}

/**
 * Controller para obter dados da Etapa 6 (Condições Pagamento).
 * (Migrado de EtapasController_obterDadosParaEtapaCondicoes)
 * Rota: GET /api/etapas/dadosCondicoes
 */
async function obterDadosParaEtapaCondicoes(req, res) {
  try {
    const resultadoCondicoes = await EtapasCRUD.obterCondicoesPagamentoFornecedores(req.sheets, req.ID_PLANILHA_PRINCIPAL);
    res.json(resultadoCondicoes); // Repassa o resultado { success: true, condicoes: ... }
  } catch (error) {
    console.error(`ERRO em obterDadosParaEtapaCondicoes: ${error.toString()}`, error.stack);
    res.status(500).json({ success: false, message: "Erro no controller ao buscar dados da Etapa 6: " + error.message });
  }
}

/**
 * Controller para salvar dados da Etapa 6 (Condições Pagamento).
 * (Migrado de EtapasController_salvarCondicoesPagamento)
 * Rota: POST /api/etapas/salvarCondicoes
 */
async function salvarCondicoesPagamento(req, res) {
  try {
    const { idCotacao, dadosPagamento } = req.body;
    if (!idCotacao) {
      return res.status(400).json({ success: false, message: "ID da Cotação não fornecido." });
    }
    if (!dadosPagamento || !Array.isArray(dadosPagamento) || dadosPagamento.length === 0) {
      return res.status(400).json({ success: false, message: "Nenhum dado de pagamento para salvar." });
    }
    
    const resultado = await EtapasCRUD.salvarCondicoesPagamentoNaCotacao(
      req.sheets,
      req.ID_PLANILHA_PRINCIPAL,
      idCotacao,
      dadosPagamento
    );
    
    res.json(resultado);
    
  } catch (error) {
    console.error(`ERRO em salvarCondicoesPagamento: ${error.toString()}`, error.stack);
    res.status(500).json({ success: false, message: "Erro no Controller ao salvar condições de pagamento: " + error.message });
  }
}

/**
 * Controller para obter dados da Etapa 7 (Impressão).
 * (Migrado de EtapasController_obterDadosParaImpressao)
 * Rota: POST /api/etapas/dadosImpressao
 */
async function obterDadosParaImpressao(req, res) {
  try {
    // É POST para podermos enviar o idCotacao no corpo
    const { idCotacao } = req.body; 
    if (!idCotacao) {
      return res.status(400).json({ success: false, message: "ID da Cotação não fornecido." });
    }
    
    const resultado = await EtapasCRUD.buscarDadosAgrupadosParaImpressao(
      req.sheets,
      req.ID_PLANILHA_PRINCIPAL,
      idCotacao
    );
    
    res.json(resultado); // Repassa { success: true, dados: ... }
    
  } catch (error) {
    console.error(`ERRO em obterDadosParaImpressao: ${error.toString()}`, error.stack);
    res.status(500).json({ success: false, message: "Erro no controller ao buscar dados para impressão: " + error.message });
  }
}

/**
 * Controller para salvar dados da Etapa 5 (Faturamento em Lote).
 * (Migrado de EtapasController_salvarEmpresasFaturadasEmLote)
 * Rota: POST /api/etapas/salvarFaturamento
 */
async function salvarEmpresasFaturadasEmLote(req, res) {
  try {
    const { idCotacao, alteracoes } = req.body;
    if (!idCotacao) {
      return res.status(400).json({ success: false, message: "ID da Cotação não fornecido." });
    }
    if (!alteracoes || !Array.isArray(alteracoes)) {
      return res.status(400).json({ success: false, message: "Dados de alteração inválidos." });
    }
    // O CRUD já trata o caso de alteracoes.length === 0
    
    const resultado = await EtapasCRUD.salvarEmpresasFaturadasEmLote(
      req.sheets,
      req.ID_PLANILHA_PRINCIPAL,
      idCotacao,
      alteracoes
    );
    
    res.json(resultado);
    
  } catch (error) {
    console.error(`ERRO em salvarEmpresasFaturadasEmLote: ${error.toString()}`, error.stack);
    res.status(500).json({ success: false, message: "Erro no Controller ao salvar faturamento em lote: " + error.message });
  }
}


// Exporta todas as funções para o roteador
module.exports = {
  salvarContagemEstoque,
  atualizarStatusCotacao,
  retirarProdutosCotacao,
  gerarLinksParaFornecedores,
  retirarSubProdutosCotacao,
  obterDadosParaEtapaFaturamento,
  obterDadosParaEtapaCondicoes,
  salvarCondicoesPagamento,
  obterDadosParaImpressao,
  salvarEmpresasFaturadasEmLote
};