// CotacaoPro-Node/Controllers/ConciliacaoNFCrud.js
// Migrado de Araujo-PTC/src/ConciliacaoNFCrud.js

const { google } = require('googleapis');
const { getAuth } = require('../cotacaopro-node-service-account.json');
const constants = require('../config/constants');

const sheets = google.sheets('v4');
const drive = google.drive('v3');

// --- FUNÇÕES HELPER (Baseado em outros CRUDs do projeto) ---

/**
 * Encontra os índices das colunas com base nos nomes dos cabeçalhos.
 * @param {Array<string>} headers - A linha de cabeçalho da planilha.
 * @param {Array<string>} V - Os nomes dos cabeçalhos a serem encontrados.
 * @returns {Object} - Um objeto mapeando nomes de cabeçalho para seus índices.
 */
function findHeaderIndices(headers, V) {
  const indices = {};
  V.forEach(headerName => {
    const index = headers.indexOf(headerName);
    if (index !== -1) {
      indices[headerName] = index;
    } else {
      console.warn(`Cabeçalho não encontrado: ${headerName}`);
    }
  });
  return indices;
}

/**
 * Mapeia linhas de dados da planilha para objetos, com base nos cabeçalhos.
 * @param {Array<Array<string>>} data - Os dados da planilha (incluindo cabeçalho).
 * @param {Array<string>} V - Os nomes dos cabeçalhos a serem mapeados.
 * @returns {Array<Object>} - Um array de objetos representando os dados.
 */
function mapDataToObjects(data, V) {
  if (!data || data.length < 2) {
    return []; // Retorna vazio se não houver dados ou apenas cabeçalho
  }
  const headers = data[0];
  const indices = findHeaderIndices(headers, V);
  const headerKeys = Object.keys(indices);

  return data.slice(1).map(row => {
    const obj = {};
    headerKeys.forEach(key => {
      const index = indices[key];
      obj[key] = row[index];
    });
    return obj;
  });
}

/**
 * Converte um objeto de dados em uma linha de array, com base na ordem dos cabeçalhos.
 * @param {Object} dataObject - O objeto de dados.
 * @param {Array<string>} headers - O array de cabeçalhos definindo a ordem.
 * @returns {Array<string>} - Um array de valores na ordem correta.
 */
function mapObjectToRow(dataObject, headers) {
  return headers.map(header => dataObject[header] || ""); // Garante que a ordem seja mantida
}

// --- FUNÇÕES DE LEITURA (GET) ---

/**
 * Busca todas as Notas Fiscais da planilha.
 * @param {Object} auth - Cliente de autenticação do Google.
 * @returns {Promise<Array<Object>>} - Um array de objetos de notas fiscais.
 */
async function getNotasFiscais(auth) {
  try {
    const res = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: constants.ID_PLANILHA_NF,
      range: constants.ABA_NF_NOTAS_FISCAIS,
    });
    return mapDataToObjects(res.data.values, constants.CABECALHOS_NF_NOTAS_FISCAIS);
  } catch (err) {
    console.error('Erro ao buscar Notas Fiscais:', err);
    throw err;
  }
}

/**
 * Busca os Itens de uma NF específica pela Chave de Acesso.
 * @param {Object} auth - Cliente de autenticação do Google.
 * @param {string} chaveAcesso - A Chave de Acesso da NF.
 * @returns {Promise<Array<Object>>} - Um array de objetos de itens da NF.
 */
async function getItensNF(auth, chaveAcesso) {
  try {
    const res = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: constants.ID_PLANILHA_NF,
      range: constants.ABA_NF_ITENS,
    });
    
    const allItens = mapDataToObjects(res.data.values, constants.CABECALHOS_NF_ITENS);
    
    // Filtra os itens pela Chave de Acesso
    return allItens.filter(item => item["Chave de Acesso"] === chaveAcesso);
  } catch (err) {
    console.error(`Erro ao buscar Itens da NF ${chaveAcesso}:`, err);
    throw err;
  }
}

/**
 * Busca as Faturas de uma NF específica pela Chave de Acesso.
 * @param {Object} auth - Cliente de autenticação do Google.
 * @param {string} chaveAcesso - A Chave de Acesso da NF.
 * @returns {Promise<Array<Object>>} - Um array de objetos de faturas da NF.
 */
