// Importa as constantes que criamos
const {
  ABA_FORNECEDORES,
  CABECALHOS_FORNECEDORES,
  ABA_SUBPRODUTOS,
  CABECALHOS_SUBPRODUTOS,
  ABA_PRODUTOS,
  CABECALHOS_PRODUTOS
} = require('../Config/constants');

// --- Funções Auxiliares Internas ---

/**
 * Converte um array de arrays (da planilha) em um array de objetos.
 * @param {Array<Array<string>>} data - Os dados da planilha (incluindo cabeçalho).
 * @param {Array<string>} headersConst - Os cabeçalhos esperados (de constants.js).
 * @returns {Array<object>} Um array de objetos.
 */
function sheetDataToObjects(data, headersConst) {
  if (!data || data.length < 2) return []; // Sem dados
  const headersPlanilha = data[0].map(String);
  const dataRows = data.slice(1);

  return dataRows.map(row => {
    const obj = {};
    headersConst.forEach(headerConst => {
      const indexNaPlanilha = headersPlanilha.indexOf(headerConst);
      if (indexNaPlanilha !== -1) {
        obj[headerConst] = row[indexNaPlanilha];
      } else {
        obj[headerConst] = null; // Garante que a chave exista
      }
    });
    // Garante que o ID esteja sempre presente (mesmo que não esteja nos cabeçalhos de exibição)
    const indexId = headersPlanilha.indexOf("ID");
    if (indexId !== -1 && !obj.ID) {
      obj.ID = row[indexId];
    }
    return obj;
  });
}

/**
 * Converte um objeto (baseado nas constantes) para um array na ordem da planilha.
 * @param {object} obj - O objeto com os dados (ex: { Fornecedor: "Nome" }).
 * @param {Array<string>} headersPlanilha - Os cabeçalhos REAIS da planilha (linha 1).
 * @returns {Array<string>} Um array de valores na ordem correta.
 */
function objectToSheetRow(obj, headersPlanilha) {
  return headersPlanilha.map(header => {
    if (header === "Data de Cadastro") {
      return new Date().toISOString(); // Define a data de cadastro no momento da criação
    }
    return obj[header] || ""; // Retorna o valor do objeto ou uma string vazia
  });
}


// --- Funções CRUD Exportadas ---

/**
 * (Migrado de FornecedoresController_obterDadosCompletosFornecedores)
 * Busca TODOS os dados da aba Fornecedores e seus cabeçalhos.
 * A paginação e filtro serão feitos no Controller.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @returns {Promise<Array<Array<string>>>} Os dados brutos da planilha (incluindo cabeçalho).
 */
async function getFornecedoresPlanilha(sheets, spreadsheetId) {
  console.log(`[CRUD] Lendo dados da aba: ${ABA_FORNECEDORES}`);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: ABA_FORNECEDORES, // Lê a aba inteira
  });
  return response.data.values || [];
}

/**
 * (Migrado de FornecedoresController_criarNovoFornecedor)
 * Adiciona uma nova linha de fornecedor na planilha.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {Array<string>} novaLinhaArray - O array de valores na ordem correta.
 */
async function appendFornecedor(sheets, spreadsheetId, novaLinhaArray) {
  console.log(`[CRUD] Adicionando nova linha em: ${ABA_FORNECEDORES}`);
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId,
    range: ABA_FORNECEDORES,
    valueInputOption: 'USER_ENTERED', // Para formatar datas, etc.
    resource: {
      values: [novaLinhaArray],
    },
  });
}

/**
 * (Migrado de FornecedoresController_atualizarFornecedor)
 * Atualiza uma linha específica na aba Fornecedores.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {number} linhaIndex (0-based) - O índice da linha a ser atualizada.
 * @param {Array<string>} linhaAtualizadaArray - O array de valores na ordem correta.
 * @param {number} numColunas - O número total de colunas para o range.
 */
async function updateFornecedorRow(sheets, spreadsheetId, linhaIndex, linhaAtualizadaArray, numColunas) {
  const linhaPlanilha = linhaIndex + 1; // getValues é 0-based, mas Ranges são 1-based
  const range = `${ABA_FORNECEDORES}!A${linhaPlanilha}:${String.fromCharCode(65 + numColunas - 1)}${linhaPlanilha}`;
  console.log(`[CRUD] Atualizando linha em: ${range}`);
  
  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId,
    range: range,
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [linhaAtualizadaArray],
    },
  });
}

