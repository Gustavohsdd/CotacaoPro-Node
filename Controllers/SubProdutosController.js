// controllers/SubProdutosController.js
// Migrado da lógica de SubProdutosController.gs e SubProdutosCRUD.gs (Apps Script)

// Importa os CRUDs necessários
const SubProdutosCRUD = require('./SubProdutosCRUD');
const ProdutosCRUD = require('./ProdutosCRUD');
const FornecedoresCRUD = require('./FornecedoresCRUD');

// Importa as constantes
const {
  CABECALHOS_SUBPRODUTOS,
  CABECALHOS_PRODUTOS,
  CABECALHOS_FORNECEDORES
} = require('../config/constants');

// Define as colunas que queremos exibir na tabela principal
const COLUNAS_EXIBICAO_NOMES = [
  "SubProduto", 
  "Produto Vinculado",
  "Fornecedor",
  "Categoria",
  "UN",
  "Status"
];

// --- Funções Auxiliares ---

function normalizarTextoComparacao(texto) {
  if (!texto || typeof texto !== 'string') return "";
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/**
 * Busca o NOME de um produto pelo seu ID.
 * (Função auxiliar necessária para conversão)
 *
 * *** ESTA É A FUNÇÃO QUE FOI CORRIGIDA ***
 */
async function getNomeProdutoPorId(sheets, spreadsheetId, produtoId) {
    if (!produtoId || String(produtoId).trim() === "") return "";
    // Reutiliza a função de ProdutosCRUD para pegar todos os produtos
    const todosProdutos = await ProdutosCRUD.getProdutosPlanilha(sheets, spreadsheetId);
    if (todosProdutos.length < 2) return "";
    
    const headers = todosProdutos[0].map(String);
    const idxId = headers.indexOf(CABECALHOS_PRODUTOS[1]); // "ID"
    const idxNome = headers.indexOf(CABECALHOS_PRODUTOS[2]); // "Produto"

    if (idxId === -1 || idxNome === -1) {
        throw new Error("Colunas 'ID' ou 'Produto' não encontradas na aba Produtos.");
    }

    // *** CORREÇÃO APLICADA AQUI ***
    // Trocado "todosDados" por "todosProdutos"
    for (let i = 1; i < todosProdutos.length; i++) { 
        if (String(todosProdutos[i][idxId]) === String(produtoId)) { 
            return String(todosProdutos[i][idxNome]); 
        }
    }
    // *** FIM DA CORREÇÃO ***
    
    throw new Error(`Produto Vinculado com ID '${produtoId}' não encontrado.`);
}

/**
 * Busca o NOME de um fornecedor pelo seu ID.
 * (Função auxiliar necessária para conversão)
 */
async function getNomeFornecedorPorId(sheets, spreadsheetId, fornecedorId) {
    if (!fornecedorId || String(fornecedorId).trim() === "") return "";
    // Reutiliza a função de FornecedoresCRUD para pegar todos os fornecedores
    const todosFornecedores = await FornecedoresCRUD.getFornecedoresPlanilha(sheets, spreadsheetId);
    if (todosFornecedores.length < 2) return "";

    const headers = todosFornecedores[0].map(String);
    const idxId = headers.indexOf(CABECALHOS_FORNECEDORES[1]); // "ID"
    const idxNome = headers.indexOf(CABECALHOS_FORNECEDORES[2]); // "Fornecedor"

    if (idxId === -1 || idxNome === -1) {
        throw new Error("Colunas 'ID' ou 'Fornecedor' não encontradas na aba Fornecedores.");
    }

    for (let i = 1; i < todosFornecedores.length; i++) {
        if (String(todosFornecedores[i][idxId]) === String(fornecedorId)) {
            return String(todosFornecedores[i][idxNome]);
        }
    }
    // Não lança erro, pois fornecedor é opcional
    console.warn(`Fornecedor com ID '${fornecedorId}' não encontrado.`);
    return "";
}


// --- Funções do Controller (Exportadas para o Router) ---

/**
 * Rota: /api/subprodutos/listar
 * (Migrado de SubProdutosController_obterListaSubProdutosPaginada)
 */
async function obterListaSubProdutosPaginada(req, res) {
  try {
    const { pagina = 1, itensPorPagina = 10, termoBusca = null } = req.body;
    const termoBuscaNorm = termoBusca ? normalizarTextoComparacao(termoBusca) : null;
    const idPlanilha = req.ID_PLANILHA_PRINCIPAL;

    // 1. Busca TODOS os dados
    const todosDados = await SubProdutosCRUD.getSubProdutosPlanilha(req.sheets, idPlanilha);
    
    if (todosDados.length <= 1) { // Apenas cabeçalho
      return res.json({ 
        success: true,
        cabecalhosParaExibicao: COLUNAS_EXIBICAO_NOMES,
        subProdutosPaginados: [], totalItens: 0, paginaAtual: 1, totalPaginas: 1
      });
    }

    // 2. Converte para objetos (reutilizando a função do FornecedoresCRUD)
    let todosSubProdutosObj = FornecedoresCRUD.sheetDataToObjects(todosDados, CABECALHOS_SUBPRODUTOS);

    // 3. Aplica filtro de busca
    let subProdutosFiltrados = todosSubProdutosObj;
    if (termoBuscaNorm) {
      subProdutosFiltrados = todosSubProdutosObj.filter(subProduto => {
        return CABECALHOS_SUBPRODUTOS.some(nomeCabecalho => {
          const valorDoCampo = subProduto[nomeCabecalho];
          if (valorDoCampo) {
            return normalizarTextoComparacao(String(valorDoCampo)).includes(termoBuscaNorm);
          }
          return false;
        });
      });
    }
    
    // 4. Aplica paginação
    const totalItens = subProdutosFiltrados.length;
    const totalPaginas = Math.ceil(totalItens / itensPorPagina) || 1;
    const paginaAjustada = Math.min(Math.max(1, pagina), totalPaginas);
    const offset = (paginaAjustada - 1) * itensPorPagina;
    const subProdutosPaginados = subProdutosFiltrados.slice(offset, offset + itensPorPagina);
    
    // 5. Retorna os dados paginados
    res.json({
      success: true,
      cabecalhosParaExibicao: COLUNAS_EXIBICAO_NOMES,
      subProdutosPaginados: subProdutosPaginados,
      totalItens: totalItens,
      paginaAtual: paginaAjustada,
      totalPaginas: totalPaginas
    });

  } catch (e) {
    console.error("ERRO em obterListaSubProdutosPaginada:", e);
    res.status(500).json({ success: false, message: e.message });
  }
}

/**
 * Rota: /api/subprodutos/criar
 * (Migrado de SubProdutosCRUD_criarNovoSubProduto)
 * Converte IDs de Produto/Fornecedor em Nomes antes de salvar.
 */
async function criarNovoSubProduto(req, res) {
  try {
    const dadosItem = req.body;
    const idPlanilha = req.ID_PLANILHA_PRINCIPAL;

    // 1. Converte ID do Produto Vinculado para NOME
    const idProdutoVinculado = dadosItem["Produto Vinculado"];
    const nomeProdutoParaSalvar = await getNomeProdutoPorId(req.sheets, idPlanilha, idProdutoVinculado);
    dadosItem["Produto Vinculado"] = nomeProdutoParaSalvar; // Substitui o ID pelo Nome

    // 2. Converte ID do Fornecedor para NOME
    const idFornecedor = dadosItem["Fornecedor"];
    const nomeFornecedorParaSalvar = await getNomeFornecedorPorId(req.sheets, idPlanilha, idFornecedor);
    dadosItem["Fornecedor"] = nomeFornecedorParaSalvar; // Substitui o ID pelo Nome

    // 3. Chama o CRUD com os dados tratados
    const resultado = await SubProdutosCRUD.criarNovoSubProduto(req.sheets, idPlanilha, dadosItem);
    
    res.json(resultado);

  } catch (e) {
    console.error("ERRO em criarNovoSubProduto (Controller):", e);
    res.status(500).json({ success: false, message: e.message });
  }
}

/**
 * Rota: /api/subprodutos/atualizar
 * (Migrado de SubProdutosCRUD_atualizarSubProduto)
 * Converte IDs de Produto/Fornecedor em Nomes antes de salvar.
 */
async function atualizarSubProduto(req, res) {
  try {
    const dadosItem = req.body;
    const idPlanilha = req.ID_PLANILHA_PRINCIPAL;
    
    // 1. Converte ID do Produto Vinculado para NOME
    const idProdutoVinculado = dadosItem["Produto Vinculado"];
    const nomeProdutoParaSalvar = await getNomeProdutoPorId(req.sheets, idPlanilha, idProdutoVinculado);
    dadosItem["Produto Vinculado"] = nomeProdutoParaSalvar;

    // 2. Converte ID do Fornecedor para NOME
    const idFornecedor = dadosItem["Fornecedor"];
    const nomeFornecedorParaSalvar = await getNomeFornecedorPorId(req.sheets, idPlanilha, idFornecedor);
    dadosItem["Fornecedor"] = nomeFornecedorParaSalvar;

    // 3. Chama o CRUD com os dados tratados
    const resultado = await SubProdutosCRUD.atualizarSubProduto(req.sheets, idPlanilha, dadosItem);
    
    res.json(resultado);
  } catch (e) {
    console.error("ERRO em atualizarSubProduto (Controller):", e);
    res.status(500).json({ success: false, message: e.message });
  }
}

/**
 * Rota: /api/subprodutos/excluir
 * (Migrado de SubProdutosCRUD_excluirSubProduto)
 */
async function excluirSubProduto(req, res) {
  try {
    const { itemId } = req.body;
    const idPlanilha = req.ID_PLANILHA_PRINCIPAL;
    const resultado = await SubProdutosCRUD.excluirSubProduto(req.sheets, idPlanilha, itemId);
    res.json(resultado);
  } catch (e) {
    console.error("ERRO em excluirSubProduto (Controller):", e);
    res.status(500).json({ success: false, message: e.message });
  }
}

/**
 * Rota: /api/subprodutos/obterDetalhes
 * (Migrado de SubProdutosCRUD_obterDetalhesSubProdutoPorId)
 */
async function obterDetalhesSubProdutoPorId(req, res) {
  try {
    const { itemId } = req.body;
    const idPlanilha = req.ID_PLANILHA_PRINCIPAL;
    const item = await SubProdutosCRUD.getDetalhesSubProdutoPorId(req.sheets, idPlanilha, itemId);
    if (item) {
      res.json({ success: true, dados: item });
    } else {
      res.status(404).json({ success: false, message: "Item não encontrado" });
    }
  } catch (e) {
    console.error("ERRO em obterDetalhesSubProdutoPorId (Controller):", e);
    res.status(500).json({ success: false, message: e.message });
  }
}

/**
 * Rota: /api/subprodutos/criarMultiplos
 * (Migrado de SubProdutosCRUD_cadastrarMultiplosSubProdutos)
 */
async function cadastrarMultiplosSubProdutos(req, res) {
  try {
    const { fornecedorId, subProdutos } = req.body;
    const idPlanilha = req.ID_PLANILHA_PRINCIPAL;

    // 1. Converte o ID do Fornecedor Global em NOME
    const nomeFornecedorGlobal = await getNomeFornecedorPorId(req.sheets, idPlanilha, fornecedorId);
    
    // 2. Converte o ID do Produto Vinculado de cada item em NOME
    const subProdutosComNomes = [];
    for (const item of subProdutos) {
        // O frontend envia o ID do produto como 'Produto Vinculado'
        const idProdutoVinculado = item["Produto Vinculado"];
        const nomeProduto = await getNomeProdutoPorId(req.sheets, idPlanilha, idProdutoVinculado);
        
        if (!nomeProduto) {
            // Se o produto não for encontrado, marca como falha e não tenta salvar
            resultadosDetalhados.push({ nome: item["SubProduto"] || "Item sem nome", status: "Falha", erro: `Produto Vinculado com ID '${idProdutoVinculado}' não encontrado.` });
            continue;
        }
        
        // Substitui o ID pelo Nome
        item["Produto Vinculado"] = nomeProduto;
        subProdutosComNomes.push(item);
    }
    
    const dadosLoteTratados = {
        fornecedorGlobalNome: nomeFornecedorGlobal,
        subProdutos: subProdutosComNomes
    };

    // 3. Chama o CRUD com os dados tratados
    const resultado = await SubProdutosCRUD.cadastrarMultiplosSubProdutos(req.sheets, idPlanilha, dadosLoteTratados);
    res.json(resultado);
    
  } catch (e) {
    console.error("ERRO em cadastrarMultiplosSubProdutos (Controller):", e);
    res.status(500).json({ success: false, message: e.message });
  }
}

/**
 * Rota: /api/subprodutos/listarPorPai
 * (Migrado de SubProdutosCRUD_obterSubProdutosPorPai_NOVO)
 * Rota legada usada por FornecedoresScript e ProdutosScript.
 */
async function obterSubProdutosPorPai(req, res) {
  try {
    const { nomePai, tipoPai } = req.body; // 'nomePai' já é o NOME
    const idPlanilha = req.ID_PLANILHA_PRINCIPAL;
    const itens = await SubProdutosCRUD.getSubProdutosPorPai(req.sheets, idPlanilha, nomePai, tipoPai);
    res.json({ success: true, dados: itens });
  } catch (e) {
    console.error("ERRO em obterSubProdutosPorPai (Controller):", e);
    res.status(500).json({ success: false, message: e.message });
  }
}


// Exporta as funções para o Router
module.exports = {
  obterListaSubProdutosPaginada,
  criarNovoSubProduto,
  atualizarSubProduto,
  excluirSubProduto,
  obterDetalhesSubProdutoPorId,
  cadastrarMultiplosSubProdutos,
  obterSubProdutosPorPai
};