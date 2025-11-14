// controllers/CotacoesController.js
// Migrado de CotacoesController.gs

// Importa as funções CRUD
const CotacoesCRUD = require('./CotacoesCRUD');

/**
 * Migração de CotacoesController_obterResumosDeCotacoes
 * Obtém os resumos de cotações da planilha.
 */
async function obterResumosDeCotacoes(req, res) {
  console.log("[CotacoesController] Recebida requisição para obterResumosDeCotacoes.");
  try {
    const resumos = await CotacoesCRUD.obterResumosDeCotacoes(
      req.sheets,
      req.ID_PLANILHA_PRINCIPAL
    );

    console.log(`[CotacoesController] CRUD retornou ${resumos.length} resumos.`);
    res.json({
      success: true,
      dados: resumos,
      message: null
    });

  } catch (error) {
    console.error("ERRO em CotacoesController_obterResumosDeCotacoes:", error);
    res.status(500).json({
      success: false,
      dados: null,
      message: "Erro no servidor ao obter resumos das cotações: " + error.message
    });
  }
}

/**
 * Migração de CotacoesController_obterOpcoesNovaCotacao
 * Obtém as opções (listas) necessárias para o modal de "Nova Cotação".
 */
async function obterOpcoesNovaCotacao(req, res) {
  console.log("[CotacoesController] Recebida requisição para obterOpcoesNovaCotacao.");
  try {
    const dadosOpcoes = await CotacoesCRUD.obterOpcoesNovaCotacao(
      req.sheets,
      req.ID_PLANILHA_PRINCIPAL
    );

    res.json({
      success: true,
      dados: dadosOpcoes,
      message: null
    });

  } catch (error) {
    console.error("ERRO em CotacoesController_obterOpcoesNovaCotacao:", error);
    res.status(500).json({
      success: false,
      dados: null,
      message: "Erro no servidor ao buscar opções para nova cotação: " + error.message
    });
  }
}

/**
 * Migração de CotacoesController_criarNovaCotacao
 * Cria uma nova cotação com base nas opções fornecidas.
 */
async function criarNovaCotacao(req, res) {
  console.log("[CotacoesController] Recebida requisição para criarNovaCotacao.");
  try {
    const opcoesCriacao = req.body;
    if (!opcoesCriacao || !opcoesCriacao.tipo || !opcoesCriacao.selecoes) {
      return res.status(400).json({ success: false, message: "Opções de criação inválidas ou incompletas." });
    }

    const resultado = await CotacoesCRUD.criarNovaCotacao(
      req.sheets,
      req.ID_PLANILHA_PRINCIPAL,
      opcoesCriacao
    );

    // O CRUD já retorna o formato { success, idCotacao, numItens, message }
    res.json(resultado);

  } catch (error) {
    console.error("ERRO em CotacoesController_criarNovaCotacao:", error);
    res.status(500).json({
      success: false,
      message: "Erro geral no controlador ao criar nova cotação: " + error.message
    });
  }
}

// Exporta as funções para serem usadas pelo roteador
module.exports = {
  obterResumosDeCotacoes,
  obterOpcoesNovaCotacao,
  criarNovaCotacao
};