// controllers/ProdutosController.js
// Migrado do 'ProdutosController.js' e 'ProdutosCRUD.js' do Apps Script.

// Importa as funções CRUD
const ProdutosCRUD = require('./ProdutosCRUD');
const SubProdutosCRUD = require('./SubProdutosCRUD'); 

// Importa as constantes
const {
  CABECALHOS_PRODUTOS,
  CABECALHOS_SUBPRODUTOS
} = require('../config/constants');

// Define as colunas que queremos exibir na tabela principal
const COLUNAS_EXIBICAO_NOMES = [
  "Produto", 
  "Tamanho", 
  "UN", 
  "Estoque Minimo", 
  "Status"
];

/**
 * Obtém os dados dos produtos de forma paginada e com filtro de busca.
 * (Migrado de ProdutosController_obterListaProdutosPaginada)
 */
async function obterListaProdutosPaginada(req, res) {
  try {
    const { pagina = 1, itensPorPagina = 10, termoBusca = null } = req.body;
    const termoBuscaNorm = termoBusca ? ProdutosCRUD.normalizarTextoComparacao(termoBusca) : null;
    const idPlanilha = req.ID_PLANILHA_PRINCIPAL;

    // 1. Busca TODOS os dados
    const todosDados = await ProdutosCRUD.getProdutosPlanilha(req.sheets, idPlanilha);
    
    if (todosDados.length <= 1) { // Apenas cabeçalho
      return res.json({ 
        success: true,
        cabecalhosParaExibicao: COLUNAS_EXIBICAO_NOMES,
        produtosPaginados: [], totalItens: 0, paginaAtual: 1, totalPaginas: 1
      });
    }

    // 2. Converte para objetos
    let todosProdutosObj = FornecedoresCRUD.sheetDataToObjects(todosDados, CABECALHOS_PRODUTOS);

    // 3. Aplica filtro de busca (se existir)
    let produtosFiltrados = todosProdutosObj;
    if (termoBuscaNorm) {
      produtosFiltrados = todosProdutosObj.filter(produto => {
        // Busca em todas as colunas definidas em CABECALHOS_PRODUTOS
        return CABECALHOS_PRODUTOS.some(nomeCabecalho => {
          const valorDoCampo = produto[nomeCabecalho];
          if (valorDoCampo) {
            return ProdutosCRUD.normalizarTextoComparacao(String(valorDoCampo)).includes(termoBuscaNorm);
          }
          return false;
        });
      });
    }
    
    // 4. Aplica paginação
    const totalItens = produtosFiltrados.length;
    const totalPaginas = Math.ceil(totalItens / itensPorPagina) || 1;
    const paginaAjustada = Math.min(Math.max(1, pagina), totalPaginas);
    const offset = (paginaAjustada - 1) * itensPorPagina;
    const produtosPaginados = produtosFiltrados.slice(offset, offset + itensPorPagina);
    
    // 5. Retorna os dados paginados
    res.json({
      success: true,
      cabecalhosParaExibicao: COLUNAS_EXIBICAO_NOMES,
      produtosPaginados: produtosPaginados,
      totalItens: totalItens,
      paginaAtual: paginaAjustada,
      totalPaginas: totalPaginas
    });

  } catch (e) {
    console.error("ERRO em obterListaProdutosPaginada:", e);
    res.status(500).json({ success: false, message: e.message });
  }
}

/**
 * Cria um novo produto.
 * (Migrado de ProdutosCRUD_criarNovoProduto)
 */
