// controllers/SubProdutosCRUD.js
// Migrado do seu 'SubProdutosCRUD.js' e 'FornecedoresCRUD.js' original

const {
  ABA_PRODUTOS,
  CABECALHOS_PRODUTOS,
  ABA_SUBPRODUTOS,
  CABECALHOS_SUBPRODUTOS,
  ABA_FORNECEDORES,
  CABECALHOS_FORNECEDORES
} = require('../config/constants');

// ====================================================================
// FUNÇÕES AUXILIARES (INTERNAS)
// ====================================================================

/**
 * Busca o ID numérico de uma aba (sheet) pelo seu nome.
 * Necessário para operações de exclusão de linha (batchUpdate).
 * @param {object} sheets - O cliente da API Google Sheets.
 * @param {string} spreadsheetId - O ID da planilha.
 * @param {string} sheetName - O nome da aba (ex: "SubProdutos").
 * @returns {Promise<number|null>} O ID da aba ou null se não encontrada.
 */
async function _getSheetIdByName(sheets, spreadsheetId, sheetName) {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });
    const sheet = response.data.sheets.find(s => s.properties.title === sheetName);
    return sheet ? sheet.properties.sheetId : null;
  } catch (e) {
    console.error(`Erro ao buscar sheetId para "${sheetName}":`, e.message);
    return null;
  }
}

/**
 * Gera o próximo ID sequencial com base nos dados da planilha.
 * @param {Array<Array<string>>} data - Dados brutos da planilha (com cabeçalho).
 * @param {number} idColumnIndex - O índice da coluna de ID.
 * @returns {number} O próximo ID.
 */
function _gerarProximoId(data, idColumnIndex) {
  let maxId = 0;
  if (data.length > 1) {
    for (let i = 1; i < data.length; i++) {
      const currentId = parseInt(data[i][idColumnIndex], 10);
      if (!isNaN(currentId) && currentId > maxId) {
        maxId = currentId;
      }
    }
  }
  return maxId + 1;
}

/**
 * Busca o NOME de um produto principal pelo seu ID na aba 'Produtos'.
 * @param {object} sheets - O cliente da API Google Sheets.
 * @param {string} spreadsheetId - O ID da planilha.
 * @param {string} produtoId - O ID do produto a ser buscado.
 * @returns {Promise<string|null>} O nome do produto ou null.
 */
async function _obterNomeProdutoPorId(sheets, spreadsheetId, produtoId) {
  if (!produtoId || String(produtoId).trim() === "") {
    return null; // Produto vinculado é opcional
  }
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: ABA_PRODUTOS,
  });
  
  const data = response.data.values || [];
  if (data.length < 2) return null;

  const headers = data[0].map(String);
  const idxId = headers.indexOf(CABECALHOS_PRODUTOS[1]); // "ID"
  const idxNome = headers.indexOf(CABECALHOS_PRODUTOS[2]); // "Produto"

  if (idxId === -1 || idxNome === -1) {
    throw new Error(`Colunas "ID" ou "Produto" não encontradas na aba ${ABA_PRODUTOS}.`);
  }

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxId]) === String(produtoId)) {
      return String(data[i][idxNome]);
    }
  }
  
  throw new Error(`Produto Vinculado com ID '${produtoId}' não foi encontrado.`);
}

/**
 * Encontra uma linha específica pelo seu ID.
 * @param {Array<Array<string>>} data - Dados brutos da planilha (com cabeçalho).
 * @param {number} idxId - O índice da coluna de ID.
 * @param {string} idParaEncontrar - O ID a ser buscado.
 * @returns {{rowData: Array<string>, rowIndex: number}|null} O objeto da linha e seu índice (0-based) ou null.
 */
function _obterLinhaPorId(data, idxId, idParaEncontrar) {
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxId]) === String(idParaEncontrar)) {
      return { rowData: data[i], rowIndex: i }; // rowIndex é 0-based
    }
  }
  return null;
}

/**
 * Mapeia um objeto de dados (vindo do frontend) para um array na ordem correta dos cabeçalhos da planilha.
 * @param {object} dadosItem - O objeto (ex: { SubProduto: "Item A", ... }).
 * @param {Array<string>} headersPlanilha - Os cabeçalhos reais da planilha (linha 1).
 * @param {string} nomeProdutoParaSalvar - O nome do produto (resolvido do ID).
 * @param {string} [novoId] - O ID a ser inserido (apenas para criação).
 * @returns {Array<string>} Um array de valores na ordem correta da planilha.
 */
function _mapObjetoParaLinha(dadosItem, headersPlanilha, nomeProdutoParaSalvar, novoId = null) {
  return headersPlanilha.map(header => {
    switch (header) {
      case "ID":
        return novoId; // Usado apenas na criação
      case "Data de Cadastro":
        return new Date().toISOString(); // Usado apenas na criação
      case "Produto Vinculado":
        return nomeProdutoParaSalvar;
      default:
        // Pega todos os outros valores que vieram do formulário
        return dadosItem[header] || "";
    }
  });
}

