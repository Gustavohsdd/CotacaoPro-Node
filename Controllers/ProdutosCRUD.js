// controllers/ProdutosCRUD.js
// Migrado do seu 'ProdutosCRUD.js' original

const {
  ABA_PRODUTOS,
  CABECALHOS_PRODUTOS,
  ABA_SUBPRODUTOS,
  CABECALHOS_SUBPRODUTOS
} = require('../config/constants');

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

// Exporta as funções
module.exports = {
  getProdutosPlanilha,
  getNomesEIdsProdutosAtivos
  // (Migraremos as outras funções de CRUD de Produtos quando formos para a página "Produtos")
};