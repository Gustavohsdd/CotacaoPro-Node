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
} = require('../Config/constants');

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
 */
async function getNomeProdutoPorId(sheets, spreadsheetId, produtoId) {
    if (!produtoId || String(produtoId).trim() === "") return "";
    const todosProdutos = await ProdutosCRUD.getProdutosPlanilha(sheets, spreadsheetId);
    if (todosProdutos.length < 2) return "";
    
    const headers = todosProdutos[0].map(String);
    const idxId = headers.indexOf(CABECALHOS_PRODUTOS[1]); // "ID"
    const idxNome = headers.indexOf(CABECALHOS_PRODUTOS[2]); // "Produto"

    if (idxId === -1 || idxNome === -1) {
        throw new Error("Colunas 'ID' ou 'Produto' não encontradas na aba Produtos.");
    }

    for (let i = 1; i < todosProdutos.length; i++) {
        if (String(todosProdutos[i][idxId]) === String(produtoId)) {
            return String(todosProdutos[i][idxNome]);
        }
    }
    
    throw new Error(`Produto Vinculado com ID '${produtoId}' não encontrado.`);
}

/**
 * Busca o NOME de um fornecedor pelo seu ID.
 * (Função auxiliar necessária para conversão)
 */
async function getNomeFornecedorPorId(sheets, spreadsheetId, fornecedorId) {
    if (!fornecedorId || String(fornecedorId).trim() === "") return "";
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
    console.warn(`Fornecedor com ID '${fornecedorId}' não encontrado.`);
    return "";
}


// --- Funções do Controller (Exportadas para o Router) ---

/**
 * Rota: /api/subprodutos/listar
 */
