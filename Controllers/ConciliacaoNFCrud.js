// CotacaoPro-Node/Controllers/ConciliacaoNFCrud.js
// VERSÃO CORRIGIDA - Funções refatoradas para aceitar clientes 'sheets' e 'drive'
// E ADICIONADAS AS FUNÇÕES DE LEITURA QUE FALTAVAM (MIGRADAS DO GAS)

const constants = require('../config/constants');
// [NOVO] Importa os CRUDs necessários para buscar dados de outras abas
const FornecedoresCRUD = require('./FornecedoresCRUD');

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
      console.warn(`[ConciliacaoNFCrud] Cabeçalho não encontrado: ${headerName}`);
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

/**
 * [NOVO - HELPER] Busca todos os dados de uma aba.
 * @param {object} sheets - Cliente da API Google Sheets.
 * @param {string} spreadsheetId - ID da planilha.
 * @param {string} nomeAba - Nome da aba a ser lida.
 * @returns {Promise<Array<Array<string>>>} Dados brutos da planilha (incluindo cabeçalho).
 */
async function _obterDadosPlanilha(sheets, spreadsheetId, nomeAba) {
  try {
    console.log(`[ConciliacaoNFCrud] Lendo dados da aba: ${nomeAba}`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: nomeAba,
    });
    return response.data.values || [];
  } catch (e) {
    console.error(`[ConciliacaoNFCrud] Erro ao ler a aba ${nomeAba}: ${e.message}`);
    throw new Error(`Falha ao ler dados da aba "${nomeAba}": ${e.message}`);
  }
}

// --- FUNÇÕES DE LEITURA (GET) ---

/**
 * Busca todas as Notas Fiscais da planilha.
 * @param {object} sheets - Cliente autenticado do Google Sheets.
 * @returns {Promise<Array<Object>>} - Um array de objetos de notas fiscais.
 */
async function getNotasFiscais(sheets) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: constants.ID_PLANILHA_NF,
      range: constants.ABA_NF_NOTAS_FISCAIS,
    });
    // [CORREÇÃO] Usa os cabeçalhos corretos para mapear
    return mapDataToObjects(res.data.values, constants.CABECALHOS_NF_NOTAS_FISCAIS);
  } catch (err) {
    console.error('Erro ao buscar Notas Fiscais:', err);
    throw err;
  }
}

/**
 * Busca os Itens de uma NF específica pela Chave de Acesso.
 * @param {object} sheets - Cliente autenticado do Google Sheets.
 * @param {Array<string>} [chavesAcesso] - Array de Chaves de Acesso. Se omitida, retorna TODOS os itens.
 * @returns {Promise<Array<Object>>} - Um array de objetos de itens da NF.
 */
async function getItensNF(sheets, chavesAcesso = null) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: constants.ID_PLANILHA_NF,
      range: constants.ABA_NF_ITENS,
    });
    
    const allItens = mapDataToObjects(res.data.values, constants.CABECALHOS_NF_ITENS);
    
    if (chavesAcesso && Array.isArray(chavesAcesso)) {
      const chavesSet = new Set(chavesAcesso);
      // Filtra os itens pela Chave de Acesso
      return allItens.filter(item => chavesSet.has(item["Chave de Acesso"]));
    }
    return allItens; // Retorna todos se chavesAcesso não for fornecida

  } catch (err) {
    console.error(`Erro ao buscar Itens da NF:`, err);
    throw err;
  }
}

/**
 * Busca as Faturas de uma NF específica pela Chave de Acesso.
 * @param {object} sheets - Cliente autenticado do Google Sheets.
 * @param {Array<string>} [chavesAcesso] - Array de Chaves de Acesso. Se omitida, retorna TODAS as faturas.
 * @returns {Promise<Array<Object>>} - Um array de objetos de faturas da NF.
 */
async function getFaturasNF(sheets, chavesAcesso = null) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: constants.ID_PLANILHA_NF,
      range: constants.ABA_NF_FATURAS,
    });
    
    const allFaturas = mapDataToObjects(res.data.values, constants.CABECALHOS_NF_FATURAS);
    
    if (chavesAcesso && Array.isArray(chavesAcesso)) {
      const chavesSet = new Set(chavesAcesso);
      // Filtra as faturas pela Chave de Acesso
      return allFaturas.filter(fatura => chavesSet.has(fatura["Chave de Acesso"]));
    }
    return allFaturas;

  } catch (err) {
    console.error(`Erro ao buscar Faturas da NF:`, err);
    throw err;
  }
}

