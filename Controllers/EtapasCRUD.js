// controllers/EtapasCRUD.js
// Migrado de src/EtapasCRUD.js

const {
  ABA_PRODUTOS,
  CABECALHOS_PRODUTOS,
  ABA_COTACOES,
  CABECALHOS_COTACOES,
  ABA_PORTAL,
  CABECALHOS_PORTAL,
  ABA_CADASTROS,
  CABECALHOS_CADASTROS,
  ABA_FORNECEDORES,
  CABECALHOS_FORNECEDORES
} = require('../config/constants');

// Importa o módulo 'crypto' do Node.js para gerar UUIDs
const crypto = require('crypto');

// Status do Portal (migrado de Constantes.js)
const STATUS_PORTAL = {
  LINK_GERADO: "Link Gerado",
  RESPONDIDO: "Respondido",
  EM_PREENCHIMENTO: "Em Preenchimento",
  FECHADO: "Fechado",
  ERRO_PORTAL: "Erro no Portal",
  EXPIRADO: "Expirado"
};


// --- Funções Auxiliares Internas (Helpers) ---

/**
 * Normaliza números vindos do Sheets (pt-BR e en-US).
 * (Copiado de CotacaoIndividualCRUD.js)
 */
function _parseNumeroPtBr(valor) {
  if (valor === null || valor === undefined) return NaN;
  if (typeof valor === 'number') return Number(valor);
  if (valor instanceof Date) return NaN;

  const s = String(valor).trim();
  if (!s) return NaN;

  const normalizado = s
    .replace(/\s+/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '') // remove "." de milhar
    .replace(',', '.');

  const n = Number(normalizado);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Lê os dados brutos (array de arrays) de uma aba inteira.
 * (Copiado de CotacaoIndividualCRUD.js)
 */
async function _getRawSheetData(sheets, spreadsheetId, nomeAba) {
  console.log(`[CRUD-Util] Lendo dados brutos da aba: ${nomeAba}`);
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: nomeAba,
    });
    return response.data.values || [];
  } catch (e) {
    console.error(`Erro ao ler dados brutos da aba ${nomeAba}: ${e.message}`);
    throw new Error(`A aba "${nomeAba}" não foi encontrada ou está inacessível.`);
  }
}

/**
 * Lê dados de uma aba e converte para array de objetos.
 * (Copiado de CotacaoIndividualCRUD.js)
 */
async function _obterDadosCompletosDaAba(sheets, spreadsheetId, nomeAba, cabecalhosEsperados) {
  console.log(`[CRUD-Util] Lendo dados e convertendo para objetos da aba: "${nomeAba}"`);
  try {
    const dadosRange = await _getRawSheetData(sheets, spreadsheetId, nomeAba);
    if (dadosRange.length < 2) return [];

    const cabecalhosReais = dadosRange[0].map(String);
    const dadosObjetos = [];

    for (let i = 1; i < dadosRange.length; i++) {
      const linha = dadosRange[i];
      const objLinha = {};
      cabecalhosEsperados.forEach(cabecalhoConstante => {
        const indexNaPlanilha = cabecalhosReais.indexOf(cabecalhoConstante);
        if (indexNaPlanilha !== -1) {
          objLinha[cabecalhoConstante] = linha[indexNaPlanilha];
        } else {
          objLinha[cabecalhoConstante] = undefined;
        }
      });
      dadosObjetos.push(objLinha);
    }
    return dadosObjetos;
  } catch (e) {
    console.error(`Erro em _obterDadosCompletosDaAba para "${nomeAba}": ${e.message}`);
    return null;
  }
}

/**
 * Busca o ID de uma aba (Sheet) pelo seu nome.
 */
async function _getSheetIdByName(sheets, spreadsheetId, sheetName) {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });
    const sheet = response.data.sheets.find(s => s.properties.title === sheetName);
    return sheet ? sheet.properties.sheetId : null;
  } catch (error) {
    console.error(`Erro ao buscar ID da aba "${sheetName}": ${error.message}`);
    return null;
  }
}

// --- Funções CRUD Exportadas ---

/**
 * (Migrado de EtapasCRUD_salvarDadosContagemEstoque)
 */
