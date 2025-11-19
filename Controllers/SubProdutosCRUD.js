// controllers/SubProdutosCRUD.js
// Migrado e expandido a partir de 'SubProdutosCRUD.js', 'ProdutosCRUD.js', e 'FornecedoresCRUD.js' do Apps Script.

const {
  ABA_PRODUTOS,
  CABECALHOS_PRODUTOS,
  ABA_SUBPRODUTOS,
  CABECALHOS_SUBPRODUTOS,
  ABA_FORNECEDORES,
  CABECALHOS_FORNECEDORES
} = require('../Config/constants');

// --- Funções Auxiliares Internas ---

function normalizarTextoComparacao(texto) {
  if (!texto || typeof texto !== 'string') return "";
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function gerarProximoId(data, idColumnIndex) {
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
    range: ABA_SUBPRODUTOS, 
  });
  return response.data.values || [];
}

/**
 * Mapeia uma linha (array) da planilha para um objeto JS.
 * @param {Array} rowArray - A linha de dados da planilha.
 * @param {Array} headers - O array de cabeçalhos da planilha.
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

  // Garante que o frontend receba as chaves que espera
  obj['ID_SubProduto'] = rowArray[headers.indexOf("ID")];
  obj['SubProduto'] = rowArray[headers.indexOf("SubProduto")];
  return obj;
}


// --- Funções CRUD Exportadas ---

/**
 * (Migrado de FornecedoresCRUD.js (Apps Script) -> SubProdutosCRUD_obterSubProdutosPorPai_NOVO)
 * Obtém todos os itens (subprodutos) vinculados a um nome de fornecedor ou produto.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {string} nomePai - O NOME do Fornecedor ou do Produto.
 * @param {string} tipoPai - 'FORNECEDOR' ou 'PRODUTO'.
 * @returns {Promise<Array<object>>} Uma lista de objetos de subprodutos.
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
      // Comparação direta de nomes (sem normalizar minúsculas, como no original)
      if (valorCelulaNormalizado === nomePaiNormalizado) { 
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
 * (Migrado de FornecedoresCRUD.js (Apps Script) -> SubProdutosCRUD_obterDetalhesSubProdutoPorId)
 * Obtém os detalhes completos de um item (subproduto) específico pelo seu ID.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {string} itemId - O ID do subproduto.
 * @returns {Promise<object|null>} O objeto do subproduto ou null.
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
 * (Migrado de SubProdutosCRUD.js (Apps Script) -> SubProdutosCRUD_criarNovoSubProduto)
 * Cria um novo subproduto. Esta função é chamada pelo Controller e já recebe os NOMES
 * do Produto Vinculado e do Fornecedor.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {object} dadosItem - Objeto com os dados do formulário (com Nomes, não IDs).
 * @returns {Promise<object>}
 */