/**
 * Busca os dados de Transporte de uma NF específica pela Chave de Acesso.
 * @param {object} sheets - Cliente autenticado do Google Sheets.
 * @param {Array<string>} [chavesAcesso] - Array de Chaves de Acesso. Se omitida, retorna TODOS.
 * @returns {Promise<Array<Object>>} - Um array de objetos de transporte da NF.
 */
async function getTransporteNF(sheets, chavesAcesso = null) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: constants.ID_PLANILHA_NF,
      range: constants.ABA_NF_TRANSPORTE,
    });
    
    const allTransporte = mapDataToObjects(res.data.values, constants.CABECALHOS_NF_TRANSPORTE);
    
    if (chavesAcesso && Array.isArray(chavesAcesso)) {
      const chavesSet = new Set(chavesAcesso);
      // Filtra os dados de transporte pela Chave de Acesso
      return allTransporte.filter(transp => chavesSet.has(transp["Chave de Acesso"]));
    }
    return allTransporte;

  } catch (err) {
    console.error(`Erro ao buscar Transporte da NF:`, err);
    throw err;
  }
}

/**
 * Busca os Tributos Totais de uma NF específica pela Chave de Acesso.
 * @param {object} sheets - Cliente autenticado do Google Sheets.
 * @param {Array<string>} [chavesAcesso] - Array de Chaves de Acesso. Se omitida, retorna TODOS.
 * @returns {Promise<Array<Object>>} - Um array de objetos de tributos da NF.
 */
async function getTributosTotaisNF(sheets, chavesAcesso = null) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: constants.ID_PLANILHA_NF,
      range: constants.ABA_NF_TRIBUTOS_TOTAIS,
    });
    
    const allTributos = mapDataToObjects(res.data.values, constants.CABECALHOS_NF_TRIBUTOS_TOTAIS);
    
    if (chavesAcesso && Array.isArray(chavesAcesso)) {
      const chavesSet = new Set(chavesAcesso);
      // Filtra os tributos pela Chave de Acesso
      return allTributos.filter(trib => chavesSet.has(trib["Chave de Acesso"]));
    }
    return allTributos;

  } catch (err) {
    console.error(`Erro ao buscar Tributos Totais da NF:`, err);
    throw err;
  }
}

/**
 * Busca todas as Regras de Rateio da planilha Financeiro.
 * @param {object} sheets - Cliente autenticado do Google Sheets.
 * @returns {Promise<Array<Object>>} - Um array de objetos de regras de rateio.
 */
async function getRegrasRateio(sheets) {
  try {
    const res = await sheets.spreadsheets.values.get({
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
 * @param {object} sheets - Cliente autenticado do Google Sheets.
 * @param {Array<string>} [chavesAcesso] - Array de Chaves de Acesso. Se omitida, retorna TODAS.
 * @returns {Promise<Array<Object>>} - Um array de objetos de contas a pagar.
 */
async function getContasAPagar(sheets, chavesAcesso = null) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: constants.ID_PLANILHA_FINANCEIRO,
      range: constants.ABA_FINANCEIRO_CONTAS_A_PAGAR,
    });
    
    const allContas = mapDataToObjects(res.data.values, constants.CABECALHOS_FINANCEIRO_CONTAS_A_PAGAR);
    
    if (chavesAcesso && Array.isArray(chavesAcesso)) {
       const chavesSet = new Set(chavesAcesso);
      // Filtra as contas pela Chave de Acesso
      return allContas.filter(conta => chavesSet.has(conta["Chave de Acesso"]));
    }
    return allContas;
  } catch (err) {
    console.error(`Erro ao buscar Contas a Pagar da NF:`, err);
    throw err;
  }
}


// --- FUNÇÕES DE ESCRITA (UPDATE/INSERT) ---
// (As funções de escrita: updateNotasFiscais, updateItensNF, etc. permanecem as mesmas)
// ... (seu código de updateNotasFiscais, updateItensNF, etc. ...
/**
 * Adiciona uma nova linha de Nota Fiscal na planilha.
 * @param {object} sheets - Cliente autenticado do Google Sheets.
 * @param {Object} dataObject - O objeto contendo os dados da NF.
 * @returns {Promise<Object>} - O resultado da operação de append.
 */