async function salvarDadosContagemEstoque(sheets, spreadsheetId, idCotacao, dadosContagem) {
  console.log(`[CRUD-Etapas] Salvando Contagem de Estoque para ID '${idCotacao}'.`);
  
  const updateRequests = [];
  let atualizacoesProdutos = 0;
  let atualizacoesCotacoes = 0;

  try {
    // 1. Prepara atualizações para a aba "Produtos" (Estoque Mínimo)
    const dadosProdutos = await _getRawSheetData(sheets, spreadsheetId, ABA_PRODUTOS);
    if (dadosProdutos.length > 1) {
      const cabecalhosProdutos = dadosProdutos[0].map(String);
      const colIndexProduto = cabecalhosProdutos.indexOf("Produto");
      const colIndexEstMin = cabecalhosProdutos.indexOf("Estoque Minimo");

      if (colIndexProduto === -1 || colIndexEstMin === -1) {
        throw new Error(`Colunas "Produto" ou "Estoque Minimo" não encontradas na aba "${ABA_PRODUTOS}".`);
      }

      dadosContagem.forEach(contagemItem => {
        const novoEstoqueMinimo = contagemItem.novoEstoqueMinimoProdutoPrincipal;
        if (novoEstoqueMinimo !== null && novoEstoqueMinimo !== undefined && !isNaN(parseFloat(novoEstoqueMinimo))) {
          for (let i = 1; i < dadosProdutos.length; i++) {
            if (String(dadosProdutos[i][colIndexProduto]).trim() === String(contagemItem.nomeProdutoPrincipal).trim()) {
              const linhaPlanilha = i + 1; // 1-based
              updateRequests.push({
                range: `${ABA_PRODUTOS}!${String.fromCharCode(65 + colIndexEstMin)}${linhaPlanilha}`,
                values: [[parseFloat(novoEstoqueMinimo)]]
              });
              atualizacoesProdutos++;
              break;
            }
          }
        }
      });
    }

    // 2. Prepara atualizações para a aba "Cotações" (Estoque Atual / Comprar)
    const dadosCotacoes = await _getRawSheetData(sheets, spreadsheetId, ABA_COTACOES);
    if (dadosCotacoes.length > 1) {
      const cabecalhosCotacoes = dadosCotacoes[0].map(String);
      const colIndexIdCotacao = cabecalhosCotacoes.indexOf("ID da Cotação");
      const colIndexProduto = cabecalhosCotacoes.indexOf("Produto");
      const colIndexEstAtual = cabecalhosCotacoes.indexOf("Estoque Atual");
      
      if (colIndexIdCotacao === -1 || colIndexProduto === -1 || colIndexEstAtual === -1) {
         throw new Error(`Colunas "ID da Cotação", "Produto" ou "Estoque Atual" não encontradas na aba "${ABA_COTACOES}".`);
      }

      for (let i = 1; i < dadosCotacoes.length; i++) {
        const linhaCotacao = dadosCotacoes[i];
        if (String(linhaCotacao[colIndexIdCotacao]) === String(idCotacao)) {
          const nomeProdutoNaLinha = String(linhaCotacao[colIndexProduto]).trim();
          const dadosContagemProduto = dadosContagem.find(item => String(item.nomeProdutoPrincipal).trim() === nomeProdutoNaLinha);

          if (dadosContagemProduto) {
            const estContado = dadosContagemProduto.estoqueAtualContagem;
            const comprarSug = dadosContagemProduto.comprarSugestao;

            if (estContado !== null || comprarSug !== null) {
              const textoCombinado = `Estoque Atual: ${estContado !== null && !isNaN(parseFloat(estContado)) ? parseFloat(estContado) : 'N/A'} / Comprar: ${comprarSug !== null && !isNaN(parseFloat(comprarSug)) ? parseFloat(comprarSug) : 'N/A'}`;
              
              const linhaPlanilha = i + 1; // 1-based
              updateRequests.push({
                range: `${ABA_COTACOES}!${String.fromCharCode(65 + colIndexEstAtual)}${linhaPlanilha}`,
                values: [[textoCombinado]]
              });
              atualizacoesCotacoes++;
            }
          }
        }
      }
    }

    // 3. Executa o batch update
    if (updateRequests.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: spreadsheetId,
        resource: {
          valueInputOption: 'USER_ENTERED',
          data: updateRequests
        }
      });
    }

    let message = "Nenhuma alteração realizada na contagem.";
    if (atualizacoesProdutos > 0 || atualizacoesCotacoes > 0) {
      message = `Contagem salva! ${atualizacoesProdutos} produto(s) atualizado(s) em Estoque Mínimo. ${atualizacoesCotacoes} linha(s) de cotação atualizada(s).`;
    }
    return { success: true, message: message };

  } catch (error) {
    console.error(`ERRO CRÍTICO em salvarDadosContagemEstoque: ${error.toString()}`, error.stack);
    return { success: false, message: "Erro no EtapasCRUD ao salvar dados da contagem: " + error.message };
  }
}

/**
 * (Migrado de EtapasCRUD_atualizarStatusCotacao)
 */
