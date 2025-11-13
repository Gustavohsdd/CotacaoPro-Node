// controllers/SubProdutosCRUD.js
// Migrado e expandido a partir de 'SubProdutosCRUD.js', 'ProdutosCRUD.js', e 'FornecedoresCRUD.js' do Apps Script.

const {
  ABA_PRODUTOS,
  CABECALHOS_PRODUTOS,
  ABA_SUBPRODUTOS,
  CABECALHOS_SUBPRODUTOS,
  ABA_FORNECEDORES,
  CABECALHOS_FORNECEDORES
} = require('../config/constants');

// Importa os CRUDs de outros módulos para buscar dados (necessário para dropdowns)
const ProdutosCRUD = require('./ProdutosCRUD');
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
    let cellValue = rowArray[index];
    // Tratamento explícito de datas
    if (cellValue instanceof Date) {
      if (cellValue.getHours() > 0 || cellValue.getMinutes() > 0 || cellValue.getSeconds() > 0) {
        obj[header] = Utilities.formatDate(cellValue, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
      } else {
        obj[header] = Utilities.formatDate(cellValue, Session.getScriptTimeZone(), "dd/MM/yyyy");
      }
    } else {
      obj[header] = cellValue;
    }
  });
  // Garante que o frontend receba os IDs que espera
  obj['ID_SubProduto'] = rowArray[headers.indexOf("ID")];
  obj['SubProduto'] = rowArray[headers.indexOf("SubProduto")];
  return obj;
}

/**
 * Obtém o nome de um produto pelo seu ID. (Função auxiliar interna)
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {string} produtoId O ID do produto.
 * @return {Promise<string|null>} O nome do produto ou null se não encontrado.
 */
async function getProdutoNomePorId(sheets, spreadsheetId, produtoId) {
  if (!produtoId) return null;
  const dados = await ProdutosCRUD.getProdutosPlanilha(sheets, spreadsheetId);
  const headers = dados[0].map(String);
  const idxId = headers.indexOf("ID");
  const idxNome = headers.indexOf("Produto");
  if (idxId === -1 || idxNome === -1) return null;

  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][idxId]) === String(produtoId)) {
      return String(dados[i][idxNome]);
    }
  }
  return null;
}

/**
 * Obtém o nome de um fornecedor pelo seu ID. (Função auxiliar interna)
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {string} fornecedorId O ID do fornecedor.
 * @return {Promise<string|null>} O nome do fornecedor ou null se não encontrado.
 */
async function getFornecedorNomePorId(sheets, spreadsheetId, fornecedorId) {
  if (!fornecedorId) return null;
  const dados = await FornecedoresCRUD.getFornecedoresPlanilha(sheets, spreadsheetId);
  const headers = dados[0].map(String);
  const idxId = headers.indexOf("ID");
  const idxNome = headers.indexOf("Fornecedor");
  if (idxId === -1 || idxNome === -1) return null;

  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][idxId]) === String(fornecedorId)) {
      return String(dados[i][idxNome]);
    }
  }
  return null;
}


// --- Funções CRUD Exportadas ---

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
      // Comparação case-insensitive para robustez
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
 * (Migrado de SubProdutosCRUD_criarNovoSubProduto e SubProdutosCRUD_criarNovoSubProduto_NOVO)
 * Cria um novo subproduto. Esta versão recebe IDs e os converte em Nomes.
 * Usado por FornecedoresScript e SubProdutosScript.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {object} dadosItem - Objeto com os dados do formulário.
 * @returns {Promise<object>}
 */