async function updateNotasFiscais(sheets, dataObject) {
  try {
    const row = mapObjectToRow(dataObject, constants.CABECALHOS_NF_NOTAS_FISCAIS);
    const res = await sheets.spreadsheets.values.append({
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
 * @param {object} sheets - Cliente autenticado do Google Sheets.
 * @param {Array<Object>} dataObjects - Um array de objetos, um para cada item.
 * @returns {Promise<Object>} - O resultado da operação de append.
 */
async function updateItensNF(sheets, dataObjects) {
  try {
    const rows = dataObjects.map(obj => mapObjectToRow(obj, constants.CABECALHOS_NF_ITENS));
    if (rows.length === 0) return;

    const res = await sheets.spreadsheets.values.append({
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
 * @param {object} sheets - Cliente autenticado do Google Sheets.
 * @param {Array<Object>} dataObjects - Um array de objetos, um para cada fatura.
 * @returns {Promise<Object>} - O resultado da operação de append.
 */
async function updateFaturasNF(sheets, dataObjects) {
  try {
    const rows = dataObjects.map(obj => mapObjectToRow(obj, constants.CABECALHOS_NF_FATURAS));
    if (rows.length === 0) return;

    const res = await sheets.spreadsheets.values.append({
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
 * @param {object} sheets - Cliente autenticado do Google Sheets.
 * @param {Object} dataObject - O objeto contendo os dados de transporte.
 * @returns {Promise<Object>} - O resultado da operação de append.
 */
async function updateTransporteNF(sheets, dataObject) {
  try {
    const row = mapObjectToRow(dataObject, constants.CABECALHOS_NF_TRANSPORTE);
    const res = await sheets.spreadsheets.values.append({
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
 * @param {object} sheets - Cliente autenticado do Google Sheets.
 * @param {Object} dataObject - O objeto contendo os tributos totais.
 * @returns {Promise<Object>} - O resultado da operação de append.
 */
async function updateTributosTotaisNF(sheets, dataObject) {
  try {
    const row = mapObjectToRow(dataObject, constants.CABECALHOS_NF_TRIBUTOS_TOTAIS);
    const res = await sheets.spreadsheets.values.append({
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
 * @param {object} sheets - Cliente autenticado do Google Sheets.
 * @param {Array<Object>} dataObjects - Um array de objetos, um para cada conta.
 * @returns {Promise<Object>} - O resultado da operação de append.
 */
async function updateContasAPagar(sheets, dataObjects) {
  try {
    const rows = dataObjects.map(obj => mapObjectToRow(obj, constants.CABECALHOS_FINANCEIRO_CONTAS_A_PAGAR));
    if (rows.length === 0) return;
    
    const res = await sheets.spreadsheets.values.append({
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
// (As funções findChaveAcesso, getXmlFiles, getXmlContent permanecem as mesmas)
// ... (seu código de findChaveAcesso, getXmlFiles, etc. ...
/**
 * Verifica se uma Chave de Acesso já existe na planilha de Notas Fiscais.
 * @param {object} sheets - Cliente autenticado do Google Sheets.
 * @param {string} chaveAcesso - A Chave de Acesso a ser verificada.
 * @returns {Promise<boolean>} - True se a chave existe, False caso contrário.
 */
async function findChaveAcesso(sheets, chaveAcesso) {
  try {
    const res = await sheets.spreadsheets.values.get({
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
 * @param {object} drive - Cliente autenticado do Google Drive.
 * @returns {Promise<Array<Object>>} - Um array de objetos de arquivos (id, name).
 */
async function getXmlFiles(drive) {
  try {
    const res = await drive.files.list({
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
 * @param {object} drive - Cliente autenticado do Google Drive.
 * @param {string} fileId - O ID do arquivo no Drive.
 * @returns {Promise<string>} - O conteúdo do arquivo XML como string.
 */
async function getXmlContent(drive, fileId) {
  try {
    const res = await drive.files.get(
      { fileId: fileId, alt: 'media' },
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

// ====================================================================
// --- [NOVAS FUNÇÕES MIGRADAS DO ConciliacaoNFCrud.js (GAS)] ---
// ====================================================================

/**
 * [NOVO - MIGRADO] Busca cotações abertas (Aguardando Faturamento ou Recebido Parcialmente).
 * @param {object} sheets - Cliente autenticado do Google Sheets.
 */
async function obterCotacoesAbertas(sheets) {
  try {
    // 1. Obter dados das Cotações e Fornecedores em paralelo
    const [dadosCotacoes, dadosFornecedores] = await Promise.all([
      _obterDadosPlanilha(sheets, constants.ID_PLANILHA_PRINCIPAL, constants.ABA_COTACOES),
      _obterDadosPlanilha(sheets, constants.ID_PLANILHA_PRINCIPAL, constants.ABA_FORNECEDORES)
    ]);

    if (dadosCotacoes.length <= 1) return [];

    // 2. Mapear CNPJ dos fornecedores
    const cabecalhosForn = dadosFornecedores[0];
    const colFornNome = cabecalhosForn.indexOf("Fornecedor");
    const colFornCnpj = cabecalhosForn.indexOf("CNPJ");
    const mapaFornecedores = dadosFornecedores.slice(1).reduce((map, row) => {
      const nome = row[colFornNome];
      const cnpj = row[colFornCnpj];
      if (nome) map[nome.toString().trim()] = cnpj ? cnpj.toString().trim() : '';
      return map;
    }, {});

    // 3. Processar cotações
    const cabecalhos = dadosCotacoes[0];
    const colId = cabecalhos.indexOf("ID da Cotação");
    const colData = cabecalhos.indexOf("Data Abertura");
    const colForn = cabecalhos.indexOf("Fornecedor");
    const colStatus = cabecalhos.indexOf("Status da Cotação");

    const cotacoesUnicas = {};
    dadosCotacoes.slice(1).forEach(linha => {
      const status = linha[colStatus];
      const id = linha[colId];
      const fornecedor = linha[colForn];

      if (id && fornecedor && (status === 'Aguardando Faturamento' || status === 'Recebido Parcialmente')) {
        const compositeKey = `${id}-${fornecedor}`;
        if (!cotacoesUnicas[compositeKey]) {
          const nomeFornecedorTrim = fornecedor.toString().trim();
          cotacoesUnicas[compositeKey] = {
            compositeKey: compositeKey,
            idCotacao: id,
            fornecedor: fornecedor,
            fornecedorCnpj: mapaFornecedores[nomeFornecedorTrim] || '',
            dataAbertura: linha[colData] ? new Date(linha[colData]).toLocaleDateString('pt-BR') : 'N/A' // Simples formatação
          };
        }
      }
    });

    const resultado = Object.values(cotacoesUnicas);
    resultado.sort((a, b) => {
      if (b.idCotacao !== a.idCotacao) return b.idCotacao - a.idCotacao;
      return a.fornecedor.localeCompare(b.fornecedor);
    });
    
    return resultado;
  } catch (e) {
    console.error(`Erro em obterCotacoesAbertas: ${e.message}\n${e.stack}`);
    throw e;
  }
}

/**
 * [NOVO - MIGRADO] Busca o mapeamento de conciliação.
 * @param {object} sheets - Cliente autenticado do Google Sheets.
 */
async function obterMapeamentoConciliacao(sheets) {
  try {
    const dados = await _obterDadosPlanilha(sheets, constants.ID_PLANILHA_PRINCIPAL, constants.ABA_CONCILIACAO);
    if (dados.length <= 1) return [];

    const cabecalhos = dados[0];
    const colItemCotacao = cabecalhos.indexOf("Item da Cotação");
    const colDescricaoNF = cabecalhos.indexOf("Descrição Produto (NF)");

    if (colItemCotacao === -1 || colDescricaoNF === -1) {
      console.warn(`Colunas "Item da Cotação" ou "Descrição Produto (NF)" não encontradas na aba "${constants.ABA_CONCILIACAO}".`);
      return [];
    }

    const mapeamento = dados.slice(1).map(linha => ({
      itemCotacao: linha[colItemCotacao],
      descricaoNF: linha[colDescricaoNF]
    })).filter(item => item.itemCotacao && item.descricaoNF);
    
    return mapeamento;
  } catch (e) {
    console.error(`Erro em obterMapeamentoConciliacao: ${e.message}`);
    return []; // Retorna vazio em caso de erro
  }
}

/**
 * [NOVO - MIGRADO] Busca todos os itens de cotações abertas.
 * @param {object} sheets - Cliente autenticado do Google Sheets.
 * @param {Array<object>} chavesCotacoes - Array de { idCotacao, fornecedor }.
 */
async function obterTodosItensCotacoesAbertas(sheets, chavesCotacoes) {
  try {
    const dados = await _obterDadosPlanilha(sheets, constants.ID_PLANILHA_PRINCIPAL, constants.ABA_COTACOES);
    const cabecalhos = dados.shift();
    const colMap = {};
    const colunasNecessarias = ["ID da Cotação", "Fornecedor", "SubProduto", "Comprar", "Preço", "Fator", "Preço por Fator"];
    colunasNecessarias.forEach(nome => { colMap[nome] = cabecalhos.indexOf(nome); });

    const setCotacoes = new Set(chavesCotacoes.map(c => `${c.idCotacao}-${c.fornecedor}`));
    const itens = [];

    for (const linha of dados) {
      const id = linha[colMap["ID da Cotação"]];
      const fornecedor = linha[colMap["Fornecedor"]];
      const compositeKey = `${id}-${fornecedor}`;

      if (setCotacoes.has(compositeKey)) {
        const qtdComprar = parseFloat(String(linha[colMap["Comprar"]]).replace(',', '.'));
        if (!isNaN(qtdComprar) && qtdComprar > 0) {
          itens.push({
            idCotacao: id,
            fornecedor: fornecedor,
            subProduto: linha[colMap["SubProduto"]],
            qtdComprar: qtdComprar,
            preco: parseFloat(String(linha[colMap["Preço"]]).replace(',', '.')) || 0,
            fator: parseFloat(String(linha[colMap["Fator"]]).replace(',', '.')) || 1,
            precoPorFator: parseFloat(String(linha[colMap["Preço por Fator"]]).replace(',', '.')) || 0
          });
        }
      }
    }
    return itens;
  } catch (e) {
    console.error(`Erro em obterTodosItensCotacoesAbertas: ${e.message}\n${e.stack}`);
    throw e;
  }
}

/**
 * [NOVO - MIGRADO] Combina Tributos e Faturas
 * @param {object} sheets - Cliente autenticado do Google Sheets.
 * @param {Array<string>} chavesAcessoNF - Array de Chaves de Acesso.
 */
async function obterDadosGeraisDasNFs(sheets, chavesAcessoNF) {
  try {
    // 1. Busca os totais dos tributos
    const [dadosTrib, dadosFat] = await Promise.all([
      getTributosTotaisNF(sheets, chavesAcessoNF),
      getFaturasNF(sheets, chavesAcessoNF)
    ]);

    const resultadosMap = {};

    // Mapeia os tributos
    for (const tributo of dadosTrib) {
      const chaveAtual = tributo["Chave de Acesso"];
      resultadosMap[chaveAtual] = {
        chaveAcesso: chaveAtual,
        totalBaseCalculoIcms: parseFloat(tributo["Total Base Cálculo ICMS"]) || 0,
        totalValorIcms: parseFloat(tributo["Total Valor ICMS"]) || 0,
        totalValorIcmsSt: parseFloat(tributo["Total Valor ICMS ST"]) || 0,
        totalValorProdutos: parseFloat(tributo["Total Valor Produtos"]) || 0,
        totalValorFrete: parseFloat(tributo["Total Valor Frete"]) || 0,
        totalValorSeguro: parseFloat(tributo["Total Valor Seguro"]) || 0,
        totalValorDesconto: parseFloat(tributo["Total Valor Desconto"]) || 0,
        totalValorIpi: parseFloat(tributo["Total Valor IPI"]) || 0,
        totalValorPis: parseFloat(tributo["Total Valor PIS"]) || 0,
        totalValorCofins: parseFloat(tributo["Total Valor COFINS"]) || 0,
        totalOutrasDespesas: parseFloat(tributo["Total Outras Despesas"]) || 0,
        valorTotalNf: parseFloat(tributo["Valor Total da NF"]) || 0,
        faturas: [] // Inicializa
      };
    }

    // Agrupa as faturas
    for (const fatura of dadosFat) {
      const chaveAtual = fatura["Chave de Acesso"];
      if (resultadosMap[chaveAtual]) {
        resultadosMap[chaveAtual].faturas.push({
          numeroFatura: fatura["Número da Fatura"],
          numeroParcela: fatura["Número da Parcela"],
          dataVencimento: fatura["Data de Vencimento"], // Já deve ser string
          valorParcela: parseFloat(fatura["Valor da Parcela"]) || 0
        });
      }
    }
    
    return Object.values(resultadosMap);
  } catch (e) {
    console.error(`Erro em obterDadosGeraisDasNFs: ${e.message}\n${e.stack}`);
    throw e;
  }
}

/**
 * [NOVO - MIGRADO] Busca setores únicos das regras de rateio.
 * @param {object} sheets - Cliente autenticado do Google Sheets.
 */
async function obterSetoresUnicos(sheets) {
  try {
    const regras = await getRegrasRateio(sheets);
    const setores = new Set(regras.map(r => r["Setor"]));
    return Array.from(setores).filter(Boolean); // Remove nulos/vazios
  } catch (e) {
    console.error(`Erro em obterSetoresUnicos: ${e.message}\n${e.stack}`);
    throw e;
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
  
  // [NOVAS FUNÇÕES EXPORTADAS]
  obterCotacoesAbertas,
  obterMapeamentoConciliacao,
  obterTodosItensCotacoesAbertas,
  obterDadosGeraisDasNFs,
  obterSetoresUnicos,

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
  getXmlContent,

  // Helpers (exportados para o Controller usar se precisar)
  mapDataToObjects,
  mapObjectToRow,
  findHeaderIndices
};