async function atualizarStatusCotacao(sheets, spreadsheetId, idCotacao, novoStatus) {
  console.log(`[CRUD-Etapas] Atualizando Status: ID '${idCotacao}', Novo Status: '${novoStatus}'.`);
  let linhasAtualizadas = 0;

  try {
    const dadosCotacoes = await _getRawSheetData(sheets, spreadsheetId, ABA_COTACOES);
    if (dadosCotacoes.length < 2) {
      return { success: false, message: `Aba "${ABA_COTACOES}" vazia ou só cabeçalho.` };
    }

    const cabecalhos = dadosCotacoes[0].map(String);
    const colIndexIdCotacao = cabecalhos.indexOf("ID da Cotação");
    const colIndexStatusCotacao = cabecalhos.indexOf("Status da Cotação");
    if (colIndexIdCotacao === -1 || colIndexStatusCotacao === -1) {
      throw new Error(`Colunas "ID da Cotação" ou "Status da Cotação" não encontradas.`);
    }

    const updateRequests = [];
    for (let i = 1; i < dadosCotacoes.length; i++) {
      if (String(dadosCotacoes[i][colIndexIdCotacao]) === String(idCotacao)) {
        const linhaPlanilha = i + 1; // 1-based
        updateRequests.push({
          range: `${ABA_COTACOES}!${String.fromCharCode(65 + colIndexStatusCotacao)}${linhaPlanilha}`,
          values: [[novoStatus]]
        });
        linhasAtualizadas++;
      }
    }

    if (linhasAtualizadas > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: spreadsheetId,
        resource: { valueInputOption: 'USER_ENTERED', data: updateRequests }
      });
      return { success: true, message: `Status da cotação ID '${idCotacao}' atualizado para "${novoStatus}".` };
    } else {
      return { success: false, message: `Nenhuma linha encontrada para cotação ID '${idCotacao}'.` };
    }
  } catch (error) {
    console.error(`ERRO em atualizarStatusCotacao: ${error.toString()}`, error.stack);
    return { success: false, message: "Erro no EtapasCRUD ao atualizar status: " + error.message };
  }
}

/**
 * (Migrado de EtapasCRUD_excluirLinhasDaCotacaoPorProdutoPrincipal)
 */
async function excluirLinhasDaCotacaoPorProdutoPrincipal(sheets, spreadsheetId, idCotacao, nomesProdutosPrincipais) {
  console.log(`[CRUD-Etapas] Excluindo por Produto Principal: ID '${idCotacao}'. Produtos:`, nomesProdutosPrincipais);
  let linhasExcluidasCount = 0;

  try {
    const sheetId = await _getSheetIdByName(sheets, spreadsheetId, ABA_COTACOES);
    if (!sheetId) throw new Error(`Aba "${ABA_COTACOES}" não encontrada.`);

    const dadosCotacoes = await _getRawSheetData(sheets, spreadsheetId, ABA_COTACOES);
    if (dadosCotacoes.length < 2) return { success: true, message: "Aba cotações vazia.", linhasExcluidas: 0 };

    const cabecalhos = dadosCotacoes[0].map(String);
    const colIndexIdCotacao = cabecalhos.indexOf("ID da Cotação");
    const colIndexProduto = cabecalhos.indexOf("Produto");
    if (colIndexIdCotacao === -1 || colIndexProduto === -1) {
      throw new Error(`Colunas "ID da Cotação" ou "Produto" não encontradas.`);
    }
    
    const deleteRequests = [];
    const nomesSet = new Set(nomesProdutosPrincipais);
    // Itera de baixo para cima para exclusão segura
    for (let i = dadosCotacoes.length - 1; i >= 1; i--) { 
      const linhaAtual = dadosCotacoes[i];
      const idCotacaoLinha = String(linhaAtual[colIndexIdCotacao]);
      const produtoLinha = String(linhaAtual[colIndexProduto]).trim();

      if (idCotacaoLinha === String(idCotacao) && nomesSet.has(produtoLinha)) {
        deleteRequests.push({
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: "ROWS",
              startIndex: i, // 0-based index
              endIndex: i + 1
            }
          }
        });
        linhasExcluidasCount++;
      }
    }

    if (deleteRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId,
        resource: { requests: deleteRequests }
      });
    }
    
    return {
      success: true,
      message: `${linhasExcluidasCount} linha(s) de produto(s) excluída(s) da cotação.`,
      linhasExcluidas: linhasExcluidasCount
    };
  } catch (error) {
    console.error(`ERRO em excluirLinhasDaCotacaoPorProdutoPrincipal: ${error.toString()}`, error.stack);
    return { success: false, message: "Erro no EtapasCRUD ao excluir linhas: " + error.message, linhasExcluidas: 0 };
  }
}

/**
 * (Migrado de EtapasCRUD_obterFornecedoresUnicosDaCotacaoParaEtapaEnvio)
 * Esta é uma função interna chamada por `gerarOuAtualizarLinksPortal`.
 */
