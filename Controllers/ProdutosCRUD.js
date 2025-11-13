// controllers/ProdutosCRUD.js
// Migrado e expandido a partir do 'ProdutosCRUD.js' do Apps Script.

const {
  ABA_PRODUTOS,
  CABECALHOS_PRODUTOS,
  ABA_SUBPRODUTOS,
  CABECALHOS_SUBPRODUTOS,
  ABA_FORNECEDORES,
  CABECALHOS_FORNECEDORES
} = require('../config/constants');

// Importa os CRUDs de outros módulos para buscar dados
const SubProdutosCRUD = require('./SubProdutosCRUD');
const FornecedoresCRUD = require('./FornecedoresCRUD');

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
 * Busca e atualiza todos os SubProdutos que continham o nome antigo do produto.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {string} nomeAntigo - O nome antigo do produto.
 * @param {string} nomeAtualizado - O novo nome do produto.
 */
async function propagarNomeProduto(sheets, spreadsheetId, nomeAntigo, nomeAtualizado) {
  console.log(`[ProdutosCRUD] Propagando mudança de nome: "${nomeAntigo}" -> "${nomeAtualizado}" em ${ABA_SUBPRODUTOS}`);
  const dadosSub = await SubProdutosCRUD.getSubProdutosPlanilha(sheets, spreadsheetId);
  if (dadosSub.length < 2) return 0; // Vazia

  const cabecalhosSub = dadosSub[0].map(String);
  const idxSubProdVinc = cabecalhosSub.indexOf("Produto Vinculado");
  if (idxSubProdVinc === -1) {
    console.warn(`[ProdutosCRUD] Coluna "Produto Vinculado" não encontrada em ${ABA_SUBPRODUTOS}. Propagação pulada.`);
    return 0;
  }

  const requests = [];
  let atualizacoes = 0;

  for (let i = 1; i < dadosSub.length; i++) {
    const linha = dadosSub[i];
    if (String(linha[idxSubProdVinc]) === nomeAntigo) {
      const linhaPlanilha = i + 1; // 1-based index
      const colunaLetra = String.fromCharCode(65 + idxSubProdVinc);
      requests.push({
        range: `${ABA_SUBPRODUTOS}!${colunaLetra}${linhaPlanilha}`,
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
    console.log(`[ProdutosCRUD] Nome do produto propagado para ${atualizacoes} subprodutos.`);
  }
  return atualizacoes;
}

/**
 * (Migrado de ProdutosCRUD_obterSubProdutosPorProduto)
 * Busca todos os subprodutos vinculados a um nome de produto.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {string} nomeProduto - O nome do produto.
 * @returns {Promise<Array<object>>} Array de objetos de subprodutos.
 */
async function obterSubProdutosPorProduto(sheets, spreadsheetId, nomeProduto) {
  try {
    if (!nomeProduto) return [];
    
    // Reutiliza a função de SubProdutosCRUD
    const subProdutos = await SubProdutosCRUD.getSubProdutosPorPai(sheets, spreadsheetId, nomeProduto, 'PRODUTO');
    return subProdutos;

  } catch (e) {
    console.error("Erro em obterSubProdutosPorProduto: " + e.toString());
    throw e;
  }
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
 * (Migrado de ProdutosCRUD_obterListaTodosFornecedores)
 * Busca uma lista simplificada de {id, nome} de todos os fornecedores.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @returns {Promise<Array<object>>} Array de objetos {id, nome}.
 */
async function getTodosFornecedores(sheets, spreadsheetId) {
  try {
    // Reutiliza a função de FornecedoresCRUD
    const dados = await FornecedoresCRUD.getFornecedoresPlanilha(sheets, spreadsheetId);
    if (dados.length < 2) return [];

    const cabecalhos = dados[0].map(String);
    const idxId = cabecalhos.indexOf("ID");
    const idxNome = cabecalhos.indexOf("Fornecedor");

    if (idxId === -1 || idxNome === -1) {
      throw new Error("Colunas 'ID' ou 'Fornecedor' não encontradas na aba Fornecedores.");
    }

    const fornecedores = [];
    for (let i = 1; i < dados.length; i++) {
      if (dados[i][idxId] && dados[i][idxNome]) {
        fornecedores.push({
          id: dados[i][idxId],
          nome: dados[i][idxNome]
        });
      }
    }
    
    fornecedores.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
    return fornecedores;

  } catch (e) {
    console.error("Erro em getTodosFornecedores: " + e.toString());
    return []; 
  }
}

/**
 * (Migrado de ProdutosCRUD_processarExclusaoProduto)
 * Executa uma operação em lote (batchUpdate) para excluir o produto e
 * (opcionalmente) atualizar ou excluir subprodutos.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {number} linhaIndexProduto (0-based) - O índice da linha do produto a excluir.
 * @param {boolean} deletarSubprodutos - Se true, exclui subprodutos.
 * @param {Array<object>} realocacoes - Array de { linhaIndex: number, novoNome: string }
 * @param {Array<number>} subprodutosParaExcluirIndices (0-based) - Índices das linhas a excluir.
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
  const sheetIdSubProdutos = await getSheetIdByName(sheets, spreadsheetId, ABA_SUBPRODUTOS);

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

  if (sheetIdSubProdutos) {
    // 2. Adiciona pedidos para realocar subprodutos (atualizar células)
    if (realocacoes && realocacoes.length > 0) {
      const idxProdVincSub = CABECALHOS_SUBPRODUTOS.indexOf("Produto Vinculado");
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
              columnIndex: idxProdVincSub
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
    console.log(`[ProdutosCRUD] Executando batchUpdate com ${requests.length} pedidos...`);
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
  // Funções existentes
  getProdutosPlanilha,
  getNomesEIdsProdutosAtivos,
  // Funções migradas de ProdutosCRUD.js (GAS)
  normalizarTextoComparacao,
  gerarProximoId,
  objectToSheetRow,
  appendProduto,
  updateProdutoRow,
  propagarNomeProduto,
  obterSubProdutosPorProduto,
  getOutrosProdutos,
  getTodosFornecedores,
  batchExcluirProdutoEAtualizarSubprodutos
  // As funções de 'adicionar' e 'atualizar' SubProduto
  // serão migradas para o SubProdutosCRUD.js
};