/**
 * (Migrado de FornecedoresController_atualizarFornecedor)
 * Busca e atualiza todos os SubProdutos que continham o nome antigo do fornecedor.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {string} nomeAntigo - O nome antigo do fornecedor.
 * @param {string} nomeAtualizado - O novo nome do fornecedor.
 */
async function propagarNomeFornecedor(sheets, spreadsheetId, nomeAntigo, nomeAtualizado) {
  console.log(`[CRUD] Propagando mudança de nome: "${nomeAntigo}" -> "${nomeAtualizado}" em ${ABA_SUBPRODUTOS}`);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: ABA_SUBPRODUTOS,
  });
  const dadosSub = response.data.values || [];
  if (dadosSub.length < 2) return 0; // Vazia

  const cabecalhosSub = dadosSub[0].map(String);
  const idxSubFor = cabecalhosSub.indexOf("Fornecedor");
  if (idxSubFor === -1) {
    console.warn(`[CRUD] Coluna "Fornecedor" não encontrada em ${ABA_SUBPRODUTOS}. Propagação pulada.`);
    return 0;
  }

  const requests = [];
  let atualizacoes = 0;

  for (let i = 1; i < dadosSub.length; i++) {
    const linha = dadosSub[i];
    if (String(linha[idxSubFor]) === nomeAntigo) {
      const linhaPlanilha = i + 1; // 1-based index
      requests.push({
        range: `${ABA_SUBPRODUTOS}!${String.fromCharCode(65 + idxSubFor)}${linhaPlanilha}`,
        values: [[nomeAtualizado]],
      });
      atualizacoes++;
    }
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: spreadsheetId,
      resource: {
        valueInputOption: 'USER_ENTERED',
        data: requests,
      },
    });
    console.log(`[CRUD] Nome do fornecedor propagado para ${atualizacoes} subprodutos.`);
  }
  return atualizacoes;
}

/**
 * (Migrado de FornecedoresCRUD_obterSubProdutosPorNomeFornecedor)
 * Busca todos os subprodutos vinculados a um fornecedor.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {string} nomeFornecedor - O nome do fornecedor.
 * @returns {Promise<Array<object>>} Array de objetos de subprodutos.
 */
async function getSubProdutosPorFornecedor(sheets, spreadsheetId, nomeFornecedor) {
  console.log(`[CRUD] Buscando subprodutos para: ${nomeFornecedor}`);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: ABA_SUBPRODUTOS,
  });
  const dadosSub = response.data.values || [];
  if (dadosSub.length < 2) return [];

  const cabecalhosSub = dadosSub[0].map(String);
  const idxId = cabecalhosSub.indexOf("ID");
  const idxNome = cabecalhosSub.indexOf("SubProduto");
  const idxFornecedor = cabecalhosSub.indexOf("Fornecedor");

  if (idxId === -1 || idxNome === -1 || idxFornecedor === -1) {
    throw new Error("Colunas essenciais (ID, SubProduto, Fornecedor) não encontradas na aba SubProdutos.");
  }

  const subProdutosVinculados = [];
  const nomeFornecedorNorm = nomeFornecedor.trim();

  for (let i = 1; i < dadosSub.length; i++) {
    if (String(dadosSub[i][idxFornecedor]).trim() === nomeFornecedorNorm) {
      subProdutosVinculados.push({
        id: dadosSub[i][idxId],
        nome: dadosSub[i][idxNome],
        linhaIndex: i // 0-based index
      });
    }
  }
  return subProdutosVinculados;
}

/**
 * (Migrado de FornecedoresCRUD_obterListaOutrosFornecedores)
 * Busca todos os fornecedores, exceto o ID especificado.
 * @param {Array<Array<string>>} todosFornecedoresData - Os dados brutos da planilha.
 * @param {string} idFornecedorExcluido - O ID a ser ignorado.
 * @returns {Array<object>} Array de objetos {id, nome}.
 */
function getOutrosFornecedores(todosFornecedoresData, idFornecedorExcluido) {
  if (todosFornecedoresData.length < 2) return [];
  const cabecalhos = todosFornecedoresData[0].map(String);
  const idxId = cabecalhos.indexOf("ID");
  const idxNome = cabecalhos.indexOf("Fornecedor");
  
  if (idxId === -1 || idxNome === -1) {
    throw new Error("Colunas 'ID' ou 'Fornecedor' não encontradas na aba Fornecedores.");
  }
  
  const outrosFornecedores = [];
  for (let i = 1; i < todosFornecedoresData.length; i++) {
    const idAtual = String(todosFornecedoresData[i][idxId]);
    if (idAtual !== String(idFornecedorExcluido)) {
      outrosFornecedores.push({
        id: idAtual,
        nome: todosFornecedoresData[i][idxNome],
      });
    }
  }
  return outrosFornecedores;
}