async function criarNovoSubProduto(sheets, spreadsheetId, dadosItem) {
  try {
    const nomeCampoSubProduto = "SubProduto";
    const nomeCampoProdutoVinculadoForm = "Produto Vinculado"; // ID do Produto
    const nomeCampoFornecedorForm = "Fornecedor"; // ID ou Nome do Fornecedor
    const nomeCampoUN = "UN";

    if (!dadosItem || !dadosItem[nomeCampoSubProduto]) {
      throw new Error(`O campo '${nomeCampoSubProduto}' é obrigatório.`);
    }
    const idProdutoVinculadoRecebido = dadosItem[nomeCampoProdutoVinculadoForm];
    if (!idProdutoVinculadoRecebido) {
      throw new Error(`O campo '${nomeCampoProdutoVinculadoForm}' (ID do Produto) é obrigatório.`);
    }
    if (!dadosItem[nomeCampoUN]) {
      throw new Error(`O campo '${nomeCampoUN}' é obrigatório.`);
    }

    // Obter NOME do Produto Vinculado a partir do ID
    const nomeProdutoVinculadoParaSalvar = await getProdutoNomePorId(sheets, spreadsheetId, idProdutoVinculadoRecebido);
    if (!nomeProdutoVinculadoParaSalvar) {
      throw new Error(`Produto Vinculado com ID '${idProdutoVinculadoRecebido}' não encontrado.`);
    }

    // Obter NOME do Fornecedor a partir do ID (se houver)
    let nomeFornecedorParaSalvar = "";
    const idFornecedorRecebido = dadosItem[nomeCampoFornecedorForm];
    if (idFornecedorRecebido) {
        // Tenta buscar por ID
        nomeFornecedorParaSalvar = await getFornecedorNomePorId(sheets, spreadsheetId, idFornecedorRecebido);
        if (!nomeFornecedorParaSalvar) {
            // Se falhar, assume que o valor recebido já era o nome (fallback para FornecedoresScript)
            nomeFornecedorParaSalvar = idFornecedorRecebido; 
            console.warn(`ID de fornecedor '${idFornecedorRecebido}' não encontrado. Salvando o valor como nome.`);
        }
    }

    const dados = await getSubProdutosPlanilha(sheets, spreadsheetId);
    const headers = dados[0].map(String);
    const dataRows = dados.slice(1);
    
    const idxId = headers.indexOf("ID");
    const idxNome = headers.indexOf("SubProduto");
    const idxProdVinc = headers.indexOf("Produto Vinculado");

    const nomeNovoSubProdutoNormalizado = normalizarTextoComparacao(dadosItem[nomeCampoSubProduto]);
    const nomeProdutoVinculadoNormalizado = normalizarTextoComparacao(nomeProdutoVinculadoParaSalvar);

    for (const row of dataRows) {
      if (normalizarTextoComparacao(row[idxNome]) === nomeNovoSubProdutoNormalizado &&
          normalizarTextoComparacao(row[idxProdVinc]) === nomeProdutoVinculadoNormalizado) {
        throw new Error(`O subproduto '${dadosItem[nomeCampoSubProduto]}' já está cadastrado para o produto '${nomeProdutoVinculadoParaSalvar}'.`);
      }
    }
    
    const novoIdGerado = gerarProximoId(dados, idxId);
    
    const novaLinhaArray = headers.map(header => {
        switch (header) {
            case "ID": return novoIdGerado;
            case "Data de Cadastro": return new Date().toISOString();
            case "Produto Vinculado": return nomeProdutoVinculadoParaSalvar;
            case "Fornecedor": return nomeFornecedorParaSalvar; // Pode ser o ID/Nome de FornecedoresScript ou o Nome de SubProdutosScript
            default: return dadosItem[header] || "";
        }
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: ABA_SUBPRODUTOS,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [novaLinhaArray] },
    });
    
    return { success: true, message: "Subproduto criado com sucesso!", novoId: novoIdGerado };
  } catch (e) {
    console.error("ERRO em criarNovoSubProduto: " + e.toString());
    throw e;
  }
}

/**
 * (Migrado de SubProdutosCRUD_atualizarSubProduto)
 * Atualiza um subproduto existente. Esta versão recebe IDs e os converte em Nomes.
 * Usado por FornecedoresScript e SubProdutosScript.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {object} dadosItem - Objeto com os dados do formulário (inclui "ID" ou "ID_SubProduto_Edicao").
 * @returns {Promise<object>}
 */