// ====================================================================
// FUNÇÕES CRUD (EXPORTADAS)
// ====================================================================

/**
 * Busca na planilha TODOS os dados da aba SubProdutos.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @returns {Promise<Array<Array<string>>>} Os dados brutos da planilha (incluindo cabeçalho).
 */
async function getSubProdutosPlanilha(sheets, spreadsheetId) {
  console.log(`[SubProdutosCRUD] Lendo dados da aba: ${ABA_SUBPRODUTOS}`);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: ABA_SUBPRODUTOS, // Lê a aba inteira
  });
  return response.data.values || [];
}

/**
 * Converte uma linha de array da planilha para um objeto JS limpo.
 * @param {Array} rowArray A linha de dados da planilha.
 * @param {Array} headers O array de cabeçalhos da planilha.
 * @return {Object} Um objeto representando o SubProduto.
 */
function mapSubProdutoRowToObject(rowArray, headers) {
  const obj = {};
  headers.forEach((header, index) => {
    obj[header] = rowArray[index];
  });
  // Garante que o frontend receba os IDs que espera
  obj['ID_SubProduto'] = rowArray[headers.indexOf("ID")];
  obj['SubProduto'] = rowArray[headers.indexOf("SubProduto")];
  return obj;
}


/**
 * (Migrado de SubProdutosCRUD_obterSubProdutosPorPai_NOVO)
 * Obtém todos os itens (subprodutos) vinculados a um nome de pai (Fornecedor ou Produto).
 */
async function getSubProdutosPorPai(sheets, spreadsheetId, nomePai, tipoPai) {
  try {
    if (tipoPai !== 'FORNECEDOR' && tipoPai !== 'PRODUTO') {
      throw new Error("Tipo de pai inválido. Deve ser 'FORNECEDOR' ou 'PRODUTO'.");
    }
    if (!nomePai) return [];

    const dados = await getSubProdutosPlanilha(sheets, spreadsheetId);
    if (dados.length < 2) return [];

    const headers = dados[0].map(String);
    const dataRows = dados.slice(1);
    
    const itensVinculados = [];
    const nomePaiNormalizado = String(nomePai).trim();
    
    const colunaFiltroNome = tipoPai === 'FORNECEDOR' ? "Fornecedor" : "Produto Vinculado";
    const colunaFiltroIdx = headers.indexOf(colunaFiltroNome);

    if (colunaFiltroIdx === -1) {
      throw new Error(`A coluna "${colunaFiltroNome}" não foi encontrada na aba SubProdutos.`);
    }

    for (const row of dataRows) {
      const valorCelulaNormalizado = String(row[colunaFiltroIdx] || '').trim();
      // Comparação case-insensitive
      if (valorCelulaNormalizado.toLowerCase() === nomePaiNormalizado.toLowerCase()) {
        itensVinculados.push(mapSubProdutoRowToObject(row, headers));
      }
    }
    return itensVinculados;
  } catch (e) {
    console.error(`Erro em getSubProdutosPorPai (tipo: ${tipoPai}): ` + e.toString());
    throw e; 
  }
}

/**
 * (Migrado de SubProdutosCRUD_obterDetalhesSubProdutoPorId)
 * Obtém os detalhes completos de um item (subproduto) específico pelo seu ID.
 */
async function getDetalhesSubProdutoPorId(sheets, spreadsheetId, itemId) {
  try {
    const dados = await getSubProdutosPlanilha(sheets, spreadsheetId);
    if (dados.length < 2) return null;

    const headers = dados[0].map(String);
    const idxId = headers.indexOf("ID");
    if (idxId === -1) {
      throw new Error("Coluna 'ID' não encontrada na aba SubProdutos.");
    }

    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][idxId]) === String(itemId)) {
        return mapSubProdutoRowToObject(dados[i], headers);
      }
    }
    return null; // Item não encontrado
  } catch (e) {
    console.error("Erro em getDetalhesSubProdutoPorId: " + e.toString());
    throw e;
  }
}

/**
 * [NOVO] Cria um novo SubProduto (lógica portada de FornecedoresCRUD.js).
 */
async function criarNovoSubProduto(sheets, spreadsheetId, dadosItem) {
  try {
    // 1. Validar e resolver o Nome do Produto Vinculado a partir do ID
    const idProdutoVinculado = dadosItem["Produto Vinculado"];
    const nomeProdutoParaSalvar = await _obterNomeProdutoPorId(sheets, spreadsheetId, idProdutoVinculado);
    if (idProdutoVinculado && !nomeProdutoParaSalvar) {
      throw new Error(`Produto Vinculado com ID '${idProdutoVinculado}' não encontrado.`);
    }

    // 2. Buscar dados da planilha para gerar ID e checar duplicatas
    const dados = await getSubProdutosPlanilha(sheets, spreadsheetId);
    const headersPlanilha = dados[0].map(String);
    const idxId = headersPlanilha.indexOf("ID");
    const idxSubProduto = headersPlanilha.indexOf("SubProduto");
    const idxProdutoVinc = headersPlanilha.indexOf("Produto Vinculado");

    // 3. Gerar novo ID
    const novoId = _gerarProximoId(dados, idxId);

    // 4. Montar a linha do array
    const novaLinhaArray = _mapObjetoParaLinha(dadosItem, headersPlanilha, nomeProdutoParaSalvar, novoId);
    
    // 5. Salvar na planilha
    await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: ABA_SUBPRODUTOS,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [novaLinhaArray],
      },
    });
    
    return { success: true, message: "Item adicionado com sucesso!", newItemId: novoId };
  } catch (e) {
    console.error("Erro em criarNovoSubProduto: " + e.toString());
    throw e;
  }
}

