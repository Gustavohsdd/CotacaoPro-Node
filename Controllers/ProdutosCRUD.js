// controllers/ProdutosCRUD.js
// Migrado e expandido a partir do 'ProdutosCRUD.js' do Apps Script.

const {
  ABA_PRODUTOS,
  CABECALHOS_PRODUTOS,
  ABA_SUBPRODUTOS,
  CABECALHOS_SUBPRODUTOS,
  ABA_FORNECEDORES,
  CABECALHOS_FORNECEDORES
} = require('../Config/constants');

// *** REMOVIDA A IMPORTAÇÃO DE SUBPRODUTOSCRUD E FORNECEDORESCRUD ***

// --- Funções Auxiliares Internas ---

/**
 * Normaliza o texto para comparação.
 * @param {string} texto 
 * @returns {string}
 */
function normalizarTextoComparacao(texto) {
  if (!texto || typeof texto !== 'string') return "";
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
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

/**
 * Converte um objeto (baseado nas constantes) para um array na ordem da planilha.
 * @param {object} obj - O objeto com os dados (ex: { Produto: "Nome" }).
 * @param {Array<string>} headersPlanilha - Os cabeçalhos REAIS da planilha (linha 1).
 * @returns {Array<string>} Um array de valores na ordem correta.
 */
function objectToSheetRow(obj, headersPlanilha) {
  return headersPlanilha.map(header => {
    if (header === "Data de Cadastro") {
      // Retorna a data no formato ISO para o Google Sheets interpretar corretamente
      return new Date().toISOString(); 
    }
    // Usa a chave da constante (CABECALHOS_PRODUTOS) para buscar o valor
    const headerConst = CABECALHOS_PRODUTOS.find(h => h === header);
    if (headerConst && obj[headerConst] !== undefined) {
      return obj[headerConst];
    }
    // Fallback para o próprio nome do header (caso o form envie de forma diferente)
    return obj[header] || "";
  });
}

/**
 * Busca o ID de uma aba (Sheet) pelo seu nome.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {string} sheetName - O nome da aba.
 * @returns {Promise<number|null>} O ID da aba.
 */
async function getSheetIdByName(sheets, spreadsheetId, sheetName) {
  const response = await sheets.spreadsheets.get({
    spreadsheetId: spreadsheetId,
  });
  const sheet = response.data.sheets.find(s => s.properties.title === sheetName);
  return sheet ? sheet.properties.sheetId : null;
}

// --- Funções CRUD Exportadas (Existentes) ---

/**
 * Busca na planilha TODOS os dados da aba Produtos.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @returns {Promise<Array<Array<string>>>} Os dados brutos da planilha (incluindo cabeçalho).
 */
async function getProdutosPlanilha(sheets, spreadsheetId) {
  console.log(`[ProdutosCRUD] Lendo dados da aba: ${ABA_PRODUTOS}`);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: ABA_PRODUTOS, // Lê a aba inteira
  });
  return response.data.values || [];
}

/**
 * (Migrado de ProdutosCRUD_obterNomesEIdsProdutos)
 * Busca uma lista simplificada de {id, nome} de todos os produtos ATIVOS.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @returns {Promise<Array<object>>} Array de objetos {id, nome}.
 */
async function getNomesEIdsProdutosAtivos(sheets, spreadsheetId) {
  try {
    const dados = await getProdutosPlanilha(sheets, spreadsheetId);
    if (dados.length < 2) return []; // Vazia

    const cabecalhos = dados[0].map(String);
    const idxIdProduto = cabecalhos.indexOf("ID");
    const idxNomeProduto = cabecalhos.indexOf("Produto");
    const idxStatusProduto = cabecalhos.indexOf("Status");

    if (idxIdProduto === -1 || idxNomeProduto === -1) {
      throw new Error("Colunas 'ID' ou 'Produto' não encontradas na aba Produtos.");
    }

    const produtos = [];
    for (let i = 1; i < dados.length; i++) {
      const linha = dados[i];
      if (linha[idxIdProduto] && linha[idxNomeProduto]) {
        // Assume 'Ativo' se a coluna de status não existir ou estiver vazia
        const isAtivo = (idxStatusProduto === -1) || 
                        !linha[idxStatusProduto] || 
                        linha[idxStatusProduto].toString().toLowerCase() === 'ativo';
        
        if (isAtivo) {
          produtos.push({
            id: linha[idxIdProduto],
            nome: linha[idxNomeProduto]
          });
        }
      }
    }
    
    produtos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
    return produtos;

  } catch (e) {
    console.error("Erro em getNomesEIdsProdutosAtivos: " + e.toString());
    return []; 
  }
}

// --- Funções CRUD Exportadas (Novas / Migradas) ---

/**
 * Adiciona uma nova linha de produto na planilha.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {Array<string>} novaLinhaArray - O array de valores na ordem correta.
 */
