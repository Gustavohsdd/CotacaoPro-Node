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

// (As funções de criar, atualizar e excluir subprodutos serão migradas quando
// movermos para a tela de "SubProdutos", pois são mais complexas).

// Exporta as funções que o FornecedoresController/Script precisa
module.exports = {
  getSubProdutosPlanilha,
  getSubProdutosPorPai,
  getDetalhesSubProdutoPorId
  // (criar, atualizar, excluir virão depois)
};