/**
 * [NOVO] Atualiza um SubProduto (lógica portada de FornecedoresCRUD.js).
 */
async function atualizarSubProduto(sheets, spreadsheetId, dadosItem) {
  try {
    const itemIdParaEditar = dadosItem.ID_SubProduto_Edicao;
    if (!itemIdParaEditar) {
      throw new Error("ID do item para edição não fornecido.");
    }

    // 1. Validar e resolver o Nome do Produto Vinculado
    const idProdutoVinculado = dadosItem["Produto Vinculado"];
    const nomeProdutoParaSalvar = await _obterNomeProdutoPorId(sheets, spreadsheetId, idProdutoVinculado);
    if (idProdutoVinculado && !nomeProdutoParaSalvar) {
      throw new Error(`Produto Vinculado com ID '${idProdutoVinculado}' não encontrado.`);
    }

    // 2. Buscar dados da planilha
    const dados = await getSubProdutosPlanilha(sheets, spreadsheetId);
    const headersPlanilha = dados[0].map(String);
    const idxId = headersPlanilha.indexOf("ID");

    // 3. Encontrar a linha a ser editada
    const { rowData, rowIndex } = _obterLinhaPorId(dados, idxId, itemIdParaEditar);
    if (!rowData) {
      throw new Error(`Item com ID '${itemIdParaEditar}' não encontrado para atualização.`);
    }

    // 4. Montar a linha atualizada
    const linhaPlanilha = rowIndex + 1; // 1-based index
    const linhaAtualizadaArray = headersPlanilha.map((header, index) => {
      // Campos que não mudam na edição
      if (header === "ID" || header === "Data de Cadastro") {
        return rowData[index];
      }
      // Campo que foi resolvido (ID -> Nome)
      if (header === "Produto Vinculado") {
        return nomeProdutoParaSalvar;
      }
      // Outros campos que vêm do formulário
      if (dadosItem.hasOwnProperty(header)) {
        return dadosItem[header];
      }
      // Campos não enviados (ex: Fornecedor, que é editado no modal do Fornecedor)
      return rowData[index];
    });

    // 5. Salvar na planilha
    const range = `${ABA_SUBPRODUTOS}!A${linhaPlanilha}:${String.fromCharCode(65 + headersPlanilha.length - 1)}${linhaPlanilha}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [linhaAtualizadaArray],
      },
    });

    return { success: true, message: "Item atualizado com sucesso." };
  } catch (e) {
    console.error("Erro em atualizarSubProduto: " + e.toString());
    throw e;
  }
}

/**
 * [NOVO] Exclui um SubProduto (lógica portada de FornecedoresCRUD.js).
 */
async function excluirSubProduto(sheets, spreadsheetId, itemId) {
  try {
    // 1. Buscar dados e ID da aba
    const sheetId = await _getSheetIdByName(sheets, spreadsheetId, ABA_SUBPRODUTOS);
    if (!sheetId) {
      throw new Error(`Aba "${ABA_SUBPRODUTOS}" não foi encontrada para obter o ID.`);
    }

    const dados = await getSubProdutosPlanilha(sheets, spreadsheetId);
    const idxId = dados[0].indexOf("ID");
    
    // 2. Encontrar o índice da linha (0-based)
    const { rowData, rowIndex } = _obterLinhaPorId(dados, idxId, itemId);
    if (!rowData) {
      throw new Error(`Item com ID '${itemId}' não encontrado para exclusão.`);
    }

    // 3. Criar a requisição de exclusão
    const deleteRequest = {
      deleteDimension: {
        range: {
          sheetId: sheetId,
          dimension: "ROWS",
          startIndex: rowIndex, // 0-based
          endIndex: rowIndex + 1
        }
      }
    };

    // 4. Executar o batchUpdate
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      resource: {
        requests: [deleteRequest]
      }
    });

    return { success: true, message: "Item excluído com sucesso." };
  } catch (e) {
    console.error("Erro em excluirSubProduto: " + e.toString());
    throw e;
  }
}

// Exporta as funções
module.exports = {
  getSubProdutosPlanilha,
  getSubProdutosPorPai,
  getDetalhesSubProdutoPorId,
  criarNovoSubProduto,
  atualizarSubProduto,
  excluirSubProduto
};