async function getFaturasNF(auth, chaveAcesso) {
  try {
    const res = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: constants.ID_PLANILHA_NF,
      range: constants.ABA_NF_FATURAS,
    });
    
    const allFaturas = mapDataToObjects(res.data.values, constants.CABECALHOS_NF_FATURAS);
    
    // Filtra as faturas pela Chave de Acesso
    return allFaturas.filter(fatura => fatura["Chave de Acesso"] === chaveAcesso);
  } catch (err) {
    console.error(`Erro ao buscar Faturas da NF ${chaveAcesso}:`, err);
    throw err;
  }
}

/**
 * Busca os dados de Transporte de uma NF específica pela Chave de Acesso.
 * @param {Object} auth - Cliente de autenticação do Google.
 * @param {string} chaveAcesso - A Chave de Acesso da NF.
 * @returns {Promise<Array<Object>>} - Um array de objetos de transporte da NF.
 */
async function getTransporteNF(auth, chaveAcesso) {
  try {
    const res = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: constants.ID_PLANILHA_NF,
      range: constants.ABA_NF_TRANSPORTE,
    });
    
    const allTransporte = mapDataToObjects(res.data.values, constants.CABECALHOS_NF_TRANSPORTE);
    
    // Filtra os dados de transporte pela Chave de Acesso
    return allTransporte.filter(transp => transp["Chave de Acesso"] === chaveAcesso);
  } catch (err) {
    console.error(`Erro ao buscar Transporte da NF ${chaveAcesso}:`, err);
    throw err;
  }
}

/**
 * Busca os Tributos Totais de uma NF específica pela Chave de Acesso.
 * @param {Object} auth - Cliente de autenticação do Google.
 * @param {string} chaveAcesso - A Chave de Acesso da NF.
 * @returns {Promise<Array<Object>>} - Um array de objetos de tributos da NF.
 */
async function getTributosTotaisNF(auth, chaveAcesso) {
  try {
    const res = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: constants.ID_PLANILHA_NF,
      range: constants.ABA_NF_TRIBUTOS_TOTAIS,
    });
    
    const allTributos = mapDataToObjects(res.data.values, constants.CABECALHOS_NF_TRIBUTOS_TOTAIS);
    
    // Filtra os tributos pela Chave de Acesso
    return allTributos.filter(trib => trib["Chave de Acesso"] === chaveAcesso);
  } catch (err) {
    console.error(`Erro ao buscar Tributos Totais da NF ${chaveAcesso}:`, err);
    throw err;
  }
}

/**
 * Busca todas as Regras de Rateio da planilha Financeiro.
 * @param {Object} auth - Cliente de autenticação do Google.
 * @returns {Promise<Array<Object>>} - Um array de objetos de regras de rateio.
 */
async function getRegrasRateio(auth) {
  try {
    const res = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: constants.ID_PLANILHA_FINANCEIRO,
      range: constants.ABA_FINANCEIRO_REGRAS_RATEIO,
    });
    return mapDataToObjects(res.data.values, constants.CABECALHOS_FINANCEIRO_REGRAS_RATEIO);
  } catch (err) {
    console.error('Erro ao buscar Regras de Rateio:', err);
    throw err;
  }
}

/**
 * Busca as Contas a Pagar de uma NF específica pela Chave de Acesso.
 * @param {Object} auth - Cliente de autenticação do Google.
 * @param {string} chaveAcesso - A Chave de Acesso da NF.
 * @returns {Promise<Array<Object>>} - Um array de objetos de contas a pagar.
 */
async function getContasAPagar(auth, chaveAcesso) {
  try {
    const res = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: constants.ID_PLANILHA_FINANCEIRO,
      range: constants.ABA_FINANCEIRO_CONTAS_A_PAGAR,
    });
    
    const allContas = mapDataToObjects(res.data.values, constants.CABECALHOS_FINANCEIRO_CONTAS_A_PAGAR);
    
    // Filtra as contas pela Chave de Acesso
    return allContas.filter(conta => conta["Chave de Acesso"] === chaveAcesso);
  } catch (err) {
    console.error(`Erro ao buscar Contas a Pagar da NF ${chaveAcesso}:`, err);
    throw err;
  }
}


// --- FUNÇÕES DE ESCRITA (UPDATE/INSERT) ---

/**
 * Adiciona uma nova linha de Nota Fiscal na planilha.
 * @param {Object} auth - Cliente de autenticação do Google.
 * @param {Object} dataObject - O objeto contendo os dados da NF.
 * @returns {Promise<Object>} - O resultado da operação de append.
 */
