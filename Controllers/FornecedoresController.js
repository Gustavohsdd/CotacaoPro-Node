// Importa as funções CRUD que acabamos de criar
const FornecedoresCRUD = require('./FornecedoresCRUD');
// Importa o CRUD de subprodutos (que criaremos em breve, mas já referenciamos)
const SubProdutosCRUD = require('./SubProdutosCRUD'); 

// Importa as constantes
const {
  ABA_FORNECEDORES,
  CABECALHOS_FORNECEDORES,
  ABA_SUBPRODUTOS,
  CABECALHOS_SUBPRODUTOS,
  ABA_PRODUTOS,
  CABECALHOS_PRODUTOS
} = require('../Config/constants');

// --- Funções Auxiliares de Lógica (Migradas) ---

function normalizarTextoComparacao(texto) {
  if (!texto || typeof texto !== 'string') return "";
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function normalizarCnpjComparacao(cnpj) {
  if (!cnpj || typeof cnpj !== 'string') return "";
  return cnpj.replace(/\D/g, ''); // Remove todos os não dígitos
}

/**
 * Gera o próximo ID sequencial.
 * @param {Array<Array<string>>} data - Os dados brutos da planilha (com cabeçalho).
 * @param {number} idColumnIndex - O índice (0-based) da coluna de ID.
 * @returns {number} O próximo ID.
 */
function gerarProximoId(data, idColumnIndex) {
  let maxId = 0;
  if (data.length > 1) { // Se tem mais que só o cabeçalho
    for (let i = 1; i < data.length; i++) {
      const currentId = parseInt(data[i][idColumnIndex], 10);
      if (!isNaN(currentId) && currentId > maxId) {
        maxId = currentId;
      }
    }
  }
  return maxId + 1;
}

// --- Funções do Controller (Exportadas para o Router) ---

/**
 * (Migrado de FornecedoresController_obterDadosCompletosFornecedores)
 * Obtém os dados dos fornecedores de forma paginada e com filtro de busca.
 */
async function obterListaProdutosPaginada(req, res) {
  try {
    const { pagina = 1, itensPorPagina = 10, termoBusca = null } = req.body;
    const termoBuscaNorm = termoBusca ? normalizarTextoComparacao(termoBusca) : null;

    // 1. Busca TODOS os dados (o CRUD não sabe sobre paginação)
    const todosDados = await FornecedoresCRUD.getFornecedoresPlanilha(req.sheets, req.constants.ID_PLANILHA_NF); // Assumindo NF, mude se for outra
    
    if (todosDados.length <= 1) { // Apenas cabeçalho
      return res.json({ 
        success: true,
        cabecalhosParaExibicao: CABECALHOS_FORNECEDORES.slice(0, 5), // Exemplo
        fornecedoresPaginados: [], totalItens: 0, paginaAtual: 1, totalPaginas: 1
      });
    }

    // 2. Converte para objetos
    let todosFornecedoresObj = FornecedoresCRUD.sheetDataToObjects(todosDados, CABECALHOS_FORNECEDORES);

    // 3. Aplica filtro de busca (se existir)
    let fornecedoresFiltrados = todosFornecedoresObj;
    if (termoBuscaNorm) {
      fornecedoresFiltrados = todosFornecedoresObj.filter(fornecedor => {
        // Itera sobre os valores do objeto para encontrar o termo
        return Object.values(fornecedor).some(valor => 
          normalizarTextoComparacao(String(valor)).includes(termoBuscaNorm)
        );
      });
    }
    
    // 4. Aplica paginação
    const totalItens = fornecedoresFiltrados.length;
    const totalPaginas = Math.ceil(totalItens / itensPorPagina) || 1;
    const paginaAjustada = Math.min(Math.max(1, pagina), totalPaginas);
    const offset = (paginaAjustada - 1) * itensPorPagina;
    const fornecedoresPaginados = fornecedoresFiltrados.slice(offset, offset + itensPorPagina);
    
    // 5. Retorna os dados paginados
    res.json({
      success: true,
      cabecalhosParaExibicao: CABECALHOS_FORNECEDORES.slice(2, 7), // Ajuste conforme suas colunas de exibição
      fornecedoresPaginados: fornecedoresPaginados,
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
 * (Migrado de FornecedoresController_criarNovoFornecedor)
 * Cria um novo fornecedor.
 */
async function criarNovoFornecedor(req, res) {
  try {
    const dadosNovoFornecedor = req.body;
    const nomeNovoFornecedor = dadosNovoFornecedor["Fornecedor"];
    const cnpjNovoFornecedor = dadosNovoFornecedor["CNPJ"];

    if (!nomeNovoFornecedor) {
      return res.status(400).json({ success: false, message: "Nome do Fornecedor é obrigatório." });
    }

    const todosDados = await FornecedoresCRUD.getFornecedoresPlanilha(req.sheets, req.constants.ID_PLANILHA_NF);
    const cabecalhosDaPlanilha = todosDados[0].map(String);
    const idColunaIndex = cabecalhosDaPlanilha.indexOf("ID");
    const nomeFornecedorColunaIndex = cabecalhosDaPlanilha.indexOf("Fornecedor");
    const cnpjColunaIndex = cabecalhosDaPlanilha.indexOf("CNPJ");

    if (idColunaIndex === -1 || nomeFornecedorColunaIndex === -1 || cnpjColunaIndex === -1) {
      throw new Error("Colunas essenciais (ID, Fornecedor, CNPJ) não encontradas na planilha.");
    }

    // Validação de duplicidade
    const nomeNovoNorm = normalizarTextoComparacao(nomeNovoFornecedor);
    const cnpjNovoNorm = normalizarCnpjComparacao(cnpjNovoFornecedor);

    for (let i = 1; i < todosDados.length; i++) {
      const nomeLinhaAtual = todosDados[i][nomeFornecedorColunaIndex];
      const cnpjLinhaAtual = todosDados[i][cnpjColunaIndex];

      if (normalizarTextoComparacao(nomeLinhaAtual) === nomeNovoNorm) {
        throw new Error(`O nome de fornecedor '${nomeNovoFornecedor}' já está cadastrado.`);
      }
      if (cnpjNovoFornecedor && normalizarCnpjComparacao(cnpjLinhaAtual) === cnpjNovoNorm) {
        throw new Error(`O CNPJ '${cnpjNovoFornecedor}' já está cadastrado.`);
      }
    }

    const novoIdGerado = gerarProximoId(todosDados, idColunaIndex);
    dadosNovoFornecedor["ID"] = novoIdGerado; // Adiciona o novo ID ao objeto

    // Converte o objeto para um array na ordem correta da planilha
    const novaLinhaArray = FornecedoresCRUD.objectToSheetRow(dadosNovoFornecedor, cabecalhosDaPlanilha);

    await FornecedoresCRUD.appendFornecedor(req.sheets, req.constants.ID_PLANILHA_NF, novaLinhaArray);

    res.json({ success: true, message: "Fornecedor criado com sucesso!", novoId: novoIdGerado });

  } catch (e) {
    console.error("ERRO em criarNovoFornecedor:", e);
    res.status(500).json({ success: false, message: e.message });
  }
}

/**
 * (Migrado de FornecedoresController_atualizarFornecedor)
 * Atualiza um fornecedor existente.
 */
async function atualizarFornecedor(req, res) {
  try {
    const dadosAtualizar = req.body;
    const idParaAtualizar = String(dadosAtualizar["ID"]);
    if (!idParaAtualizar) {
      return res.status(400).json({ success: false, message: "ID do fornecedor é obrigatório." });
    }

    const todosDados = await FornecedoresCRUD.getFornecedoresPlanilha(req.sheets, req.constants.ID_PLANILHA_NF);
    const cabecalhosDaPlanilha = todosDados[0].map(String);
    const idxId = cabecalhosDaPlanilha.indexOf("ID");
    const idxNome = cabecalhosDaPlanilha.indexOf("Fornecedor");

    let linhaIndex = -1; // 0-based
    for (let i = 1; i < todosDados.length; i++) {
      if (String(todosDados[i][idxId]) === idParaAtualizar) {
        linhaIndex = i;
        break;
      }
    }

    if (linhaIndex === -1) {
      throw new Error(`Fornecedor com ID '${idParaAtualizar}' não encontrado.`);
    }

    const nomeAntigo = String(todosDados[linhaIndex][idxNome]);
    const nomeAtualizado = dadosAtualizar["Fornecedor"];
    if (!nomeAtualizado) {
      throw new Error("Nome do Fornecedor é obrigatório.");
    }

    // Validar duplicidade
    const nomeAtualNorm = normalizarTextoComparacao(nomeAtualizado);
    for (let i = 1; i < todosDados.length; i++) {
      if (i !== linhaIndex && normalizarTextoComparacao(String(todosDados[i][idxNome])) === nomeAtualNorm) {
        throw new Error(`O nome '${nomeAtualizado}' já está cadastrado para outro ID.`);
      }
    }

    // Montar linha atualizada
    const linhaOriginal = todosDados[linhaIndex];
    const linhaAtualizadaArray = cabecalhosDaPlanilha.map((cab, k) => {
      if (k === idxId || k === cabecalhosDaPlanilha.indexOf("Data de Cadastro")) {
        return linhaOriginal[k]; // Mantém ID e Data de Cadastro
      }
      // Se o dado veio no body, usa, senão mantém o original
      return dadosAtualizar[cab] !== undefined ? dadosAtualizar[cab] : linhaOriginal[k];
    });

    // 1. Atualiza a linha do fornecedor
    await FornecedoresCRUD.updateFornecedorRow(req.sheets, req.constants.ID_PLANILHA_NF, linhaIndex, linhaAtualizadaArray, cabecalhosDaPlanilha.length);

    // 2. Propaga a mudança de nome para SubProdutos (se o nome mudou)
    if (nomeAntigo !== nomeAtualizado) {
      await FornecedoresCRUD.propagarNomeFornecedor(req.sheets, req.constants.ID_PLANILHA_NF, nomeAntigo, nomeAtualizado);
    }

    res.json({ success: true, message: "Fornecedor atualizado com sucesso!" });

  } catch (e) {
    console.error("ERRO em atualizarFornecedor:", e);
    res.status(500).json({ success: false, message: e.message });
  }
}

/**
 * (Migrado de FornecedoresCRUD_obterSubProdutosPorNomeFornecedor)
 * API para obter subprodutos de um fornecedor.
 */
async function obterSubProdutos(req, res) {
  try {
    const { nomeFornecedor } = req.body;
    if (!nomeFornecedor) {
      return res.status(400).json({ success: false, message: "Nome do fornecedor não fornecido." });
    }
    const dados = await FornecedoresCRUD.getSubProdutosPorFornecedor(req.sheets, req.constants.ID_PLANILHA_NF, nomeFornecedor);
    res.json({ success: true, dados: dados });
  } catch (e) {
    console.error("ERRO em obterSubProdutos:", e);
    res.status(500).json({ success: false, message: e.message });
  }
}

/**
 * (Migrado de FornecedoresCRUD_obterListaOutrosFornecedores)
 * API para obter outros fornecedores (para realocação).
 */
async function obterOutrosFornecedores(req, res) {
  try {
    const { idFornecedorExcluido } = req.body;
    const todosDados = await FornecedoresCRUD.getFornecedoresPlanilha(req.sheets, req.constants.ID_PLANILHA_NF);
    const dados = FornecedoresCRUD.getOutrosFornecedores(todosDados, idFornecedorExcluido);
    res.json({ success: true, dados: dados });
  } catch (e) {
    console.error("ERRO em obterOutrosFornecedores:", e);
    res.status(500).json({ success: false, message: e.message });
  }
}

/**
 * (Migrado de FornecedoresCRUD_processarExclusaoFornecedor)
 * API para excluir um fornecedor e lidar com seus subprodutos.
 */
async function excluirFornecedor(req, res) {
  try {
    const { idFornecedor, nomeFornecedorOriginal, deletarSubprodutosVinculados, realocacoesSubprodutos } = req.body;

    if (!idFornecedor || !nomeFornecedorOriginal) {
      return res.status(400).json({ success: false, message: "ID e Nome do Fornecedor são obrigatórios." });
    }

    // 1. Encontrar a linha (0-based) do fornecedor para excluir
    const todosDadosForn = await FornecedoresCRUD.getFornecedoresPlanilha(req.sheets, req.constants.ID_PLANILHA_NF);
    const idxId = todosDadosForn[0].indexOf("ID");
    let linhaIndexFornecedor = -1;
    for (let i = 1; i < todosDadosForn.length; i++) {
      if (String(todosDadosForn[i][idxId]) === String(idFornecedor)) {
        linhaIndexFornecedor = i; // 0-based
        break;
      }
    }
    if (linhaIndexFornecedor === -1) {
      throw new Error(`Fornecedor com ID '${idFornecedor}' não encontrado para exclusão.`);
    }

    // 2. Preparar listas de subprodutos para exclusão ou realocação
    const subprodutosParaExcluirIndices = []; // 0-based
    const realocacoesComIndex = [];
    
    if (deletarSubprodutosVinculados || (realocacoesSubprodutos && realocacoesSubprodutos.length > 0)) {
      // Precisamos dos dados dos subprodutos
      const dadosSub = await SubProdutosCRUD.getSubProdutosPlanilha(req.sheets, req.constants.ID_PLANILHA_NF); // Esta função precisa ser criada em SubProdutosCRUD
      const cabecalhosSub = dadosSub[0].map(String);
      const idxSubId = cabecalhosSub.indexOf("ID");
      const idxSubForn = cabecalhosSub.indexOf("Fornecedor");
      const nomeFornNorm = normalizarTextoComparacao(nomeFornecedorOriginal);
      
      const mapaRealocacao = (realocacoesSubprodutos || []).reduce((map, r) => {
        map[r.subProdutoId] = r.novoFornecedorNome;
        return map;
      }, {});

      for (let i = 1; i < dadosSub.length; i++) {
        if (normalizarTextoComparacao(dadosSub[i][idxSubForn]) === nomeFornNorm) {
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
    await FornecedoresCRUD.batchExcluirFornecedorEAtualizarSubprodutos(
      req.sheets,
      req.constants.ID_PLANILHA_NF,
      linhaIndexFornecedor,
      deletarSubprodutosVinculados,
      realocacoesComIndex,
      subprodutosParaExcluirIndices
    );

    res.json({ success: true, message: `Fornecedor '${nomeFornecedorOriginal}' e seus subprodutos foram processados.` });

  } catch (e) {
    console.error("ERRO em excluirFornecedor:", e);
    res.status(500).json({ success: false, message: e.message });
  }
}

// Exporta as funções para o Router
module.exports = {
  obterListaProdutosPaginada,
  criarNovoFornecedor,
  atualizarFornecedor,
  obterSubProdutos,
  obterOutrosFornecedores,
  excluirFornecedor
};