async function _obterFornecedoresUnicosDaCotacao(sheets, spreadsheetId, idCotacao) {
  console.log(`[CRUD-Etapas] Buscando fornecedores unicos para ID '${idCotacao}'.`);
  const fornecedores = new Set();
  try {
    const dadosCotacoes = await _getRawSheetData(sheets, spreadsheetId, ABA_COTACOES);
    if (dadosCotacoes.length < 2) return [];

    const cabecalhos = dadosCotacoes[0].map(String);
    const idxIdCotacao = cabecalhos.indexOf("ID da Cotação");
    const idxFornecedor = cabecalhos.indexOf("Fornecedor");
    if (idxIdCotacao === -1 || idxFornecedor === -1) {
      throw new Error(`Colunas chave "ID da Cotação" ou "Fornecedor" não encontradas.`);
    }

    for (let i = 1; i < dadosCotacoes.length; i++) {
      if (String(dadosCotacoes[i][idxIdCotacao]).trim() === String(idCotacao).trim()) {
        const nomeFornecedor = String(dadosCotacoes[i][idxFornecedor]).trim();
        if (nomeFornecedor) fornecedores.add(nomeFornecedor);
      }
    }
    return Array.from(fornecedores);
  } catch (error) {
    console.error(`ERRO CRÍTICO em _obterFornecedoresUnicosDaCotacao: ${error.toString()}`, error.stack);
    return null;
  }
}

/**
 * (Migrado de EtapasCRUD_gerarOuAtualizarLinksPortalParaEtapaEnvio)
 */
async function gerarOuAtualizarLinksPortal(sheets, spreadsheetId, idCotacao) {
  console.log(`[CRUD-Etapas] Gerando/Atualizando links do portal para ID '${idCotacao}'.`);
  const resultado = { success: false, message: "", detalhesLinks: [] };
  
  // *** NOVA URL BASE ***
  const webAppUrlBase = process.env.BASE_URL || "http://localhost:8080";
  if (!webAppUrlBase) {
      return { success: false, message: "BASE_URL não está definida no arquivo .env. Não é possível criar links." };
  }

  try {
    const fornecedoresDaCotacao = await _obterFornecedoresUnicosDaCotacao(sheets, spreadsheetId, idCotacao);
    if (fornecedoresDaCotacao === null) {
      return { success: false, message: `Falha ao obter fornecedores da cotação ${idCotacao}.` };
    }
    if (fornecedoresDaCotacao.length === 0) {
      return { success: true, message: `Nenhum fornecedor encontrado para a cotação ${idCotacao}.` };
    }

    const dadosPortal = await _getRawSheetData(sheets, spreadsheetId, ABA_PORTAL);
    const cabecalhosPortal = dadosPortal.length > 0 ? dadosPortal[0].map(String) : CABECALHOS_PORTAL;
    const dadosRowsPortal = dadosPortal.length > 1 ? dadosPortal.slice(1) : [];

    const indices = CABECALHOS_PORTAL.reduce((acc, c, i) => ({...acc, [c]: cabecalhosPortal.indexOf(c)}), {});
    if (Object.values(indices).some(idx => idx === -1)) {
       throw new Error(`Cabeçalhos essenciais da aba "${ABA_PORTAL}" não encontrados. Verifique a constante CABECALHOS_PORTAL.`);
    }

    const updateRequests = [];
    const appendRequest = {
      range: ABA_PORTAL,
      values: []
    };
    let linksProcessados = 0;

    for (const nomeFornecedor of fornecedoresDaCotacao) {
      let linhaExistentePortal = -1; // 0-based index
      for (let i = 0; i < dadosRowsPortal.length; i++) {
        if (String(dadosRowsPortal[i][indices["ID da Cotação"]]).trim() === idCotacao &&
            String(dadosRowsPortal[i][indices["Nome Fornecedor"]]).trim() === nomeFornecedor) {
          linhaExistentePortal = i;
          break;
        }
      }

      const novoToken = crypto.randomUUID();
      const novoLink = `${webAppUrlBase}/portal?token=${novoToken}`; // URL da view do portal
      const dataAtual = new Date().toISOString();
      linksProcessados++;

      if (linhaExistentePortal !== -1) {
        const linhaPlanilha = linhaExistentePortal + 2; // 1-based + header
        updateRequests.push({ range: `${ABA_PORTAL}!${String.fromCharCode(65 + indices["Token Acesso"])}${linhaPlanilha}`, values: [[novoToken]] });
        updateRequests.push({ range: `${ABA_PORTAL}!${String.fromCharCode(65 + indices["Link Acesso"])}${linhaPlanilha}`, values: [[novoLink]] });
        updateRequests.push({ range: `${ABA_PORTAL}!${String.fromCharCode(65 + indices["Status"])}${linhaPlanilha}`, values: [[STATUS_PORTAL.LINK_GERADO]] });
        updateRequests.push({ range: `${ABA_PORTAL}!${String.fromCharCode(65 + indices["Data Envio"])}${linhaPlanilha}`, values: [[dataAtual]] });
        updateRequests.push({ range: `${ABA_PORTAL}!${String.fromCharCode(65 + indices["Data Resposta"])}${linhaPlanilha}`, values: [[""]] }); // Limpa data de resposta
      } else {
        const novaLinhaArray = new Array(cabecalhosPortal.length).fill("");
        novaLinhaArray[indices["ID da Cotação"]] = idCotacao;
        novaLinhaArray[indices["Nome Fornecedor"]] = nomeFornecedor;
        novaLinhaArray[indices["Token Acesso"]] = novoToken;
        novaLinhaArray[indices["Link Acesso"]] = novoLink;
        novaLinhaArray[indices["Status"]] = STATUS_PORTAL.LINK_GERADO;
        novaLinhaArray[indices["Data Envio"]] = dataAtual;
        appendRequest.values.push(novaLinhaArray);
      }
      resultado.detalhesLinks.push({ fornecedor: nomeFornecedor, link: novoLink });
    }

    if (updateRequests.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: spreadsheetId,
        resource: { valueInputOption: 'USER_ENTERED', data: updateRequests }
      });
    }
    if (appendRequest.values.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheetId,
        range: ABA_PORTAL,
        valueInputOption: 'USER_ENTERED',
        resource: appendRequest
      });
    }

    resultado.success = true;
    resultado.message = `${linksProcessados} link(s) processado(s) para a cotação ${idCotacao}.`;
    return resultado;

  } catch (error) {
    console.error(`ERRO em gerarOuAtualizarLinksPortal: ${error.toString()}`, error.stack);
    return { success: false, message: "Erro no EtapasCRUD ao gerar/atualizar links: " + error.message };
  }
}