async function criarNovoSubProduto(sheets, spreadsheetId, dadosItem) {
  try {
    const nomeSubProduto = dadosItem["SubProduto"];
    const nomeProdutoVinculado = dadosItem["Produto Vinculado"]; // NOME
    const nomeFornecedor = dadosItem["Fornecedor"]; // NOME

    if (!nomeSubProduto) throw new Error("O nome do SubProduto é obrigatório.");
    if (!nomeProdutoVinculado) throw new Error("O nome do Produto Vinculado é obrigatório.");
    if (!dadosItem["UN"]) throw new Error("O campo 'UN' é obrigatório.");

    const dados = await getSubProdutosPlanilha(sheets, spreadsheetId);
    const headers = dados[0].map(String);
    const dataRows = dados.slice(1);
    
    const idxId = headers.indexOf("ID");
    const idxNome = headers.indexOf("SubProduto");
    const idxProdVinc = headers.indexOf("Produto Vinculado");

    // Validação de duplicidade
    const nomeNovoSubProdutoNormalizado = normalizarTextoComparacao(nomeSubProduto);
    const nomeProdutoVinculadoNormalizado = normalizarTextoComparacao(nomeProdutoVinculado);
    for (const row of dataRows) {
      if (normalizarTextoComparacao(row[idxNome]) === nomeNovoSubProdutoNormalizado &&
          normalizarTextoComparacao(row[idxProdVinc]) === nomeProdutoVinculadoNormalizado) {
        throw new Error(`O subproduto '${nomeSubProduto}' já está cadastrado para o produto '${nomeProdutoVinculado}'.`);
      }
    }
    
    const novoIdGerado = gerarProximoId(dados, idxId);
    
    const novaLinhaArray = headers.map(header => {
        switch (header) {
            case "ID": return novoIdGerado;
            case "Data de Cadastro": return new Date().toISOString();
            case "Produto Vinculado": return nomeProdutoVinculado; // Salva o NOME
            case "Fornecedor": return nomeFornecedor || ""; // Salva o NOME
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
 * (Migrado de SubProdutosCRUD.js (Apps Script) -> SubProdutosCRUD_atualizarSubProduto)
 * Atualiza um subproduto existente. Recebe os NOMES do Controller.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {object} dadosItem - Objeto com os dados (deve conter "ID" ou "ID_SubProduto_Edicao").
 * @returns {Promise<object>}
 */
async function atualizarSubProduto(sheets, spreadsheetId, dadosItem) {
  try {
    const idParaAtualizar = dadosItem["ID"] || dadosItem["ID_SubProduto_Edicao"];
    if (!idParaAtualizar) throw new Error("ID do subproduto é obrigatório para atualização.");

    const nomeSubProdutoAtualizado = dadosItem["SubProduto"];
    const nomeProdutoVinculado = dadosItem["Produto Vinculado"]; // NOME
    const nomeFornecedor = dadosItem["Fornecedor"]; // NOME

    if (!nomeSubProdutoAtualizado) throw new Error("O nome do SubProduto é obrigatório.");
    if (!nomeProdutoVinculado) throw new Error("O nome do Produto Vinculado é obrigatório.");
    
    const dados = await getSubProdutosPlanilha(sheets, spreadsheetId);
    const headers = dados[0].map(String);
    const dataRows = dados.slice(1);

    const idxId = headers.indexOf("ID");
    const idxNome = headers.indexOf("SubProduto");
    const idxProdVinc = headers.indexOf("Produto Vinculado");

    let linhaIndex = -1; // 0-based
    const nomeSubProdutoAtualizadoNormalizado = normalizarTextoComparacao(nomeSubProdutoAtualizado);
    const nomeProdutoVinculadoNormalizado = normalizarTextoComparacao(nomeProdutoVinculado);

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (String(row[idxId]) === String(idParaAtualizar)) {
        linhaIndex = i; // 0-based index na dataRows
      } else {
        if (normalizarTextoComparacao(row[idxNome]) === nomeSubProdutoAtualizadoNormalizado &&
            normalizarTextoComparacao(row[idxProdVinc]) === nomeProdutoVinculadoNormalizado) {
          throw new Error(`O subproduto '${nomeSubProdutoAtualizado}' já está cadastrado para o produto '${nomeProdutoVinculado}' (em outro ID).`);
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
            return nomeProdutoVinculado; // Salva o NOME
        }
        if (header === "Fornecedor") {
            return nomeFornecedor || ""; // Salva o NOME
        }
        return dadosItem[header] !== undefined ? dadosItem[header] : linhaOriginal[k_idx];
    });

    const linhaPlanilha = linhaIndex + 2; // 1-based (para header) + 1-based (para range)
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
 * (Migrado de FornecedoresCRUD.js (Apps Script) -> SubProdutosCRUD_excluirSubProduto)
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
    for (let i = 1; i < dados.length; i++) { // i é 1-based index do array 'dados'
      if (String(dados[i][idxId]) === String(subProdutoId)) {
        linhaIndex = i; // 1-based index (para dados[i])
        break;
      }
    }

    if (linhaIndex === -1) {
      return { success: false, message: `Subproduto com ID '${subProdutoId}' não encontrado.` };
    }

    const sheetId = await getSheetIdByName(sheets, spreadsheetId, ABA_SUBPRODUTOS);
    
    // *** INÍCIO DA CORREÇÃO ***
    // O startIndex do deleteDimension é 0-based e se refere à planilha.
    // Se linhaIndex = 1 (que é dados[1]), esta é a LINHA 2 da planilha.
    // O índice 0-based da LINHA 2 é 1.
    // Portanto, o startIndex deve ser 'linhaIndex'.
    const requests = [{
      deleteDimension: {
        range: {
          sheetId: sheetId,
          dimension: "ROWS",
          startIndex: linhaIndex, // CORRIGIDO (era linhaIndex + 1 no seu arquivo)
          endIndex: linhaIndex + 1   // CORRIGIDO (era linhaIndex + 2 no seu arquivo)
        }
      }
    }];
    // *** FIM DA CORREÇÃO ***
    
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
 * (Migrado de SubProdutosCRUD.js (Apps Script) -> SubProdutosCRUD_cadastrarMultiplosSubProdutos)
 * Cadastra múltiplos subprodutos de uma vez. Recebe NOMES do Controller.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {object} dadosLote - { fornecedorGlobalNome: string, subProdutos: Array<Object> (com Nomes) }
 * @returns {Promise<object>}
 */
async function cadastrarMultiplosSubProdutos(sheets, spreadsheetId, dadosLote) {
    try {
        const { fornecedorGlobalNome, subProdutos } = dadosLote;
        if (!subProdutos || subProdutos.length === 0) {
            throw new Error("Dados insuficientes para cadastro em lote.");
        }

        const dados = await getSubProdutosPlanilha(sheets, spreadsheetId);
        const headers = dados[0].map(String);
        const dataRows = dados.slice(1);

        const idxId = headers.indexOf("ID");
        const idxNome = headers.indexOf("SubProduto");
        const idxProdVinc = headers.indexOf("Produto Vinculado");
        
        let proximoId = gerarProximoId(dados, idxId);
        const resultadosDetalhados = [];
        let subProdutosAdicionadosComSucesso = 0;
        const novasLinhasParaAdicionar = [];
        
        const mapaDuplicidadePlanilha = new Set(dataRows.map(row => 
            `${normalizarTextoComparacao(row[idxNome])}#${normalizarTextoComparacao(row[idxProdVinc])}`
        ));
        const mapaDuplicidadeLote = new Set();

        for (const subProdutoIndividual of subProdutos) {
            const nomeSubProdutoAtual = subProdutoIndividual["SubProduto"];
            const nomeProdutoVinculado = subProdutoIndividual["Produto Vinculado"]; // NOME

            if (!nomeSubProdutoAtual || !nomeProdutoVinculado || !subProdutoIndividual["UN"]) {
                resultadosDetalhados.push({ nome: nomeSubProdutoAtual || "Nome não fornecido", status: "Falha", erro: "Campos obrigatórios (SubProduto, Produto Vinculado, UN) não preenchidos." });
                continue;
            }
            
            const nomeSubProdutoNormalizado = normalizarTextoComparacao(nomeSubProdutoAtual);
            const nomeProdutoVinculadoNormalizado = normalizarTextoComparacao(nomeProdutoVinculado);
            const chaveUnica = `${nomeSubProdutoNormalizado}#${nomeProdutoVinculadoNormalizado}`;

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
                    case "Fornecedor": return fornecedorGlobalNome || ""; // Usa o NOME global
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
        
        let mensagemFinal = `${subProdutosAdicionadosComSucesso} de ${subProdutos.length} subprodutos foram processados.`;
        if (subProdutosAdicionadosComSucesso === subProdutos.length && subProdutos.length > 0) {
            mensagemFinal = "Todos os subprodutos foram cadastrados com sucesso!";
        } else if (subProdutosAdicionadosComSucesso === 0 && subProdutos.length > 0) {
            mensagemFinal = "Nenhum subproduto pôde ser cadastrado. Verifique os erros.";
        }

        return { success: true, message: mensagemFinal, detalhes: resultadosDetalhados };
    } catch (e) {
        console.error("ERRO em cadastrarMultiplosSubProdutos: " + e.toString());
        throw e;
    }
}

/**
 * (Migrado de ProdutosCRUD.js (Apps Script) -> ProdutosCRUD_adicionarNovoSubProdutoVinculado)
 * Adiciona um novo subproduto, recebendo o *nome* do produto vinculado.
 * Usado por ProdutosScript.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha principal.
 * @param {object} dadosItem - Objeto com os dados do formulário (com Nomes).
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
 * (Migrado de ProdutosCRUD.js (Apps Script) -> ProdutosCRUD_atualizarSubProdutoVinculado)
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
            // O 'dadosItem' já vem com os Nomes corretos do Produto Vinculado e Fornecedor
            return dadosItem[header] !== undefined ? dadosItem[header] : linhaOriginal[k_idx];
        });

        const linhaPlanilha = linhaIndex + 2;
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

    for (let i = 1; i < dadosSub.length; i++) { // i é 1-based index de dados[]
        if (String(dadosSub[i][idxSubProdVinc]) === nomeAntigo) {
            requests.push({
                updateCells: {
                    rows: [{ values: [{ userEnteredValue: { stringValue: nomeAtualizado } }] }],
                    fields: "userEnteredValue",
                    start: { sheetId: sheetId, rowIndex: i, columnIndex: idxSubProdVinc } // rowIndex é 0-based
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

    for (let i = 1; i < dadosSub.length; i++) { // i é 1-based index de dados[]
        if (String(dadosSub[i][idxSubForn]) === nomeAntigo) {
            requests.push({
                updateCells: {
                    rows: [{ values: [{ userEnteredValue: { stringValue: nomeAtualizado } }] }],
                    fields: "userEnteredValue",
                    start: { sheetId: sheetId, rowIndex: i, columnIndex: idxSubForn } // rowIndex é 0-based
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
  adicionarNovoSubProdutoVinculado,
  atualizarSubProdutoVinculado,
  propagarNomeProduto,
  propagarNomeFornecedor,
  getSheetIdByName
};