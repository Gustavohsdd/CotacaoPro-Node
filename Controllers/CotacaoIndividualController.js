// Importa o CRUD
const CotacaoIndividualCRUD = require('./CotacaoIndividualCRUD');

// Importa as constantes necessárias
const { CABECALHOS_COTACOES } = require('../Config/constants');

/**
 * Obtém os detalhes de uma cotação específica para exibição na página.
 * (Migrado de CotacaoIndividualController_obterDetalhesDaCotacao)
 * Rota: POST /api/cotacaoIndividual/obterDetalhes
 */
async function obterDetalhesDaCotacao(req, res) {
  // Dados vêm do req.body
  const { idCotacao } = req.body;
  console.log(`[Controller] Solicitado detalhes para ID: '${idCotacao}'.`);
  
  try {
    if (!idCotacao) {
      return res.status(400).json({ success: false, message: "ID da Cotação não fornecido." });
    }

    // Passa 'req.sheets' e 'req.ID_PLANILHA_PRINCIPAL' (do middleware) para a camada CRUD
    const produtosDaCotacao = await CotacaoIndividualCRUD.buscarProdutosPorIdCotacao(
      req.sheets,
      req.ID_PLANILHA_PRINCIPAL,
      idCotacao
    );

    if (produtosDaCotacao === null) {
      // Se o CRUD retornar null (ex: aba não encontrada), tratamos como erro
      return res.status(500).json({ success: false, dados: null, message: `Falha ao buscar produtos para cotação ID ${idCotacao} no CRUD.` });
    }
    
    // Retorna a resposta JSON para o frontend
    res.json({
      success: true,
      dados: produtosDaCotacao,
      cabecalhos: CABECALHOS_COTACOES, // Constante global importada
      message: `Dados da cotação ${idCotacao} carregados.`
    });

  } catch (error) {
    console.error(`ERRO em obterDetalhesDaCotacao para ID '${idCotacao}': ${error.toString()}`, error.stack);
    res.status(500).json({ success: false, dados: null, message: "Erro no controller: " + error.message });
  }
}

/**
 * Salva a edição de uma célula individual.
 * (Migrado de CotacaoIndividualController_salvarEdicaoCelulaIndividual)
 * Rota: POST /api/cotacaoIndividual/salvarCelula
 */
async function salvarEdicaoCelulaIndividual(req, res) {
  // Extrai todos os parâmetros do req.body
  const { idCotacao, identificadoresLinha, colunaAlterada, novoValor } = req.body;

  try {
    // Validações de entrada
    if (!idCotacao) {
      return res.status(400).json({ success: false, message: "ID da Cotação não fornecido." });
    }
    if (!identificadoresLinha || !identificadoresLinha.Produto || !identificadoresLinha.SubProdutoChave || !identificadoresLinha.Fornecedor) {
      return res.status(400).json({ success: false, message: "Identificadores da linha incompletos." });
    }
    if (colunaAlterada === undefined || colunaAlterada === null) {
      return res.status(400).json({ success: false, message: "Coluna alterada não especificada." });
    }

    // Chama o CRUD
    const resultado = await CotacaoIndividualCRUD.salvarEdicaoCelulaCotacao(
      req.sheets,
      req.ID_PLANILHA_PRINCIPAL, // ID da planilha principal
      idCotacao,
      identificadoresLinha,
      colunaAlterada,
      novoValor
    );
    
    res.json(resultado); // Repassa o resultado do CRUD (que já vem com {success: ...})

  } catch (error) {
    console.error(`ERRO em salvarEdicaoCelulaIndividual: ${error.toString()}`, error.stack);
    res.status(500).json({ success: false, message: "Erro no controller ao salvar edição da célula: " + error.message });
  }
}

/**
 * Salva um conjunto de edições do modal de detalhes.
 * (Migrado de CotacaoIndividualController_salvarEdicoesModalDetalhes)
 * Rota: POST /api/cotacaoIndividual/salvarModal
 */
async function salvarEdicoesModalDetalhes(req, res) {
  const { idCotacao, identificadoresLinha, alteracoes } = req.body;
  try {
    if (!idCotacao || !identificadoresLinha || !alteracoes || Object.keys(alteracoes).length === 0) {
      return res.status(400).json({ success: false, message: "Dados insuficientes para salvar." });
    }
    
    // Chama o CRUD
    const resultado = await CotacaoIndividualCRUD.salvarEdicoesModalDetalhes(
      req.sheets,
      req.ID_PLANILHA_PRINCIPAL,
      idCotacao,
      identificadoresLinha,
      alteracoes
    );
    
    res.json(resultado); // Repassa o resultado do CRUD

  } catch (error) {
    console.error(`ERRO em salvarEdicoesModalDetalhes: ${error.toString()}`, error.stack);
    res.status(500).json({ success: false, message: "Erro no controller ao salvar detalhes: " + error.message });
  }
}

/**
 * Acrescenta novos itens a uma cotação existente.
 * (Migrado de CotacaoIndividualController_acrescentarItensCotacao)
 * Rota: POST /api/cotacaoIndividual/acrescentarItens
 */
async function acrescentarItensCotacao(req, res) {
  const { idCotacao, opcoesCriacao } = req.body;
  console.log(`[Controller] Acrescentando itens ao ID '${idCotacao}' com opções: ${JSON.stringify(opcoesCriacao)}`);
  
  if (!idCotacao) {
    return res.status(400).json({ success: false, message: "ID da cotação existente não foi fornecido." });
  }
  if (!opcoesCriacao || !opcoesCriacao.tipo || !opcoesCriacao.selecoes) {
    return res.status(400).json({ success: false, message: "Opções para acrescentar itens são inválidas ou incompletas." });
  }

  try {
    // Chama o CRUD
    const resultadoCRUD = await CotacaoIndividualCRUD.acrescentarItensCotacao(
      req.sheets,
      req.ID_PLANILHA_PRINCIPAL,
      idCotacao,
      opcoesCriacao
    );
    
    res.json(resultadoCRUD); // Repassa o resultado do CRUD

  } catch (error) {
    console.error(`ERRO CRÍTICO em acrescentarItensCotacao: ${error.toString()}`, error.stack);
    res.status(500).json({
      success: false,
      message: "Erro geral no controlador ao acrescentar itens à cotação: " + error.message
    });
  }
}

// Exporta as funções para o roteador
module.exports = {
  obterDetalhesDaCotacao,
  salvarEdicaoCelulaIndividual,
  salvarEdicoesModalDetalhes,
  acrescentarItensCotacao
};