async function updateNotasFiscais(auth, dataObject) {
  try {
    const row = mapObjectToRow(dataObject, constants.CABECALHOS_NF_NOTAS_FISCAIS);
    const res = await sheets.spreadsheets.values.append({
      auth,
      spreadsheetId: constants.ID_PLANILHA_NF,
      range: constants.ABA_NF_NOTAS_FISCAIS,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [row],
      },
    });
    console.log(`Nota Fiscal ${dataObject["Chave de Acesso"]} adicionada.`);
    return res.data;
  } catch (err) {
    console.error('Erro ao atualizar Nota Fiscal:', err);
    throw err;
  }
}

/**
 * Adiciona novas linhas de Itens da NF na planilha.
 * @param {Object} auth - Cliente de autenticação do Google.
 * @param {Array<Object>} dataObjects - Um array de objetos, um para cada item.
 * @returns {Promise<Object>} - O resultado da operação de append.
 */
async function updateItensNF(auth, dataObjects) {
  try {
    const rows = dataObjects.map(obj => mapObjectToRow(obj, constants.CABECALHOS_NF_ITENS));
    if (rows.length === 0) return;

    const res = await sheets.spreadsheets.values.append({
      auth,
      spreadsheetId: constants.ID_PLANILHA_NF,
      range: constants.ABA_NF_ITENS,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: rows,
      },
    });
    console.log(`${rows.length} itens da NF ${dataObjects[0]["Chave de Acesso"]} adicionados.`);
    return res.data;
  } catch (err) {
    console.error('Erro ao atualizar Itens NF:', err);
    throw err;
  }
}

/**
 * Adiciona novas linhas de Faturas da NF na planilha.
 * @param {Object} auth - Cliente de autenticação do Google.
 * @param {Array<Object>} dataObjects - Um array de objetos, um para cada fatura.
 * @returns {Promise<Object>} - O resultado da operação de append.
 */
async function updateFaturasNF(auth, dataObjects) {
  try {
    const rows = dataObjects.map(obj => mapObjectToRow(obj, constants.CABECALHOS_NF_FATURAS));
    if (rows.length === 0) return;

    const res = await sheets.spreadsheets.values.append({
      auth,
      spreadsheetId: constants.ID_PLANILHA_NF,
      range: constants.ABA_NF_FATURAS,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: rows,
      },
    });
    console.log(`${rows.length} faturas da NF ${dataObjects[0]["Chave de Acesso"]} adicionadas.`);
    return res.data;
  } catch (err) {
    console.error('Erro ao atualizar Faturas NF:', err);
    throw err;
  }
}

/**
 * Adiciona uma nova linha de Transporte da NF na planilha.
 * @param {Object} auth - Cliente de autenticação do Google.
 * @param {Object} dataObject - O objeto contendo os dados de transporte.
 * @returns {Promise<Object>} - O resultado da operação de append.
 */
async function updateTransporteNF(auth, dataObject) {
  try {
    const row = mapObjectToRow(dataObject, constants.CABECALHOS_NF_TRANSPORTE);
    const res = await sheets.spreadsheets.values.append({
      auth,
      spreadsheetId: constants.ID_PLANILHA_NF,
      range: constants.ABA_NF_TRANSPORTE,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [row],
      },
    });
    console.log(`Transporte da NF ${dataObject["Chave de Acesso"]} adicionado.`);
    return res.data;
  } catch (err) {
    console.error('Erro ao atualizar Transporte NF:', err);
    throw err;
  }
}

/**
 * Adiciona uma nova linha de Tributos Totais da NF na planilha.
 * @param {Object} auth - Cliente de autenticação do Google.
 * @param {Object} dataObject - O objeto contendo os tributos totais.
 * @returns {Promise<Object>} - O resultado da operação de append.
 */
async function updateTributosTotaisNF(auth, dataObject) {
  try {
    const row = mapObjectToRow(dataObject, constants.CABECALHOS_NF_TRIBUTOS_TOTAIS);
    const res = await sheets.spreadsheets.values.append({
      auth,
      spreadsheetId: constants.ID_PLANILHA_NF,
      range: constants.ABA_NF_TRIBUTOS_TOTAIS,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [row],
      },
    });
    console.log(`Tributos da NF ${dataObject["Chave de Acesso"]} adicionados.`);
    return res.data;
  } catch (err) {
    console.error('Erro ao atualizar Tributos Totais NF:', err);
    throw err;
  }
}