/**
 * (Migrado de FornecedoresCRUD_processarExclusaoFornecedor)
 * Executa uma operação em lote (batchUpdate) para excluir o fornecedor e
 * (opcionalmente) atualizar ou excluir subprodutos.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {number} linhaIndexFornecedor (0-based) - O índice da linha do fornecedor a excluir.
 * @param {boolean} deletarSubprodutos - Se true, exclui subprodutos.
 * @param {Array<object>} realocacoes - Array de { linhaIndex: number, novoNome: string }
 * @param {Array<number>} subprodutosParaExcluirIndices (0-based) - Índices das linhas a excluir.
 */
async function batchExcluirFornecedorEAtualizarSubprodutos(
  sheets,
  spreadsheetId,
  linhaIndexFornecedor,
  deletarSubprodutos,
  realocacoes,
  subprodutosParaExcluirIndices
) {
  const requests = [];
  const sheetIdFornecedores = await getSheetIdByName(sheets, spreadsheetId, ABA_FORNECEDORES);
  const sheetIdSubProdutos = await getSheetIdByName(sheets, spreadsheetId, ABA_SUBPRODUTOS);

  // 1. Adiciona o pedido para excluir a linha do fornecedor
  requests.push({
    deleteDimension: {
      range: {
        sheetId: sheetIdFornecedores,
        dimension: "ROWS",
        startIndex: linhaIndexFornecedor, // 0-based
        endIndex: linhaIndexFornecedor + 1
      }
    }
  });

  if (sheetIdSubProdutos) {
    // 2. Adiciona pedidos para realocar subprodutos (atualizar células)
    if (realocacoes && realocacoes.length > 0) {
      const idxFornecedorSub = CABECALHOS_SUBPRODUTOS.indexOf("Fornecedor");
      realocacoes.forEach(r => {
        requests.push({
          updateCells: {
            rows: [{
              values: [{
                userEnteredValue: { stringValue: r.novoNome }
              }]
            }],
            fields: "userEnteredValue",
            start: {
              sheetId: sheetIdSubProdutos,
              rowIndex: r.linhaIndex, // 0-based
              columnIndex: idxFornecedorSub
            }
          }
        });
      });
    }

    // 3. Adiciona pedidos para excluir subprodutos (de baixo para cima)
    if (deletarSubprodutos && subprodutosParaExcluirIndices.length > 0) {
      // Ordena os índices em ordem decrescente para exclusão segura
      subprodutosParaExcluirIndices.sort((a, b) => b - a);
      subprodutosParaExcluirIndices.forEach(rowIndex => {
        requests.push({
          deleteDimension: {
            range: {
              sheetId: sheetIdSubProdutos,
              dimension: "ROWS",
              startIndex: rowIndex, // 0-based
              endIndex: rowIndex + 1
            }
          }
        });
      });
    }
  }

  if (requests.length > 0) {
    console.log(`[CRUD] Executando batchUpdate com ${requests.length} pedidos...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      resource: {
        requests: requests
      }
    });
  }
}

/**
 * Busca o ID de uma aba (Sheet) pelo seu nome.
 */
async function getSheetIdByName(sheets, spreadsheetId, sheetName) {
  const response = await sheets.spreadsheets.get({
    spreadsheetId: spreadsheetId,
  });
  const sheet = response.data.sheets.find(s => s.properties.title === sheetName);
  return sheet ? sheet.properties.sheetId : null;
}


// Exporta as funções para serem usadas pelo Controller
module.exports = {
  sheetDataToObjects,
  objectToSheetRow,
  getFornecedoresPlanilha,
  appendFornecedor,
  updateFornecedorRow,
  propagarNomeFornecedor,
  getSubProdutosPorFornecedor,
  getOutrosFornecedores,
  batchExcluirFornecedorEAtualizarSubprodutos,
  // Precisamos também das funções de SubProdutos que o FornecedoresScript usa
  // (Elas serão movidas para controllers/subprodutos.js, mas por enquanto linkamos aqui)
};