async function criarNovoProduto(req, res) {
  try {
    const dadosNovoProduto = req.body;
    const idPlanilha = req.ID_PLANILHA_PRINCIPAL;

    const nomeNovoProduto = dadosNovoProduto[CABECALHOS_PRODUTOS[2]]; // "Produto"
    if (!nomeNovoProduto) {
      return res.status(400).json({ success: false, message: "Nome do Produto é obrigatório." });
    }

    const todosDados = await ProdutosCRUD.getProdutosPlanilha(req.sheets, idPlanilha);
    const cabecalhosDaPlanilha = todosDados[0].map(String);
    const idColunaIndex = cabecalhosDaPlanilha.indexOf(CABECALHOS_PRODUTOS[1]); // "ID"
    const nomeColunaIndex = cabecalhosDaPlanilha.indexOf(CABECALHOS_PRODUTOS[2]); // "Produto"

    if (idColunaIndex === -1 || nomeColunaIndex === -1) {
      throw new Error("Colunas essenciais (ID, Produto) não encontradas na planilha.");
    }

    // Validação de duplicidade
    const nomeNovoNorm = ProdutosCRUD.normalizarTextoComparacao(nomeNovoProduto);
    for (let i = 1; i < todosDados.length; i++) {
      const nomeLinhaAtual = todosDados[i][nomeColunaIndex];
      if (ProdutosCRUD.normalizarTextoComparacao(nomeLinhaAtual) === nomeNovoNorm) {
        throw new Error(`O produto '${nomeNovoProduto}' já está cadastrado.`);
      }
    }

    const novoIdGerado = ProdutosCRUD.gerarProximoId(todosDados, idColunaIndex);
    dadosNovoProduto["ID"] = novoIdGerado; // Adiciona o novo ID ao objeto

    // Converte o objeto para um array na ordem correta da planilha
    const novaLinhaArray = ProdutosCRUD.objectToSheetRow(dadosNovoProduto, cabecalhosDaPlanilha);

    await ProdutosCRUD.appendProduto(req.sheets, idPlanilha, novaLinhaArray);

    res.json({ success: true, message: "Produto criado com sucesso!", novoId: novoIdGerado });

  } catch (e) {
    console.error("ERRO em criarNovoProduto:", e);
    res.status(500).json({ success: false, message: e.message });
  }
}

/**
 * Atualiza um produto existente.
 * (Migrado de ProdutosCRUD_atualizarProduto)
 */
async function atualizarProduto(req, res) {
  try {
    const dadosAtualizar = req.body;
    const idParaAtualizar = String(dadosAtualizar["ID"]);
    const idPlanilha = req.ID_PLANILHA_PRINCIPAL;
    
    if (!idParaAtualizar) {
      return res.status(400).json({ success: false, message: "ID do produto é obrigatório." });
    }

    const todosDados = await ProdutosCRUD.getProdutosPlanilha(req.sheets, idPlanilha);
    const cabecalhosDaPlanilha = todosDados[0].map(String);
    const idxId = cabecalhosDaPlanilha.indexOf(CABECALHOS_PRODUTOS[1]); // "ID"
    const idxNome = cabecalhosDaPlanilha.indexOf(CABECALHOS_PRODUTOS[2]); // "Produto"

    let linhaIndex = -1; // 0-based
    for (let i = 1; i < todosDados.length; i++) {
      if (String(todosDados[i][idxId]) === idParaAtualizar) {
        linhaIndex = i;
        break;
      }
    }

    if (linhaIndex === -1) {
      throw new Error(`Produto com ID '${idParaAtualizar}' não encontrado.`);
    }

    const nomeAntigo = String(todosDados[linhaIndex][idxNome]);
    const nomeAtualizado = dadosAtualizar["Produto"];
    if (!nomeAtualizado) {
      throw new Error("Nome do Produto é obrigatório.");
    }

    // Validar duplicidade
    const nomeAtualNorm = ProdutosCRUD.normalizarTextoComparacao(nomeAtualizado);
    for (let i = 1; i < todosDados.length; i++) {
      if (i !== linhaIndex && ProdutosCRUD.normalizarTextoComparacao(String(todosDados[i][idxNome])) === nomeAtualNorm) {
        throw new Error(`O nome '${nomeAtualizado}' já está cadastrado para outro ID.`);
      }
    }

    // Montar linha atualizada
    const linhaOriginal = todosDados[linhaIndex];
    const linhaAtualizadaArray = cabecalhosDaPlanilha.map((cab, k) => {
      if (cab === CABECALHOS_PRODUTOS[1] || cab === CABECALHOS_PRODUTOS[0]) { // ID ou Data de Cadastro
        return linhaOriginal[k]; // Mantém ID e Data de Cadastro
      }
      return dadosAtualizar[cab] !== undefined ? dadosAtualizar[cab] : linhaOriginal[k];
    });

    // 1. Atualiza a linha do produto
    await ProdutosCRUD.updateProdutoRow(req.sheets, idPlanilha, linhaIndex, linhaAtualizadaArray, cabecalhosDaPlanilha.length);

    // 2. Propaga a mudança de nome para SubProdutos (se o nome mudou)
    if (nomeAntigo !== nomeAtualizado) {
      await SubProdutosCRUD.propagarNomeProduto(req.sheets, idPlanilha, nomeAntigo, nomeAtualizado);
    }

    res.json({ success: true, message: "Produto atualizado e SubProdutos propagados com sucesso!" });

  } catch (e) {
    console.error("ERRO em atualizarProduto:", e);
    res.status(500).json({ success: false, message: e.message });
  }
}