async function obterListaSubProdutosPaginada(req, res) {
  try {
    const { pagina = 1, itensPorPagina = 10, termoBusca = null } = req.body;
    const termoBuscaNorm = termoBusca ? normalizarTextoComparacao(termoBusca) : null;
    const idPlanilha = req.ID_PLANILHA_PRINCIPAL;

    const todosDados = await SubProdutosCRUD.getSubProdutosPlanilha(req.sheets, idPlanilha);
    
    if (todosDados.length <= 1) { 
      return res.json({ 
        success: true,
        cabecalhosParaExibicao: COLUNAS_EXIBICAO_NOMES,
        subProdutosPaginados: [], totalItens: 0, paginaAtual: 1, totalPaginas: 1
      });
    }

    let todosSubProdutosObj = FornecedoresCRUD.sheetDataToObjects(todosDados, CABECALHOS_SUBPRODUTOS);

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
    
    const totalItens = subProdutosFiltrados.length;
    const totalPaginas = Math.ceil(totalItens / itensPorPagina) || 1;
    const paginaAjustada = Math.min(Math.max(1, pagina), totalPaginas);
    const offset = (paginaAjustada - 1) * itensPorPagina;
    const subProdutosPaginados = subProdutosFiltrados.slice(offset, offset + itensPorPagina);
    
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
 *
 * *** FUNÇÃO CORRIGIDA ***
 */
async function criarNovoSubProduto(req, res) {
  try {
    const dadosItem = req.body;
    const idPlanilha = req.ID_PLANILHA_PRINCIPAL;

    // --- INÍCIO DA CORREÇÃO ---
    // Verifica se o valor recebido é um ID (numérico) ou um NOME (texto)
    const valorProduto = dadosItem["Produto Vinculado"];
    let nomeProdutoParaSalvar;
    // Se o valor for numérico, é um ID. Busque o nome.
    if (valorProduto && !isNaN(parseInt(valorProduto))) {
        nomeProdutoParaSalvar = await getNomeProdutoPorId(req.sheets, idPlanilha, valorProduto);
    } else {
        // Se não for numérico (ou vazio), é o NOME (ou vazio). Use-o diretamente.
        nomeProdutoParaSalvar = valorProduto;
    }
    dadosItem["Produto Vinculado"] = nomeProdutoParaSalvar;

    // Faz o mesmo para Fornecedor
    const valorFornecedor = dadosItem["Fornecedor"];
    let nomeFornecedorParaSalvar;
    if (valorFornecedor && !isNaN(parseInt(valorFornecedor))) {
        nomeFornecedorParaSalvar = await getNomeFornecedorPorId(req.sheets, idPlanilha, valorFornecedor);
    } else {
        nomeFornecedorParaSalvar = valorFornecedor;
    }
    dadosItem["Fornecedor"] = nomeFornecedorParaSalvar;
    // --- FIM DA CORREÇÃO ---

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
 *
 * *** FUNÇÃO CORRIGIDA ***
 */
async function atualizarSubProduto(req, res) {
  try {
    const dadosItem = req.body;
    const idPlanilha = req.ID_PLANILHA_PRINCIPAL;
    
    // --- INÍCIO DA CORREÇÃO ---
    // Verifica se o valor recebido é um ID (numérico) ou um NOME (texto)
    const valorProduto = dadosItem["Produto Vinculado"];
    let nomeProdutoParaSalvar;
    // Se o valor for numérico, é um ID. Busque o nome.
    if (valorProduto && !isNaN(parseInt(valorProduto))) {
        nomeProdutoParaSalvar = await getNomeProdutoPorId(req.sheets, idPlanilha, valorProduto);
    } else {
        // Se não for numérico (ou vazio), é o NOME (ou vazio). Use-o diretamente.
        nomeProdutoParaSalvar = valorProduto;
    }
    dadosItem["Produto Vinculado"] = nomeProdutoParaSalvar;

    // Faz o mesmo para Fornecedor
    const valorFornecedor = dadosItem["Fornecedor"];
    let nomeFornecedorParaSalvar;
    if (valorFornecedor && !isNaN(parseInt(valorFornecedor))) {
        nomeFornecedorParaSalvar = await getNomeFornecedorPorId(req.sheets, idPlanilha, valorFornecedor);
    } else {
        nomeFornecedorParaSalvar = valorFornecedor;
    }
    dadosItem["Fornecedor"] = nomeFornecedorParaSalvar;
    // --- FIM DA CORREÇÃO ---

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
 * (Esta função só é chamada pela nova UI, então ela SEMPRE espera IDs)
 */
async function cadastrarMultiplosSubProdutos(req, res) {
  try {
    const { fornecedorId, subProdutos } = req.body;
    const idPlanilha = req.ID_PLANILHA_PRINCIPAL;

    // 1. Converte o ID do Fornecedor Global em NOME
    const nomeFornecedorGlobal = await getNomeFornecedorPorId(req.sheets, idPlanilha, fornecedorId);
    
    const subProdutosComNomes = [];
    const resultadosDetalhados = []; // Para rastrear falhas

    // 2. Converte o ID do Produto Vinculado de cada item em NOME
    for (const item of subProdutos) {
        // O frontend envia o ID do produto como 'Produto Vinculado'
        const idProdutoVinculado = item["Produto Vinculado"];
        
        try {
            const nomeProduto = await getNomeProdutoPorId(req.sheets, idPlanilha, idProdutoVinculado);
            // Substitui o ID pelo Nome
            item["Produto Vinculado"] = nomeProduto;
            subProdutosComNomes.push(item);

        } catch (e) {
             // Se o produto não for encontrado, marca como falha e não tenta salvar
            console.error(`Falha ao buscar produto ID ${idProdutoVinculado}: ${e.message}`);
            resultadosDetalhados.push({ nome: item["SubProduto"] || "Item sem nome", status: "Falha", erro: `Produto Vinculado com ID '${idProdutoVinculado}' não encontrado.` });
        }
    }
    
    const dadosLoteTratados = {
        fornecedorGlobalNome: nomeFornecedorGlobal,
        subProdutos: subProdutosComNomes // Somente os que tiveram o produto encontrado
    };

    // 3. Chama o CRUD com os dados tratados
    const resultado = await SubProdutosCRUD.cadastrarMultiplosSubProdutos(req.sheets, idPlanilha, dadosLoteTratados);
    
    // Combina os resultados do CRUD (que já podem ter falhas) com as falhas de lookup que encontramos
    if (resultadosDetalhados.length > 0) {
        resultado.detalhes = (resultado.detalhes || []).concat(resultadosDetalhados);
        resultado.message = `Processado com ${resultado.detalhes.length} alertas/erros.`;
        resultado.success = false; // Força o frontend a ver a mensagem
    }

    res.json(resultado);
    
  } catch (e) {
    console.error("ERRO em cadastrarMultiplosSubProdutos (Controller):", e);
    res.status(500).json({ success: false, message: e.message });
  }
}

/**
 * Rota: /api/subprodutos/listarPorPai
 * (Rota legada usada por FornecedoresScript e ProdutosScript)
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