async function atualizarSubProduto(sheets, spreadsheetId, dadosItem) {
  try {
    const idParaAtualizar = dadosItem["ID"] || dadosItem["ID_SubProduto_Edicao"];
    if (!idParaAtualizar) throw new Error("ID do subproduto é obrigatório para atualização.");

    const nomeDoCampoSubProduto = "SubProduto";
    const nomeSubProdutoAtualizado = dadosItem[nomeDoCampoSubProduto];
    if (!nomeSubProdutoAtualizado) throw new Error(`O campo '${nomeDoCampoSubProduto}' é obrigatório.`);
    
    const nomeDoCampoProdutoVinculadoForm = "Produto Vinculado";
    const idProdutoVinculadoRecebido = dadosItem[nomeDoCampoProdutoVinculadoForm];
    if (!idProdutoVinculadoRecebido) {
      throw new Error(`O campo '${nomeDoCampoProdutoVinculadoForm}' (ID do Produto) é obrigatório.`);
    }

    // Obter NOME do Produto Vinculado
    const nomeProdutoVinculadoParaSalvar = await getProdutoNomePorId(sheets, spreadsheetId, idProdutoVinculadoRecebido);
    if (!nomeProdutoVinculadoParaSalvar) {
      throw new Error(`Produto Vinculado com ID '${idProdutoVinculadoRecebido}' não encontrado.`);
    }

    // Obter NOME do Fornecedor
    let nomeFornecedorParaSalvar = "";
    const idFornecedorRecebido = dadosItem["Fornecedor"];
    if (idFornecedorRecebido) {
        nomeFornecedorParaSalvar = await getFornecedorNomePorId(sheets, spreadsheetId, idFornecedorRecebido);
        if (!nomeFornecedorParaSalvar) {
            nomeFornecedorParaSalvar = idFornecedorRecebido; // Fallback
            console.warn(`ID de fornecedor '${idFornecedorRecebido}' não encontrado. Salvando o valor como nome.`);
        }
    }

    const dados = await getSubProdutosPlanilha(sheets, spreadsheetId);
    const headers = dados[0].map(String);
    const dataRows = dados.slice(1);

    const idxId = headers.indexOf("ID");
    const idxNome = headers.indexOf("SubProduto");
    const idxProdVinc = headers.indexOf("Produto Vinculado");

    let linhaIndex = -1; // 0-based
    const nomeSubProdutoAtualizadoNormalizado = normalizarTextoComparacao(nomeSubProdutoAtualizado);
    const nomeProdutoVinculadoNormalizado = normalizarTextoComparacao(nomeProdutoVinculadoParaSalvar);

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (String(row[idxId]) === String(idParaAtualizar)) {
        linhaIndex = i;
      } else {
        if (normalizarTextoComparacao(row[idxNome]) === nomeSubProdutoAtualizadoNormalizado &&
            normalizarTextoComparacao(row[idxProdVinc]) === nomeProdutoVinculadoNormalizado) {
          throw new Error(`O subproduto '${nomeSubProdutoAtualizado}' já está cadastrado para o produto '${nomeProdutoVinculadoParaSalvar}' (em outro ID).`);
        }
      }
    }

    if (linhaIndex === -1) {
      throw new Error(`Subproduto com ID '${idParaAtualizar}' não encontrado para atualização.`);
    }

    const linhaOriginal = dataRows[linhaIndex];
    const linhaAtualizadaArray = headers.map((header, k_idx) => {
        if (header === "ID" || header === "Data de Cadastro") {
            return linhaOriginal[k_idx];
        }
        if (header === "Produto Vinculado") {
            return nomeProdutoVinculadoParaSalvar;
        }
        if (header === "Fornecedor") {
            return nomeFornecedorParaSalvar;
        }
        return dadosItem[header] !== undefined ? dadosItem[header] : linhaOriginal[k_idx];
    });

    const linhaPlanilha = linhaIndex + 2; // 1-based + 1 header
    const ultimaColunaLetra = String.fromCharCode(65 + (headers.length - 1) % 26);
    const prefixoColuna = headers.length > 26 ? String.fromCharCode(64 + Math.floor((headers.length - 1) / 26)) : '';
    const range = `${ABA_SUBPRODUTOS}!A${linhaPlanilha}:${prefixoColuna}${ultimaColunaLetra}${linhaPlanilha}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: range,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [linhaAtualizadaArray] },
    });

    return { success: true, message: "Subproduto atualizado com sucesso!" };
  } catch (e) {
    console.error("ERRO em atualizarSubProduto: " + e.toString());
    throw e;
  }
}

/**
 * (Migrado de SubProdutosCRUD_excluirSubProduto)
 * Exclui um subproduto da planilha.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {string} subProdutoId O ID do subproduto a ser excluído.
 * @return {Promise<object>}
 */
async function excluirSubProduto(sheets, spreadsheetId, subProdutoId) {
  try {
    if (!subProdutoId) throw new Error("ID do subproduto é obrigatório para exclusão.");

    const dados = await getSubProdutosPlanilha(sheets, spreadsheetId);
    const headers = dados[0].map(String);
    const idxId = headers.indexOf("ID");
    if (idxId === -1) {
      throw new Error("Coluna 'ID' não encontrada na aba SubProdutos.");
    }

    let linhaIndex = -1; // 0-based
    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][idxId]) === String(subProdutoId)) {
        linhaIndex = i;
        break;
      }
    }

    if (linhaIndex === -1) {
      return { success: false, message: `Subproduto com ID '${subProdutoId}' não encontrado.` };
    }

    const sheetId = await getSheetIdByName(sheets, spreadsheetId, ABA_SUBPRODUTOS);
    const requests = [{
      deleteDimension: {
        range: {
          sheetId: sheetId,
          dimension: "ROWS",
          startIndex: linhaIndex, // 0-based
          endIndex: linhaIndex + 1
        }
      }
    }];

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      resource: { requests: requests }
    });

    return { success: true, message: "Subproduto excluído com sucesso!" };
  } catch (e) {
    console.error("ERRO em excluirSubProduto: " + e.toString());
    throw e;
  }
}

/**
 * (Migrado de SubProdutosCRUD_cadastrarMultiplosSubProdutos)
 * Cadastra múltiplos subprodutos de uma vez.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {object} dadosLote - { fornecedorGlobal: string (ID), subProdutos: Array<Object> }
 * @returns {Promise<object>}
 */
async function cadastrarMultiplosSubProdutos(sheets, spreadsheetId, dadosLote) {
    try {
        if (!dadosLote || !dadosLote.subProdutos || dadosLote.subProdutos.length === 0) {
            throw new Error("Dados insuficientes para cadastro em lote.");
        }

        const dados = await getSubProdutosPlanilha(sheets, spreadsheetId);
        const headers = dados[0].map(String);
        const dataRows = dados.slice(1);

        const idxId = headers.indexOf("ID");
        const idxNome = headers.indexOf("SubProduto");
        const idxProdVinc = headers.indexOf("Produto Vinculado");
        
        // Obter NOME do Fornecedor Global (opcional)
        let nomeFornecedorGlobalParaSalvar = "";
        if (dadosLote.fornecedorGlobal) {
            nomeFornecedorGlobalParaSalvar = await getFornecedorNomePorId(sheets, spreadsheetId, dadosLote.fornecedorGlobal);
            if (!nomeFornecedorGlobalParaSalvar) {
                console.warn(`Fornecedor Global com ID '${dadosLote.fornecedorGlobal}' não encontrado. Subprodutos serão cadastrados sem este fornecedor.`);
                nomeFornecedorGlobalParaSalvar = "";
            }
        }

        let proximoId = gerarProximoId(dados, idxId);
        const resultadosDetalhados = [];
        let subProdutosAdicionadosComSucesso = 0;
        const novasLinhasParaAdicionar = [];
        
        const mapaDuplicidadePlanilha = new Set(dataRows.map(row => 
            `${normalizarTextoComparacao(row[idxNome])}#${normalizarTextoComparacao(row[idxProdVinc])}`
        ));
        const mapaDuplicidadeLote = new Set();

        for (const subProdutoIndividual of dadosLote.subProdutos) {
            const nomeSubProdutoAtual = subProdutoIndividual["SubProduto"];
            const idProdutoVinculadoIndividual = subProdutoIndividual["ProdutoVinculadoID"]; // ID do form

            if (!nomeSubProdutoAtual || !idProdutoVinculadoIndividual || !subProdutoIndividual["UN"]) {
                resultadosDetalhados.push({ nome: nomeSubProdutoAtual || "Nome não fornecido", status: "Falha", erro: "Campos obrigatórios (SubProduto, Produto Vinculado, UN) não preenchidos." });
                continue;
            }

            const nomeProdutoVinculadoIndividualParaSalvar = await getProdutoNomePorId(sheets, spreadsheetId, idProdutoVinculadoIndividual);
            if (!nomeProdutoVinculadoIndividualParaSalvar) {
                resultadosDetalhados.push({ nome: nomeSubProdutoAtual, status: "Falha", erro: `Produto Vinculado com ID '${idProdutoVinculadoIndividual}' não encontrado.` });
                continue;
            }
            
            const nomeSubProdutoNormalizado = normalizarTextoComparacao(nomeSubProdutoAtual);
            const nomeProdutoVinculadoIndividualNormalizado = normalizarTextoComparacao(nomeProdutoVinculadoIndividualParaSalvar);
            const chaveUnica = `${nomeSubProdutoNormalizado}#${nomeProdutoVinculadoIndividualNormalizado}`;

            if (mapaDuplicidadePlanilha.has(chaveUnica) || mapaDuplicidadeLote.has(chaveUnica)) {
                resultadosDetalhados.push({ nome: nomeSubProdutoAtual, status: "Falha", erro: `Duplicado (já existe ou está no lote).` });
                continue;
            }
            
            mapaDuplicidadeLote.add(chaveUnica);
            const idAtualGerado = String(proximoId++);
            
            const novaLinhaArray = headers.map(header => {
                switch (header) {
                    case "ID": return idAtualGerado;
                    case "Data de Cadastro": return new Date().toISOString();
                    case "Produto Vinculado": return nomeProdutoVinculadoIndividualParaSalvar;
                    case "Fornecedor": return nomeFornecedorGlobalParaSalvar;
                    default: return subProdutoIndividual[header] || "";
                }
            });
            
            novasLinhasParaAdicionar.push(novaLinhaArray);
            resultadosDetalhados.push({ nome: nomeSubProdutoAtual, status: "Sucesso", id: idAtualGerado });
            subProdutosAdicionadosComSucesso++;
        }

        if (novasLinhasParaAdicionar.length > 0) {
            await sheets.spreadsheets.values.append({
                spreadsheetId: spreadsheetId,
                range: `${ABA_SUBPRODUTOS}!A${dados.length + 1}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: novasLinhasParaAdicionar },
            });
        }
        
        let mensagemFinal = `${subProdutosAdicionadosComSucesso} de ${dadosLote.subProdutos.length} subprodutos foram processados.`;
        // ... (lógica de mensagem final)

        return { success: true, message: mensagemFinal, detalhes: resultadosDetalhados };
    } catch (e) {
        console.error("ERRO em cadastrarMultiplosSubProdutos: " + e.toString());
        throw e;
    }
}

/**
 * (Migrado de SubProdutosCRUD_obterTodosProdutosParaDropdown)
 * Obtém a lista de produtos para dropdowns.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @returns {Promise<Array<object>>}
 */
async function getTodosProdutosParaDropdown(sheets, spreadsheetId) {
  try {
    // Reutiliza a função já migrada para ProdutosCRUD
    return await ProdutosCRUD.getNomesEIdsProdutosAtivos(sheets, spreadsheetId);
  } catch (e) {
    console.error("Erro em getTodosProdutosParaDropdown: " + e.toString());
    throw e;
  }
}

/**
 * (Migrado de SubProdutosCRUD_obterTodosFornecedoresParaDropdown)
 * Obtém a lista de fornecedores para dropdowns.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @returns {Promise<Array<object>>}
 */
async function getTodosFornecedoresParaDropdown(sheets, spreadsheetId) {
  try {
    // Reutiliza a função de FornecedoresCRUD
    const dados = await FornecedoresCRUD.getFornecedoresPlanilha(sheets, spreadsheetId);
    return FornecedoresCRUD.getOutrosFornecedores(dados, null); // Passa null para pegar todos
  } catch (e) {
    console.error("Erro em getTodosFornecedoresParaDropdown: " + e.toString());
    throw e;
  }
}

/**
 * (Migrado de ProdutosCRUD_adicionarNovoSubProdutoVinculado)
 * Adiciona um novo subproduto, recebendo o *nome* do produto vinculado.
 * Usado por ProdutosScript.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {object} dadosItem - Objeto com os dados do formulário.
 * @returns {Promise<object>}
 */
async function adicionarNovoSubProdutoVinculado(sheets, spreadsheetId, dadosItem) {
    try {
        const nomeSubProduto = dadosItem["SubProduto"];
        const nomeProdutoVinculado = dadosItem["Produto Vinculado"]; // Recebe o NOME
        if (!nomeSubProduto) throw new Error("O nome do SubProduto é obrigatório.");
        if (!nomeProdutoVinculado) throw new Error("O nome do Produto Vinculado é obrigatório.");

        const dados = await getSubProdutosPlanilha(sheets, spreadsheetId);
        const headers = dados[0].map(String);
        const idxId = headers.indexOf("ID");

        const novoIdGerado = gerarProximoId(dados, idxId);
        
        const novaLinhaArray = headers.map(header => {
            switch(header) {
                case "ID": return novoIdGerado;
                case "Data de Cadastro": return new Date().toISOString();
                // Todos os outros campos (incluindo "Produto Vinculado" e "Fornecedor")
                // virão diretamente do objeto 'dadosItem'
                default: return dadosItem[header] || "";
            }
        });
        
        await sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId,
            range: ABA_SUBPRODUTOS,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [novaLinhaArray] },
        });

        return { success: true, message: "Subproduto vinculado adicionado!", novoId: novoIdGerado };
    } catch (e) {
        console.error("ERRO em adicionarNovoSubProdutoVinculado: " + e.toString());
        throw e;
    }
}

/**
 * (Migrado de ProdutosCRUD_atualizarSubProdutoVinculado)
 * Atualiza um subproduto, recebendo o *nome* do produto vinculado.
 * Usado por ProdutosScript.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {object} dadosItem - Objeto com os dados do formulário (inclui "ID_SubProduto_Edicao").
 * @returns {Promise<object>}
 */
async function atualizarSubProdutoVinculado(sheets, spreadsheetId, dadosItem) {
    try {
        const idParaAtualizar = dadosItem["ID_SubProduto_Edicao"];
        if (!idParaAtualizar) throw new Error("ID do Subproduto é obrigatório para atualização.");

        const dados = await getSubProdutosPlanilha(sheets, spreadsheetId);
        const headers = dados[0].map(String);
        const dataRows = dados.slice(1);
        const idxId = headers.indexOf("ID");

        let linhaIndex = -1; // 0-based
        for (let i = 0; i < dataRows.length; i++) {
            if (String(dataRows[i][idxId]) === String(idParaAtualizar)) {
                linhaIndex = i;
                break;
            }
        }

        if (linhaIndex === -1) {
            throw new Error(`Subproduto com ID '${idParaAtualizar}' não encontrado.`);
        }
        
        const linhaOriginal = dataRows[linhaIndex];
        const linhaAtualizadaArray = headers.map((header, k_idx) => {
            if (header === "ID" || header === "Data de Cadastro") {
                return linhaOriginal[k_idx];
            }
            // "Produto Vinculado" e "Fornecedor" virão como nomes do form
            return dadosItem[header] !== undefined ? dadosItem[header] : linhaOriginal[k_idx];
        });

        const linhaPlanilha = linhaIndex + 2; // 1-based + 1 header
        const ultimaColunaLetra = String.fromCharCode(65 + (headers.length - 1) % 26);
        const prefixoColuna = headers.length > 26 ? String.fromCharCode(64 + Math.floor((headers.length - 1) / 26)) : '';
        const range = `${ABA_SUBPRODUTOS}!A${linhaPlanilha}:${prefixoColuna}${ultimaColunaLetra}${linhaPlanilha}`;

        await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: range,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [linhaAtualizadaArray] },
        });

        return { success: true, message: "Subproduto atualizado com sucesso!" };
    } catch (e) {
        console.error("ERRO em atualizarSubProdutoVinculado: " + e.toString());
        throw e;
    }
}

/**
 * Propaga a mudança de nome de um Produto para todos os Subprodutos vinculados.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {string} nomeAntigo - O nome antigo do produto.
 * @param {string} nomeAtualizado - O novo nome do produto.
 */
async function propagarNomeProduto(sheets, spreadsheetId, nomeAntigo, nomeAtualizado) {
    console.log(`[SubProdutosCRUD] Propagando nome de PRODUTO: "${nomeAntigo}" -> "${nomeAtualizado}"`);
    return await batchAtualizarProduto(sheets, spreadsheetId, nomeAntigo, nomeAtualizado);
}

/**
 * Helper para batchUpdate de nome de Produto Vinculado
 */
async function batchAtualizarProduto(sheets, spreadsheetId, nomeAntigo, nomeAtualizado) {
    const dadosSub = await getSubProdutosPlanilha(sheets, spreadsheetId);
    if (dadosSub.length < 2) return 0;

    const cabecalhosSub = dadosSub[0].map(String);
    const idxSubProdVinc = cabecalhosSub.indexOf("Produto Vinculado");
    if (idxSubProdVinc === -1) {
        console.warn(`[SubProdutosCRUD] Coluna "Produto Vinculado" não encontrada. Propagação pulada.`);
        return 0;
    }

    const requests = [];
    let atualizacoes = 0;
    const sheetId = await getSheetIdByName(sheets, spreadsheetId, ABA_SUBPRODUTOS);

    for (let i = 1; i < dadosSub.length; i++) {
        if (String(dadosSub[i][idxSubProdVinc]) === nomeAntigo) {
            requests.push({
                updateCells: {
                    rows: [{ values: [{ userEnteredValue: { stringValue: nomeAtualizado } }] }],
                    fields: "userEnteredValue",
                    start: { sheetId: sheetId, rowIndex: i, columnIndex: idxSubProdVinc }
                }
            });
            atualizacoes++;
        }
    }

    if (requests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: spreadsheetId,
            resource: { requests: requests }
        });
        console.log(`[SubProdutosCRUD] Nome do produto propagado para ${atualizacoes} subprodutos.`);
    }
    return atualizacoes;
}

/**
 * Propaga a mudança de nome de um Fornecedor para todos os Subprodutos vinculados.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {string} nomeAntigo - O nome antigo do fornecedor.
 * @param {string} nomeAtualizado - O novo nome do fornecedor.
 */
async function propagarNomeFornecedor(sheets, spreadsheetId, nomeAntigo, nomeAtualizado) {
     console.log(`[SubProdutosCRUD] Propagando nome de FORNECEDOR: "${nomeAntigo}" -> "${nomeAtualizado}"`);
     return await batchAtualizarFornecedor(sheets, spreadsheetId, nomeAntigo, nomeAtualizado);
}

/**
 * Helper para batchUpdate de nome de Fornecedor
 */
async function batchAtualizarFornecedor(sheets, spreadsheetId, nomeAntigo, nomeAtualizado) {
    const dadosSub = await getSubProdutosPlanilha(sheets, spreadsheetId);
    if (dadosSub.length < 2) return 0;

    const cabecalhosSub = dadosSub[0].map(String);
    const idxSubForn = cabecalhosSub.indexOf("Fornecedor");
    if (idxSubForn === -1) {
        console.warn(`[SubProdutosCRUD] Coluna "Fornecedor" não encontrada. Propagação pulada.`);
        return 0;
    }

    const requests = [];
    let atualizacoes = 0;
    const sheetId = await getSheetIdByName(sheets, spreadsheetId, ABA_SUBPRODUTOS);

    for (let i = 1; i < dadosSub.length; i++) {
        if (String(dadosSub[i][idxSubForn]) === nomeAntigo) {
            requests.push({
                updateCells: {
                    rows: [{ values: [{ userEnteredValue: { stringValue: nomeAtualizado } }] }],
                    fields: "userEnteredValue",
                    start: { sheetId: sheetId, rowIndex: i, columnIndex: idxSubForn }
                }
            });
            atualizacoes++;
        }
    }

    if (requests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: spreadsheetId,
            resource: { requests: requests }
        });
        console.log(`[SubProdutosCRUD] Nome do fornecedor propagado para ${atualizacoes} subprodutos.`);
    }
    return atualizacoes;
}


// Exporta todas as funções
module.exports = {
  getSubProdutosPlanilha,
  mapSubProdutoRowToObject,
  getSubProdutosPorPai,
  getDetalhesSubProdutoPorId,
  criarNovoSubProduto,
  atualizarSubProduto,
  excluirSubProduto,
  cadastrarMultiplosSubProdutos,
  getTodosProdutosParaDropdown,
  getTodosFornecedoresParaDropdown,
  adicionarNovoSubProdutoVinculado,
  atualizarSubProdutoVinculado,
  propagarNomeProduto,
  propagarNomeFornecedor
};