/**
 * Obtém subprodutos de um produto.
 * (Migrado de ProdutosCRUD_obterSubProdutosPorProduto)
 */
async function obterSubProdutos(req, res) {
  try {
    const { nomeProduto } = req.body;
    if (!nomeProduto) {
      return res.status(400).json({ success: false, message: "Nome do produto não fornecido." });
    }
    const dados = await ProdutosCRUD.obterSubProdutosPorProduto(req.sheets, req.ID_PLANILHA_PRINCIPAL, nomeProduto);
    res.json({ success: true, dados: dados });
  } catch (e) {
    console.error("ERRO em obterSubProdutos:", e);
    res.status(500).json({ success: false, message: e.message });
  }
}

/**
 * Obtém outros produtos (para realocação).
 * (Migrado de ProdutosCRUD_obterListaOutrosProdutos)
 */
async function obterOutrosProdutos(req, res) {
  try {
    const { idProdutoExcluido } = req.body;
    const todosDados = await ProdutosCRUD.getProdutosPlanilha(req.sheets, req.ID_PLANILHA_PRINCIPAL);
    const dados = ProdutosCRUD.getOutrosProdutos(todosDados, idProdutoExcluido);
    res.json({ success: true, dados: dados });
  } catch (e) {
    console.error("ERRO em obterOutrosProdutos:", e);
    res.status(500).json({ success: false, message: e.message });
  }
}

/**
 * Exclui um produto e lida com seus subprodutos.
 * (Migrado de ProdutosCRUD_processarExclusaoProduto)
 */