/**
 * Adiciona novas linhas de Contas a Pagar na planilha.
 * @param {Object} auth - Cliente de autenticação do Google.
 * @param {Array<Object>} dataObjects - Um array de objetos, um para cada conta.
 * @returns {Promise<Object>} - O resultado da operação de append.
 */
async function updateContasAPagar(auth, dataObjects) {
  try {
    const rows = dataObjects.map(obj => mapObjectToRow(obj, constants.CABECALHOS_FINANCEIRO_CONTAS_A_PAGAR));
    if (rows.length === 0) return;
    
    const res = await sheets.spreadsheets.values.append({
      auth,
      spreadsheetId: constants.ID_PLANILHA_FINANCEIRO,
      range: constants.ABA_FINANCEIRO_CONTAS_A_PAGAR,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: rows,
      },
    });
    console.log(`${rows.length} contas a pagar da NF ${dataObjects[0]["Chave de Acesso"]} adicionadas.`);
    return res.data;
  } catch (err) {
    console.error('Erro ao atualizar Contas a Pagar:', err);
    throw err;
  }
}

// --- FUNÇÕES DE VERIFICAÇÃO E DRIVE ---

/**
 * Verifica se uma Chave de Acesso já existe na planilha de Notas Fiscais.
 * @param {Object} auth - Cliente de autenticação do Google.
 * @param {string} chaveAcesso - A Chave de Acesso a ser verificada.
 * @returns {Promise<boolean>} - True se a chave existe, False caso contrário.
 */
async function findChaveAcesso(auth, chaveAcesso) {
  try {
    const res = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: constants.ID_PLANILHA_NF,
      // Busca apenas a coluna A (Chave de Acesso)
      range: `${constants.ABA_NF_NOTAS_FISCAIS}!A2:A`, 
    });

    if (res.data.values) {
      // O resultado é um array de arrays, ex: [['chave1'], ['chave2']]
      return res.data.values.some(row => row[0] === chaveAcesso);
    }
    return false; // Não há dados
  } catch (err) {
    console.error(`Erro ao buscar Chave de Acesso ${chaveAcesso}:`, err);
    throw err;
  }
}

/**
 * Lista os arquivos XML da pasta de importação no Google Drive.
 * @param {Object} auth - Cliente de autenticação do Google.
 * @returns {Promise<Array<Object>>} - Um array de objetos de arquivos (id, name).
 */
async function getXmlFiles(auth) {
  try {
    const res = await drive.files.list({
      auth,
      q: `'${constants.ID_PASTA_XML}' in parents and (mimeType='text/xml' or mimeType='application/xml') and trashed=false`,
      fields: 'files(id, name)',
      pageSize: 100, // Limite de arquivos por vez
    });
    return res.data.files || [];
  } catch (err) {
    console.error('Erro ao listar arquivos XML do Drive:', err);
    throw err;
  }
}

/**
 * Obtém o conteúdo de um arquivo XML do Google Drive pelo ID.
 * @param {Object} auth - Cliente de autenticação do Google.
 * @param {string} fileId - O ID do arquivo no Drive.
 * @returns {Promise<string>} - O conteúdo do arquivo XML como string.
 */
async function getXmlContent(auth, fileId) {
  try {
    const res = await drive.files.get(
      { auth, fileId: fileId, alt: 'media' },
      { responseType: 'stream' } // Trata a resposta como stream
    );

    // Converte o stream para string
    return new Promise((resolve, reject) => {
      let data = '';
      res.data
        .on('data', chunk => (data += chunk))
        .on('end', () => resolve(data))
        .on('error', err => reject(err));
    });

  } catch (err) {
    console.error(`Erro ao ler conteúdo do arquivo ${fileId}:`, err);
    throw err;
  }
}

// Exporta as funções para serem usadas pelo Controller
module.exports = {
  // Funções de Leitura
  getNotasFiscais,
  getItensNF,
  getFaturasNF,
  getTransporteNF,
  getTributosTotaisNF,
  getRegrasRateio,
  getContasAPagar,

  // Funções de Escrita
  updateNotasFiscais,
  updateItensNF,
  updateFaturasNF,
  updateTransporteNF,
  updateTributosTotaisNF,
  updateContasAPagar,

  // Funções de Verificação e Drive
  findChaveAcesso,
  getXmlFiles,
  getXmlContent
};