/**
 * (Migrado de EtapasCRUD_excluirLinhasDaCotacaoPorSubProduto)
 */
async function excluirLinhasDaCotacaoPorSubProduto(sheets, spreadsheetId, idCotacao, subProdutosParaExcluir) {
  console.log(`[CRUD-Etapas] Excluindo por SubProduto: ID '${idCotacao}'.`);
  let linhasExcluidasCount = 0;

  try {
    const sheetId = await _getSheetIdByName(sheets, spreadsheetId, ABA_COTACOES);
    if (!sheetId) throw new Error(`Aba "${ABA_COTACOES}" não encontrada.`);

    const dadosCotacoes = await _getRawSheetData(sheets, spreadsheetId, ABA_COTACOES);
    if (dadosCotacoes.length < 2) return { success: true, message: "Aba cotações vazia.", linhasExcluidas: 0 };

    const cabecalhos = dadosCotacoes[0].map(String);
    const colMap = {
      id: cabecalhos.indexOf("ID da Cotação"),
      produto: cabecalhos.indexOf("Produto"),
      subProduto: cabecalhos.indexOf("SubProduto"),
      fornecedor: cabecalhos.indexOf("Fornecedor")
    };
    if (Object.values(colMap).some(idx => idx === -1)) {
      throw new Error(`Colunas chave (ID, Produto, SubProduto, Fornecedor) não encontradas.`);
    }

    const deleteRequests = [];
    // Itera de baixo para cima
    for (let i = dadosCotacoes.length - 1; i >= 1; i--) {
      const linhaAtual = dadosCotacoes[i];
      if (String(linhaAtual[colMap.id]) === String(idCotacao)) {
        const produtoLinha = String(linhaAtual[colMap.produto]).trim();
        const subProdutoLinha = String(linhaAtual[colMap.subProduto]).trim();
        const fornecedorLinha = String(linhaAtual[colMap.fornecedor]).trim();

        const deveExcluir = subProdutosParaExcluir.some(item =>
          item.Produto.trim() === produtoLinha &&
          item.SubProdutoChave.trim() === subProdutoLinha &&
          item.Fornecedor.trim() === fornecedorLinha
        );

        if (deveExcluir) {
          deleteRequests.push({
            deleteDimension: {
              range: { sheetId: sheetId, dimension: "ROWS", startIndex: i, endIndex: i + 1 }
            }
          });
          linhasExcluidasCount++;
        }
      }
    }

    if (deleteRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId,
        resource: { requests: deleteRequests }
      });
    }

    return {
      success: true,
      message: `${linhasExcluidasCount} subproduto(s) foram removidos da cotação.`,
      linhasExcluidas: linhasExcluidasCount
    };
  } catch (error) {
    console.error(`ERRO em excluirLinhasDaCotacaoPorSubProduto: ${error.toString()}`, error.stack);
    return { success: false, message: "Erro no CRUD ao excluir subprodutos: " + error.message, linhasExcluidas: 0 };
  }
}

/**
 * (Migrado de EtapasCRUD_obterEmpresasParaFaturamento)
 */