async function appendProduto(sheets, spreadsheetId, novaLinhaArray) {
  console.log(`[ProdutosCRUD] Adicionando nova linha em: ${ABA_PRODUTOS}`);
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId,
    range: ABA_PRODUTOS,
    valueInputOption: 'USER_ENTERED', // Para formatar datas, etc.
    resource: {
      values: [novaLinhaArray],
    },
  });
}

/**
 * Atualiza uma linha específica na aba Produtos.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {number} linhaIndex (0-based) - O índice da linha a ser atualizada.
 * @param {Array<string>} linhaAtualizadaArray - O array de valores na ordem correta.
 * @param {number} numColunas - O número total de colunas para o range.
 */
async function updateProdutoRow(sheets, spreadsheetId, linhaIndex, linhaAtualizadaArray, numColunas) {
  const linhaPlanilha = linhaIndex + 1; // getValues é 0-based, mas Ranges são 1-based
  // Determina a última coluna dinamicamente (ex: A, B, ... Z, AA, AB, ...)
  const ultimaColunaLetra = String.fromCharCode(65 + (numColunas - 1) % 26);
  const prefixoColuna = numColunas > 26 ? String.fromCharCode(64 + Math.floor((numColunas - 1) / 26)) : '';
  const range = `${ABA_PRODUTOS}!A${linhaPlanilha}:${prefixoColuna}${ultimaColunaLetra}${linhaPlanilha}`;
  
  console.log(`[ProdutosCRUD] Atualizando linha em: ${range}`);
  
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
 * (Migrado de ProdutosCRUD_obterListaOutrosProdutos)
 * Busca todos os produtos, exceto o ID especificado.
 * @param {Array<Array<string>>} todosProdutosData - Os dados brutos da planilha.
 * @param {string} idProdutoExcluido - O ID a ser ignorado.
 * @returns {Array<object>} Array de objetos {id, nome}.
 */
function getOutrosProdutos(todosProdutosData, idProdutoExcluido) {
  if (todosProdutosData.length < 2) return [];
  const cabecalhos = todosProdutosData[0].map(String);
  const idxId = cabecalhos.indexOf("ID");
  const idxNome = cabecalhos.indexOf("Produto");
  
  if (idxId === -1 || idxNome === -1) {
    throw new Error("Colunas 'ID' ou 'Produto' não encontradas na aba Produtos.");
  }
  
  const outrosProdutos = [];
  for (let i = 1; i < todosProdutosData.length; i++) {
    const idAtual = String(todosProdutosData[i][idxId]);
    if (idAtual !== String(idProdutoExcluido)) {
      outrosProdutos.push({
        id: idAtual,
        nome: todosProdutosData[i][idxNome],
      });
    }
  }
  return outrosProdutos;
}

/**
 * (Migrado de ProdutosCRUD_processarExclusaoProduto - Lógica Simplificada)
 * Executa uma operação em lote (batchUpdate) para excluir o produto e
 * (opcionalmente) atualizar ou excluir subprodutos.
 * ESTA FUNÇÃO FOI MODIFICADA E SIMPLIFICADA - ELA AGORA CHAMA O SubProdutosCRUD
 * PARA FAZER AS ATUALIZAÇÕES LÁ.
 */
async function batchExcluirProdutoEAtualizarSubprodutos(
  sheets,
  spreadsheetId,
  linhaIndexProduto,
  deletarSubprodutos,
  realocacoes,
  subprodutosParaExcluirIndices
) {
  const requests = [];
  const sheetIdProdutos = await getSheetIdByName(sheets, spreadsheetId, ABA_PRODUTOS);

  // 1. Adiciona o pedido para excluir a linha do produto
  requests.push({
    deleteDimension: {
      range: {
        sheetId: sheetIdProdutos,
        dimension: "ROWS",
        startIndex: linhaIndexProduto, // 0-based
        endIndex: linhaIndexProduto + 1
      }
    }
  });
  
  // *** A LÓGICA DE ATUALIZAR/DELETAR SUBPRODUTOS FOI MOVIDA ***
  // para o SubProdutosCRUD e será chamada pelo CONTROLLER.
  // Esta função agora só é responsável por deletar o PRODUTO.
  // As outras listas (realocacoes, subprodutosParaExcluirIndices)
  // serão tratadas pelo CONTROLLER.

  if (requests.length > 0) {
    console.log(`[ProdutosCRUD] Executando batchUpdate para DELETAR PRODUTO...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      resource: {
        requests: requests
      }
    });
  }
}


// Exporta as funções
module.exports = {
  // Funções de leitura
  getProdutosPlanilha,
  getNomesEIdsProdutosAtivos,
  getOutrosProdutos,
  
  // Funções de escrita
  appendProduto,
  updateProdutoRow,
  batchExcluirProdutoEAtualizarSubprodutos,
  
  // Funções auxiliares
  normalizarTextoComparacao,
  gerarProximoId,
  objectToSheetRow,
  getSheetIdByName
};