async function excluirProduto(req, res) {
  try {
    const { idProduto, nomeProdutoOriginal, deletarSubprodutosVinculados, realocacoesSubprodutos } = req.body;
    const idPlanilha = req.ID_PLANILHA_PRINCIPAL;

    if (!idProduto || !nomeProdutoOriginal) {
      return res.status(400).json({ success: false, message: "ID e Nome do Produto são obrigatórios." });
    }

    // 1. Encontrar a linha (0-based) do produto
    const todosDadosProd = await ProdutosCRUD.getProdutosPlanilha(req.sheets, idPlanilha);
    const idxIdProd = todosDadosProd[0].indexOf(CABECALHOS_PRODUTOS[1]); // "ID"
    let linhaIndexProduto = -1;
    for (let i = 1; i < todosDadosProd.length; i++) {
      if (String(todosDadosProd[i][idxIdProd]) === String(idProduto)) {
        linhaIndexProduto = i; // 0-based
        break;
      }
    }
    if (linhaIndexProduto === -1) {
      throw new Error(`Produto com ID '${idProduto}' não encontrado para exclusão.`);
    }

    // 2. Preparar listas de subprodutos
    const subprodutosParaExcluirIndices = []; // 0-based
    const realocacoesComIndex = [];
    
    if (deletarSubprodutosVinculados || (realocacoesSubprodutos && realocacoesSubprodutos.length > 0)) {
      const dadosSub = await SubProdutosCRUD.getSubProdutosPlanilha(req.sheets, idPlanilha);
      const cabecalhosSub = dadosSub[0].map(String);
      const idxSubId = cabecalhosSub.indexOf(CABECALHOS_SUBPRODUTOS[1]); // "ID"
      const idxSubProdVinc = cabecalhosSub.indexOf(CABECALHOS_SUBPRODUTOS[3]); // "Produto Vinculado"
      const nomeProdNorm = normalizarTextoComparacao(nomeProdutoOriginal);
      
      const mapaRealocacao = (realocacoesSubprodutos || []).reduce((map, r) => {
        map[r.subProdutoId] = r.novoProdutoVinculadoNome;
        return map;
      }, {});

      for (let i = 1; i < dadosSub.length; i++) {
        if (normalizarTextoComparacao(dadosSub[i][idxSubProdVinc]) === nomeProdNorm) {
          const subId = dadosSub[i][idxSubId];
          if (deletarSubprodutosVinculados) {
            subprodutosParaExcluirIndices.push(i); // 0-based index
          } else if (mapaRealocacao[subId]) {
            realocacoesComIndex.push({
              linhaIndex: i, // 0-based index
              novoNome: mapaRealocacao[subId]
            });
          }
        }
      }
    }
    
    // 3. Executar o Batch Update
    await ProdutosCRUD.batchExcluirProdutoEAtualizarSubprodutos(
      req.sheets,
      idPlanilha,
      linhaIndexProduto,
      deletarSubprodutosVinculados,
      realocacoesComIndex,
      subprodutosParaExcluirIndices
    );

    res.json({ success: true, message: `Produto '${nomeProdutoOriginal}' e seus subprodutos foram processados.` });

  } catch (e) {
    console.error("ERRO em excluirProduto:", e);
    res.status(500).json({ success: false, message: e.message });
  }
}

/**
 * Obtém todos os fornecedores (para dropdown).
 * (Migrado de ProdutosCRUD_obterListaTodosFornecedores)
 */
async function getTodosFornecedores(req, res) {
   try {
    const dados = await ProdutosCRUD.getTodosFornecedores(req.sheets, req.ID_PLANILHA_PRINCIPAL);
    res.json({ success: true, dados: dados });
  } catch (e) {
    console.error("ERRO em getTodosFornecedores (ProdutosController):", e);
    res.status(500).json({ success: false, message: e.message });
  }
}

/**
 * Adiciona um novo subproduto (chamado pelo modal de Produtos).
 * (Migrado de ProdutosCRUD_adicionarNovoSubProdutoVinculado)
 */
async function adicionarSubProduto(req, res) {
    try {
        const dadosSubProduto = req.body;
        // Esta função no SubProdutosCRUD já espera Nomes, não IDs
        const resultado = await SubProdutosCRUD.adicionarNovoSubProdutoVinculado(req.sheets, req.ID_PLANILHA_PRINCIPAL, dadosSubProduto);
        if (!resultado.success) throw new Error(resultado.message);
        res.json(resultado);
    } catch (e) {
        console.error("ERRO em adicionarSubProduto (ProdutosController):", e);
        res.status(500).json({ success: false, message: e.message });
    }
}

/**
 * Atualiza um subproduto (chamado pelo modal de Produtos).
 * (Migrado de ProdutosCRUD_atualizarSubProdutoVinculado)
 */
async function atualizarSubProduto(req, res) {
     try {
        const dadosSubProduto = req.body;
        // Esta função no SubProdutosCRUD já espera Nomes, não IDs
        const resultado = await SubProdutosCRUD.atualizarSubProdutoVinculado(req.sheets, req.ID_PLANILHA_PRINCIPAL, dadosSubProduto);
        if (!resultado.success) throw new Error(resultado.message);
        res.json(resultado);
    } catch (e) {
        console.error("ERRO em atualizarSubProduto (ProdutosController):", e);
        res.status(500).json({ success: false, message: e.message });
    }
}


// Exporta as funções para o Router
module.exports = {
  obterListaProdutosPaginada,
  criarNovoProduto,
  atualizarProduto,
  obterSubProdutos,
  obterOutrosProdutos,
  excluirProduto,
  getTodosFornecedores,
  adicionarSubProduto,
  atualizarSubProduto
};