async function obterEmpresasParaFaturamento(sheets, spreadsheetId) {
  try {
    const dados = await _getRawSheetData(sheets, spreadsheetId, ABA_CADASTROS);
    if (dados.length < 2) return { success: true, empresas: [] };

    const cabecalhos = dados[0].map(String);
    const colIndexEmpresa = cabecalhos.indexOf(CABECALHOS_CADASTROS[0]); // "Empresas"
    if (colIndexEmpresa === -1) {
      throw new Error(`Coluna "${CABECALHOS_CADASTROS[0]}" não encontrada na aba "${ABA_CADASTROS}".`);
    }

    const empresas = dados.slice(1).map(row => row[colIndexEmpresa]).filter(String);
    return { success: true, empresas: empresas };
  } catch (error) {
    console.error(`ERRO em obterEmpresasParaFaturamento: ${error.toString()}`);
    return { success: false, message: "Erro ao buscar empresas para faturamento." };
  }
}

/**
 * (Migrado de EtapasCRUD_obterPedidosMinimosFornecedores)
 */
async function obterPedidosMinimosFornecedores(sheets, spreadsheetId) {
  try {
    const dados = await _getRawSheetData(sheets, spreadsheetId, ABA_FORNECEDORES);
    if (dados.length < 2) return { success: true, pedidosMinimos: {} };

    const cabecalhos = dados[0].map(String);
    const colFornecedor = cabecalhos.indexOf(CABECALHOS_FORNECEDORES[2]); // "Fornecedor"
    const colPedidoMinimo = cabecalhos.indexOf(CABECALHOS_FORNECEDORES[12]); // "Pedido Mínimo (R$)"
    if (colFornecedor === -1 || colPedidoMinimo === -1) {
      console.warn(`Colunas "Fornecedor" ou "Pedido Mínimo (R$)" não encontradas em "${ABA_FORNECEDORES}".`);
      return { success: true, pedidosMinimos: {} };
    }

    const pedidosMinimos = {};
    dados.slice(1).forEach(row => {
      const fornecedor = row[colFornecedor];
      const pedidoMinimo = _parseNumeroPtBr(row[colPedidoMinimo]);
      if (fornecedor && !isNaN(pedidoMinimo) && pedidoMinimo > 0) {
        pedidosMinimos[String(fornecedor).trim()] = pedidoMinimo;
      }
    });
    return { success: true, pedidosMinimos: pedidosMinimos };
  } catch (error) {
    console.error(`ERRO em obterPedidosMinimosFornecedores: ${error.toString()}`);
    return { success: false, message: "Erro ao buscar pedidos mínimos." };
  }
}

/**
 * (Migrado de EtapasCRUD_obterCondicoesPagamentoFornecedores)
 */
async function obterCondicoesPagamentoFornecedores(sheets, spreadsheetId) {
  try {
    const dados = await _getRawSheetData(sheets, spreadsheetId, ABA_FORNECEDORES);
    if (dados.length < 2) return { success: true, condicoes: {} };

    const cabecalhos = dados[0].map(String);
    const colFornecedor = cabecalhos.indexOf(CABECALHOS_FORNECEDORES[2]); // "Fornecedor"
    const colCondicoes = cabecalhos.indexOf(CABECALHOS_FORNECEDORES[10]); // "Condições de Pagamento"
    if (colFornecedor === -1 || colCondicoes === -1) {
      console.warn(`Colunas "Fornecedor" ou "Condições de Pagamento" não encontradas.`);
      return { success: true, condicoes: {} };
    }

    const condicoes = {};
    dados.slice(1).forEach(row => {
      const fornecedor = row[colFornecedor];
      const condicao = row[colCondicoes];
      if (fornecedor && condicao) {
        condicoes[String(fornecedor).trim()] = String(condicao);
      }
    });
    return { success: true, condicoes: condicoes };
  } catch (error) {
    console.error(`ERRO em obterCondicoesPagamentoFornecedores: ${error.toString()}`);
    return { success: false, message: "Erro ao buscar condições de pagamento." };
  }
}

/**
 * (Migrado de EtapasCRUD_salvarCondicoesPagamentoNaCotacao)
 */
async function salvarCondicoesPagamentoNaCotacao(sheets, spreadsheetId, idCotacao, dadosPagamento) {
  console.log(`[CRUD-Etapas] Salvando Condições de Pagamento para ID '${idCotacao}'.`);
  try {
    const dadosCotacoes = await _getRawSheetData(sheets, spreadsheetId, ABA_COTACOES);
    if (dadosCotacoes.length < 2) throw new Error("Aba de cotações vazia.");

    const cabecalhos = dadosCotacoes[0].map(String);
    const colMap = {
      id: cabecalhos.indexOf("ID da Cotação"),
      fornecedor: cabecalhos.indexOf("Fornecedor"),
      empresa: cabecalhos.indexOf("Empresa Faturada"),
      condicao: cabecalhos.indexOf("Condição de Pagamento"),
      comprar: cabecalhos.indexOf("Comprar")
    };
    if (Object.values(colMap).some(idx => idx === -1)) {
      throw new Error("Colunas necessárias (ID, Fornecedor, Empresa Faturada, Condição, Comprar) não encontradas.");
    }
    
    const mapaPagamentos = dadosPagamento.reduce((acc, item) => {
      acc[`${item.fornecedor}__${item.empresa}`] = item.condicao;
      return acc;
    }, {});
    
    const updateRequests = [];
    let linhasAtualizadas = 0;

    for (let i = 1; i < dadosCotacoes.length; i++) {
      const linha = dadosCotacoes[i];
      const comprarValor = _parseNumeroPtBr(linha[colMap.comprar]);
      
      if (String(linha[colMap.id]) === String(idCotacao) && comprarValor > 0) {
        const chaveLinha = `${String(linha[colMap.fornecedor])}__${String(linha[colMap.empresa])}`;
        
        if (mapaPagamentos.hasOwnProperty(chaveLinha)) {
          const novaCondicao = mapaPagamentos[chaveLinha];
          if (String(linha[colMap.condicao]) !== novaCondicao) {
            const linhaPlanilha = i + 1; // 1-based
            updateRequests.push({
              range: `${ABA_COTACOES}!${String.fromCharCode(65 + colMap.condicao)}${linhaPlanilha}`,
              values: [[novaCondicao]]
            });
            linhasAtualizadas++;
          }
        }
      }
    }

    if (linhasAtualizadas > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: spreadsheetId,
        resource: { valueInputOption: 'USER_ENTERED', data: updateRequests }
      });
      return { success: true, message: `Condições de pagamento salvas com sucesso para ${linhasAtualizadas} itens.` };
    } else {
      return { success: true, message: "Nenhuma alteração nas condições de pagamento foi necessária." };
    }
  } catch (error) {
    console.error(`ERRO em salvarCondicoesPagamentoNaCotacao: ${error.toString()}`, error.stack);
    return { success: false, message: "Erro no CRUD ao salvar condições de pagamento: " + error.message };
  }
}

/**
 * (Migrado de EtapasCRUD_buscarDadosAgrupadosParaImpressao)
 */
async function buscarDadosAgrupadosParaImpressao(sheets, spreadsheetId, idCotacao) {
  try {
    // 1. Mapear CNPJs das Empresas
    const dadosCadastros = await _getRawSheetData(sheets, spreadsheetId, ABA_CADASTROS);
    const mapaCnpj = {};
    if (dadosCadastros.length > 1) {
      const cabecalhosCadastros = dadosCadastros[0].map(String);
      const colEmpresa = cabecalhosCadastros.indexOf(CABECALHOS_CADASTROS[0]); // "Empresas"
      const colCnpj = cabecalhosCadastros.indexOf(CABECALHOS_CADASTROS[1]); // "CNPJ"
      if (colEmpresa > -1 && colCnpj > -1) {
        dadosCadastros.slice(1).forEach(linha => {
          if (linha[colEmpresa]) mapaCnpj[linha[colEmpresa].toString().trim()] = linha[colCnpj] || 'Não informado';
        });
      }
    }

    // 2. Processar Cotações
    const dadosCotacoes = await _getRawSheetData(sheets, spreadsheetId, ABA_COTACOES);
    if (dadosCotacoes.length < 2) return { success: true, dados: {} };

    const cabecalhosCotacoes = dadosCotacoes[0].map(String);
    const colMap = CABECALHOS_COTACOES.reduce((acc, c, i) => ({...acc, [c]: cabecalhosCotacoes.indexOf(c)}), {});
    // Validar colunas...
    
    const pedidosTemporarios = {};
    dadosCotacoes.slice(1).forEach(linha => {
      const idLinha = linha[colMap["ID da Cotação"]];
      const comprarQtd = _parseNumeroPtBr(linha[colMap["Comprar"]]);
      
      if (String(idLinha) === String(idCotacao) && comprarQtd > 0) {
        const nomeEmpresa = linha[colMap["Empresa Faturada"]];
        if (!nomeEmpresa) return;

        const nomeFornecedor = linha[colMap["Fornecedor"]];
        const chaveUnica = `${nomeFornecedor}__${nomeEmpresa}`;

        if (!pedidosTemporarios[chaveUnica]) {
          pedidosTemporarios[chaveUnica] = {
            fornecedor: nomeFornecedor,
            empresaFaturada: nomeEmpresa,
            cnpj: mapaCnpj[nomeEmpresa.trim()] || 'Não informado',
            condicaoPagamento: linha[colMap["Condição de Pagamento"]] || 'Não informada',
            itens: [],
            totalPedido: 0
          };
        }
        
        const preco = _parseNumeroPtBr(linha[colMap["Preço"]]);
        const valorTotal = _parseNumeroPtBr(linha[colMap["Valor Total"]]);
        
        pedidosTemporarios[chaveUnica].itens.push({
          subProduto: linha[colMap["SubProduto"]],
          un: linha[colMap["UN"]],
          qtd: comprarQtd,
          valorUnit: preco,
          valorTotal: valorTotal
        });
        pedidosTemporarios[chaveUnica].totalPedido += valorTotal;
      }
    });

    const dadosFinaisAgrupados = {};
    for (const chave in pedidosTemporarios) {
      const pedido = pedidosTemporarios[chave];
      if (!dadosFinaisAgrupados[pedido.fornecedor]) {
        dadosFinaisAgrupados[pedido.fornecedor] = [];
      }
      dadosFinaisAgrupados[pedido.fornecedor].push(pedido);
    }
    
    return { success: true, dados: dadosFinaisAgrupados };
  } catch (error) {
    console.error(`ERRO em buscarDadosAgrupadosParaImpressao: ${error.toString()}`, error.stack);
    return { success: false, message: "Erro no CRUD ao buscar dados para impressão: " + error.message };
  }
}

/**
 * (Migrado de EtapasCRUD_salvarEmpresasFaturadasEmLote)
 */
async function salvarEmpresasFaturadasEmLote(sheets, spreadsheetId, idCotacao, alteracoes) {
  console.log(`[CRUD-Etapas] Salvando Faturamento em Lote para ID '${idCotacao}'.`);
  try {
    const dadosCotacoes = await _getRawSheetData(sheets, spreadsheetId, ABA_COTACOES);
    if (dadosCotacoes.length < 2) throw new Error("Aba de cotações vazia.");

    const cabecalhos = dadosCotacoes[0].map(String);
    const colMap = {
      id: cabecalhos.indexOf("ID da Cotação"),
      produto: cabecalhos.indexOf("Produto"),
      subProduto: cabecalhos.indexOf("SubProduto"),
      fornecedor: cabecalhos.indexOf("Fornecedor"),
      empresaFaturada: cabecalhos.indexOf("Empresa Faturada")
    };
    if (Object.values(colMap).some(idx => idx === -1)) {
      throw new Error("Colunas necessárias para faturamento não encontradas.");
    }
    
    const mapaAlteracoes = alteracoes.reduce((acc, item) => {
      const chave = `${item.Produto.trim()}__${item.SubProdutoChave.trim()}__${item.Fornecedor.trim()}`;
      acc[chave] = item["Empresa Faturada"];
      return acc;
    }, {});

    const updateRequests = [];
    let linhasAtualizadas = 0;

    for (let i = 1; i < dadosCotacoes.length; i++) {
      const linha = dadosCotacoes[i];
      if (String(linha[colMap.id]).trim() === String(idCotacao).trim()) {
        const chaveLinha = `${String(linha[colMap.produto]).trim()}__${String(linha[colMap.subProduto]).trim()}__${String(linha[colMap.fornecedor]).trim()}`;
        
        if (mapaAlteracoes.hasOwnProperty(chaveLinha)) {
          const novaEmpresa = mapaAlteracoes[chaveLinha];
          if (String(linha[colMap.empresaFaturada]) !== novaEmpresa) {
            const linhaPlanilha = i + 1; // 1-based
            updateRequests.push({
              range: `${ABA_COTACOES}!${String.fromCharCode(65 + colMap.empresaFaturada)}${linhaPlanilha}`,
              values: [[novaEmpresa]]
            });
            linhasAtualizadas++;
          }
        }
      }
    }

    if (linhasAtualizadas > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: spreadsheetId,
        resource: { valueInputOption: 'USER_ENTERED', data: updateRequests }
      });
      return { success: true, message: `${linhasAtualizadas} item(ns) tiveram a empresa de faturamento atualizada.`, linhasAtualizadas };
    } else {
      return { success: true, message: "Nenhuma alteração de faturamento foi necessária.", linhasAtualizadas: 0 };
    }
  } catch (error) {
    console.error(`ERRO em salvarEmpresasFaturadasEmLote: ${error.toString()}`, error.stack);
    return { success: false, message: "Erro no CRUD ao salvar faturamento em lote: " + error.message, linhasAtualizadas: 0 };
  }
}


module.exports = {
  salvarDadosContagemEstoque,
  atualizarStatusCotacao,
  excluirLinhasDaCotacaoPorProdutoPrincipal,
  gerarOuAtualizarLinksPortal,
  excluirLinhasDaCotacaoPorSubProduto,
  obterEmpresasParaFaturamento,
  obterPedidosMinimosFornecedores,
  obterCondicoesPagamentoFornecedores,
  salvarCondicoesPagamentoNaCotacao,
  buscarDadosAgrupadosParaImpressao,
  salvarEmpresasFaturadasEmLote,
  _getRawSheetData, // Exporta o helper para o Controller
  _obterDadosCompletosDaAba // Exporta o helper para o Controller
};