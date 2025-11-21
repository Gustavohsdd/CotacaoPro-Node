// controllers/CotacaoIndividualCRUD.js
// Migrado de src/CotacaoIndividualCRUD.js e partes de src/CotacoesCRUD.js

const {
    ABA_COTACOES,
    CABECALHOS_COTACOES,
    ABA_PRODUTOS,
    CABECALHOS_PRODUTOS,
    ABA_SUBPRODUTOS,
    CABECALHOS_SUBPRODUTOS,
    COLUNAS_PARA_ABA_SUBPRODUTOS // Esta constante não estava em constants.js, mas é referenciada.
} = require('../config/constants');

// Status que será usado ao adicionar novos itens
const COTacoesCRUD_STATUS_NOVA_COTACAO = "Nova Cotação";

// --- Funções Auxiliares Internas (Helpers) ---

/**
 * Normaliza números vindos do Sheets (pt-BR e en-US).
 * (Migrado de CotacaoIndividualCRUD_parseNumeroPtBr)
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
 * @param {object} sheets - Cliente Google Sheets API.
 * @param {string} spreadsheetId - ID da Planilha.
 * @param {string} nomeAba - Nome da aba (ex: "Produtos").
 * @returns {Promise<Array<Array<string>>>}
 */
async function _getRawSheetData(sheets, spreadsheetId, nomeAba) {
    console.log(`[CRUD-Util] Lendo dados brutos da aba: ${nomeAba}`);
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: nomeAba, // Lê a aba inteira
        });
        return response.data.values || [];
    } catch (e) {
        console.error(`Erro ao ler dados brutos da aba ${nomeAba}: ${e.message}`);
        throw new Error(`A aba "${nomeAba}" não foi encontrada ou está inacessível.`);
    }
}

/**
 * Lê dados de uma aba e converte para array de objetos.
 * (Migrado de CotacoesCRUD_obterDadosCompletosDaAba)
 * @param {object} sheets - Cliente Google Sheets API.
 * @param {string} spreadsheetId - ID da Planilha.
 * @param {string} nomeAba - Nome da aba.
 * @param {Array<string>} cabecalhosEsperados - Array dos cabeçalhos (de constants.js).
 * @returns {Promise<Array<object>>}
 */
async function _obterDadosCompletosDaAba(sheets, spreadsheetId, nomeAba, cabecalhosEsperados) {
    console.log(`[CRUD-Util] Lendo dados e convertendo para objetos da aba: "${nomeAba}"`);
    try {
        const dadosRange = await _getRawSheetData(sheets, spreadsheetId, nomeAba);
        if (dadosRange.length < 2) return []; // Vazia ou só cabeçalho

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
                    objLinha[cabecalhoConstante] = undefined; // ou null, para ser consistente
                }
            });
            dadosObjetos.push(objLinha);
        }
        return dadosObjetos;
    } catch (e) {
        console.error(`Erro em _obterDadosCompletosDaAba para "${nomeAba}": ${e.message}`);
        return null; // Retorna null em caso de falha
    }
}

/**
 * Cria um mapa de Produto -> Média das 3 últimas compras.
 * (Migrado de CotacaoIndividualCRUD_criarMapaDemandaMediaProdutos)
 */
async function _criarMapaDemandaMediaProdutos(sheets, spreadsheetId) {
    console.log("[CRUD] Criando mapa de demanda média...");
    const mapaDemandas = {};
    const valoresComprasPorProduto = {};

    try {
        const todosOsValores = await _getRawSheetData(sheets, spreadsheetId, ABA_COTACOES);
        if (todosOsValores.length < 2) return mapaDemandas;

        const cabecalhos = todosOsValores[0];
        const indiceProduto = cabecalhos.indexOf("Produto");
        const indiceComprar = cabecalhos.indexOf("Comprar");

        if (indiceProduto === -1 || indiceComprar === -1) {
            console.error(`[CRUD] MapaDemanda: Colunas "Produto" ou "Comprar" não encontradas na aba "${ABA_COTACOES}".`);
            return mapaDemandas;
        }

        for (let i = todosOsValores.length - 1; i >= 1; i--) { // De baixo para cima
            const linha = todosOsValores[i];
            const nomeProduto = String(linha[indiceProduto] || '').trim();

            if (nomeProduto) {
                if (!valoresComprasPorProduto[nomeProduto] || valoresComprasPorProduto[nomeProduto].length < 3) {
                    const quantidade = _parseNumeroPtBr(linha[indiceComprar]);
                    if (Number.isFinite(quantidade) && quantidade > 0) {
                        if (!valoresComprasPorProduto[nomeProduto]) {
                            valoresComprasPorProduto[nomeProduto] = [];
                        }
                        valoresComprasPorProduto[nomeProduto].push(quantidade);
                    }
                }
            }
        }

        for (const produto in valoresComprasPorProduto) {
            const compras = valoresComprasPorProduto[produto];
            const soma = compras.reduce((acc, val) => acc + val, 0);
            mapaDemandas[produto] = soma / compras.length;
        }
    } catch (error) {
        console.error("[CRUD] Erro ao criar mapa de demanda: " + error.toString());
    }
    return mapaDemandas;
}

/**
 * Cria um mapa de Produto -> Estoque Mínimo.
 * (Migrado de CotacaoIndividualCRUD_criarMapaEstoqueMinimoProdutos)
 */
async function _criarMapaEstoqueMinimoProdutos(sheets, spreadsheetId) {
    console.log("[CRUD] Criando mapa de estoque mínimo...");
    const mapaEstoque = {};
    try {
        const todosOsValores = await _getRawSheetData(sheets, spreadsheetId, ABA_PRODUTOS);
        if (todosOsValores.length < 2) return mapaEstoque;

        const cabecalhosPlanilhaProdutos = todosOsValores[0];
        const indiceProduto = cabecalhosPlanilhaProdutos.indexOf("Produto");
        const indiceEstoqueMinimo = cabecalhosPlanilhaProdutos.indexOf("Estoque Minimo");

        if (indiceProduto === -1) {
            console.error(`[CRUD] MapaEstoque: Coluna "Produto" não encontrada na aba "${ABA_PRODUTOS}".`);
            return mapaEstoque;
        }
        if (indiceEstoqueMinimo === -1) {
            console.warn(`[CRUD] MapaEstoque: Coluna "Estoque Minimo" não encontrada.`);
        }

        for (let i = 1; i < todosOsValores.length; i++) {
            const linha = todosOsValores[i];
            const nomeProduto = String(linha[indiceProduto] || '').trim();
            let estoqueMinimo = null;

            if (indiceEstoqueMinimo !== -1) {
                const valorEstoque = linha[indiceEstoqueMinimo];
                if (valorEstoque !== "" && valorEstoque !== null && valorEstoque !== undefined) {
                    const num = _parseNumeroPtBr(valorEstoque);
                    estoqueMinimo = isNaN(num) ? String(valorEstoque).trim() : num;
                }
            }
            if (nomeProduto) {
                mapaEstoque[nomeProduto] = estoqueMinimo;
            }
        }
    } catch (error) {
        console.error("[CRUD] Erro ao criar mapa de estoque mínimo: " + error.toString());
    }
    return mapaEstoque;
}

// --- Funções CRUD Exportadas ---

/**
 * Busca todos os produtos/linhas de uma cotação específica.
 * (Migrado de CotacaoIndividualCRUD_buscarProdutosPorIdCotacao)
 */
async function buscarProdutosPorIdCotacao(sheets, spreadsheetId, idCotacaoAlvo) {
    console.log(`[CRUD] Buscando produtos para ID '${idCotacaoAlvo}'.`);

    // 1. Inicia as buscas pelos mapas em paralelo
    const mapaEstoqueMinimoPromise = _criarMapaEstoqueMinimoProdutos(sheets, spreadsheetId);
    const mapaDemandaMediaPromise = _criarMapaDemandaMediaProdutos(sheets, spreadsheetId);

    // 2. Busca os dados principais da cotação
    const dadosCotacaoPromise = sheets.spreadsheets.values.batchGet({
        spreadsheetId: spreadsheetId,
        ranges: [ABA_COTACOES], // Busca a aba inteira
        valueRenderOption: 'UNFORMATTED_VALUE', // Pega valores brutos (datas como números seriais)
        dateTimeRenderOption: 'SERIAL_NUMBER'
    });

    const displayValuesPromise = sheets.spreadsheets.values.batchGet({
        spreadsheetId: spreadsheetId,
        ranges: [ABA_COTACOES],
        // ====================== INÍCIO DA CORREÇÃO ======================
        valueRenderOption: 'FORMATTED_VALUE' // CORRIGIDO: Era 'FORMATTED_STRING'
        // ======================= FIM DA CORREÇÃO ========================
    });

    // 3. Aguarda todas as chamadas terminarem
    const [
        mapaEstoqueMinimoProdutos,
        mapaDemandaMediaProdutos,
        dadosCotacaoResult,
        displayValuesResult
    ] = await Promise.all([
        mapaEstoqueMinimoPromise,
        mapaDemandaMediaPromise,
        dadosCotacaoPromise,
        displayValuesPromise
    ]);

    // 4. Processa os resultados
    const valores = (dadosCotacaoResult.data.valueRanges[0].values || []);
    const displays = (displayValuesResult.data.valueRanges[0].values || []);

    if (valores.length < 2) {
        console.log(`[CRUD] Aba "${ABA_COTACOES}" vazia ou só cabeçalho.`);
        return [];
    }

    const cabPlanilha = valores[0];
    const cabConst = CABECALHOS_COTACOES;
    const idxIdCotacao = cabPlanilha.indexOf('ID da Cotação');
    if (idxIdCotacao === -1) {
        console.error('[CRUD] Coluna "ID da Cotação" não encontrada.');
        return null;
    }
    const idxProdutoPrincipal = cabPlanilha.indexOf('Produto');

    const camposNumericosEsperados = [
        'Fator', 'Estoque Mínimo', 'Preço', 'Preço por Fator',
        'Comprar', 'Valor Total', 'Economia em Cotação'
    ];

    const itens = [];

    for (let i = 1; i < valores.length; i++) {
        const rowRaw = valores[i];

        // Garantia: se a linha de display não existir (ex: linhas em branco no final), usa a linha raw
        const rowDisp = displays[i] || rowRaw;

        if (String(rowRaw[idxIdCotacao] || '').trim() !== String(idCotacaoAlvo).trim()) continue;

        const item = {};
        const nomeProdutoPrincipal = (idxProdutoPrincipal !== -1) ? String(rowRaw[idxProdutoPrincipal] || '').trim() : null;

        if (nomeProdutoPrincipal) {
            item['EstoqueMinimoProdutoPrincipal'] = mapaEstoqueMinimoProdutos[nomeProdutoPrincipal] ?? null;
            item['DemandaMediaProdutoPrincipal'] = mapaDemandaMediaProdutos[nomeProdutoPrincipal] ?? null;
        } else {
            item['EstoqueMinimoProdutoPrincipal'] = null;
            item['DemandaMediaProdutoPrincipal'] = null;
        }

        cabConst.forEach(nomeCol => {
            const idx = cabPlanilha.indexOf(nomeCol);
            if (idx === -1 || idx >= rowRaw.length) {
                item[nomeCol] = null;
                return;
            }

            const valorRaw = rowRaw[idx];
            const valorDisp = (rowDisp && idx < rowDisp.length) ? rowDisp[idx] : valorRaw; // Fallback para valorDisp

            if (nomeCol === 'Data Abertura') {
                // Usa o valor formatado (display) para datas, é mais seguro que o serial
                item[nomeCol] = valorDisp || null;
                return;
            }

            if (camposNumericosEsperados.includes(nomeCol)) {
                // Tenta parsear o display value primeiro (ex: "R$ 1,23")
                let n = _parseNumeroPtBr(valorDisp);
                // Se falhar, tenta parsear o raw value (ex: 1.23)
                if (!Number.isFinite(n)) n = _parseNumeroPtBr(valorRaw);
                item[nomeCol] = Number.isFinite(n) ? n : null;
                return;
            }

            item[nomeCol] = (valorRaw !== null && valorRaw !== undefined) ? String(valorRaw).trim() : null;
        });

        if (!item._subProdutoOriginalPersistido) {
            item._subProdutoOriginalPersistido = item.SubProduto || null;
        }

        itens.push(item);
    }

    console.log(`[CRUD] ${itens.length} produtos encontrados para ID '${idCotacaoAlvo}'.`);
    return itens;
}

/**
 * Salva a edição de uma célula individual.
 * (Migrado de CotacaoIndividualCRUD_salvarEdicaoCelulaCotacao)
 */
async function salvarEdicaoCelulaCotacao(sheets, spreadsheetId, idCotacao, identificadoresLinha, colunaAlterada, novoValor) {
  console.log(`[CRUD] Salvando Célula: ID ${idCotacao}, Coluna ${colunaAlterada}, Novo Valor ${novoValor}`);
  
  // Define as colunas que disparam recálculo
  const colunasTriggerCalculo = ['Preço', 'Comprar', 'Fator'];
  
  // Define colunas que sincronizam com a aba SubProdutos
  const colunasSincronizaveis = (typeof COLUNAS_PARA_ABA_SUBPRODUTOS !== 'undefined' ? COLUNAS_PARA_ABA_SUBPRODUTOS : []) || ['SubProduto', 'Tamanho', 'UN', 'Fator'];

  const resultado = {
    success: false,
    message: 'Nenhuma alteração realizada.',
    updatedInCotacoes: false,
    updatedInSubProdutos: false,
    novoSubProdutoNomeSeAlterado: null,
    valoresCalculados: null
  };

  try {
    const dadosCot = await _getRawSheetData(sheets, spreadsheetId, ABA_COTACOES);
    if(dadosCot.length < 2) throw new Error(`Aba "${ABA_COTACOES}" está vazia.`);

    const cabecalhosCot = dadosCot[0];
    const indicesCot = cabecalhosCot.reduce((acc, c, i) => ({ ...acc, [c]: i }), {});

    // Valida se todas as colunas necessárias existem
    const colunasChave = {
      idxColunaAlteradaCot: indicesCot[colunaAlterada],
      idxIdCotacaoCot: indicesCot['ID da Cotação'],
      idxProdutoCot: indicesCot['Produto'],
      idxSubProdutoCot: indicesCot['SubProduto'],
      idxFornecedorCot: indicesCot['Fornecedor']
    };
    if (Object.values(colunasChave).some(v => v === undefined)) {
      throw new Error('Colunas essenciais (ID, Produto, SubProduto, Fornecedor, ou a coluna alterada) não encontradas na aba Cotações.');
    }

    // 1. Encontrar a linha para atualizar na aba Cotações
    let linhaEncontradaCot = -1; // 1-based (número da linha na planilha)
    let valoresLinhaAtualizada = []; // Array de valores da linha encontrada

    for (let i = 1; i < dadosCot.length; i++) { // i = 0 é cabeçalho
      const linhaAtual = dadosCot[i];
      if (
        String(linhaAtual[colunasChave.idxIdCotacaoCot] || '').trim() === String(idCotacao).trim() &&
        String(linhaAtual[colunasChave.idxProdutoCot] || '').trim() === String(identificadoresLinha.Produto).trim() &&
        String(linhaAtual[colunasChave.idxSubProdutoCot] || '').trim() === String(identificadoresLinha.SubProdutoChave).trim() &&
        String(linhaAtual[colunasChave.idxFornecedorCot] || '').trim() === String(identificadoresLinha.Fornecedor).trim()
      ) {
        linhaEncontradaCot = i + 1; // +1 porque i é 0-based para os dados, e +1 para 1-based da planilha
        valoresLinhaAtualizada = [...linhaAtual]; // Faz uma cópia
        break;
      }
    }

    if (linhaEncontradaCot === -1) {
      throw new Error('Linha não encontrada na Cotação para os identificadores fornecidos.');
    }

    // 2. Preparar a atualização da aba Cotações
    const updateRequests = [];
    valoresLinhaAtualizada[colunasChave.idxColunaAlteradaCot] = novoValor;
    resultado.updatedInCotacoes = true;
    
    if (colunaAlterada === 'SubProduto') {
      resultado.novoSubProdutoNomeSeAlterado = novoValor;
    }

    // 3. Recalcular campos dependentes (se necessário)
    if (colunasTriggerCalculo.includes(colunaAlterada)) {
      const preco = _parseNumeroPtBr(valoresLinhaAtualizada[indicesCot['Preço']]) || 0;
      const comprar = _parseNumeroPtBr(valoresLinhaAtualizada[indicesCot['Comprar']]) || 0;
      const fator = _parseNumeroPtBr(valoresLinhaAtualizada[indicesCot['Fator']]) || 0;

      const valorTotalCalculado = (preco * comprar);
      const precoPorFatorCalculado = (fator !== 0) ? (preco / fator) : 0;

      // Atualiza os valores no array que será salvo
      valoresLinhaAtualizada[indicesCot['Valor Total']] = valorTotalCalculado;
      valoresLinhaAtualizada[indicesCot['Preço por Fator']] = precoPorFatorCalculado;
      
      resultado.valoresCalculados = {
        valorTotal: valorTotalCalculado,
        precoPorFator: precoPorFatorCalculado
      };
    }
    
    // ====================== INÍCIO DA CORREÇÃO ======================
    // Lógica robusta para calcular a última coluna (ex: Z, AA, AB, etc.)
    const numColunasCot = cabecalhosCot.length;
    const ultimaColunaLetraCot = String.fromCharCode(65 + (numColunasCot - 1) % 26);
    const prefixoColunaCot = numColunasCot > 26 ? String.fromCharCode(64 + Math.floor((numColunasCot - 1) / 26)) : '';
    const rangeUpdateCotacoes = `${ABA_COTACOES}!A${linhaEncontradaCot}:${prefixoColunaCot}${ultimaColunaLetraCot}${linhaEncontradaCot}`;
    // ======================= FIM DA CORREÇÃO ========================

    updateRequests.push({
      range: rangeUpdateCotacoes,
      values: [valoresLinhaAtualizada]
    });
    
    // 4. Preparar a atualização da aba SubProdutos (se necessário)
    if (colunasSincronizaveis.includes(colunaAlterada)) {
      const dadosSub = await _getRawSheetData(sheets, spreadsheetId, ABA_SUBPRODUTOS);
      if (dadosSub.length > 1) {
        const cabecalhosSub = dadosSub[0];
        const indicesSub = cabecalhosSub.reduce((acc, c, i) => ({ ...acc, [c]: i }), {});

        const idxProdV = indicesSub['Produto Vinculado'];
        const idxSubProd = indicesSub['SubProduto'];
        const idxForn = indicesSub['Fornecedor'];
        const idxColSub = indicesSub[colunaAlterada];

        if (idxProdV !== undefined && idxSubProd !== undefined && idxColSub !== undefined) {
          for (let i = 1; i < dadosSub.length; i++) {
            const linhaSub = dadosSub[i];
            const fornecedorPlanilha = (idxForn !== undefined) ? String(linhaSub[idxForn] || '').trim() : null;

            const match = (
              String(linhaSub[idxProdV] || '').trim() === String(identificadoresLinha.Produto).trim() &&
              String(linhaSub[idxSubProd] || '').trim() === String(identificadoresLinha.SubProdutoChave).trim() &&
              (fornecedorPlanilha === null || fornecedorPlanilha === String(identificadoresLinha.Fornecedor).trim())
            );

            if (match) {
              const linhaEncontradaSub = i + 1;
              const rangeUpdateSub = `${ABA_SUBPRODUTOS}!${String.fromCharCode(65 + idxColSub)}${linhaEncontradaSub}`;
              updateRequests.push({
                range: rangeUpdateSub,
                values: [[novoValor]]
              });
              resultado.updatedInSubProdutos = true;
              break;
            }
          }
        }
      }
    }

    // 5. Executar o batch update
    if (updateRequests.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: spreadsheetId,
        resource: {
          valueInputOption: 'USER_ENTERED',
          data: updateRequests
        }
      });
      resultado.success = true;
      resultado.message = `"${colunaAlterada}" atualizado com sucesso.`;
    }

    return resultado;

  } catch (e) {
    console.error(`ERRO CRÍTICO em salvarEdicaoCelulaCotacao: ${e.toString()}`, e.stack);
    resultado.message = 'Erro ao salvar alteração da célula: ' + e.message;
    return resultado;
  }
}

/**
 * Salva um conjunto de alterações do modal de detalhes.
 * (Migrado de CotacaoIndividualCRUD_salvarEdicoesModalDetalhes)
 */
async function salvarEdicoesModalDetalhes(sheets, spreadsheetId, idCotacao, identificadoresLinha, alteracoes) {
  console.log(`[CRUD] Salvando Modal: ID ${idCotacao}, Alterações: ${JSON.stringify(alteracoes)}`);
  
  const colunasSincronizaveis = (typeof COLUNAS_PARA_ABA_SUBPRODUTOS !== 'undefined' ? COLUNAS_PARA_ABA_SUBPRODUTOS : []) || ['SubProduto', 'Tamanho', 'UN', 'Fator'];
  const resultado = {
    success: false,
    message: "Nenhuma alteração realizada.",
    novoSubProdutoNomeSeAlterado: null,
    valoresCalculados: null // Esta função também recalcula
  };

  try {
    const dadosCot = await _getRawSheetData(sheets, spreadsheetId, ABA_COTACOES);
    if(dadosCot.length < 2) throw new Error(`Aba "${ABA_COTACOES}" está vazia.`);

    const cabecalhosCot = dadosCot[0];
    const indicesCot = cabecalhosCot.reduce((acc, c, i) => ({ ...acc, [c]: i }), {});

    // 1. Encontrar a linha para atualizar na aba Cotações
    let linhaEncontradaIndex = -1; // 0-based index (referente a `dadosCot`)
    for (let i = 1; i < dadosCot.length; i++) {
      const linha = dadosCot[i];
      if (String(linha[indicesCot["ID da Cotação"]] || '').trim() === String(idCotacao).trim() &&
          String(linha[indicesCot["Produto"]] || '').trim() === String(identificadoresLinha.Produto).trim() &&
          String(linha[indicesCot["SubProduto"]] || '').trim() === String(identificadoresLinha.SubProdutoChave).trim() &&
          String(linha[indicesCot["Fornecedor"]] || '').trim() === String(identificadoresLinha.Fornecedor).trim()) {
        linhaEncontradaIndex = i; // 0-based index da linha nos DADOS TOTAIS
        break;
      }
    }

    if (linhaEncontradaIndex === -1) {
      throw new Error("Linha correspondente não encontrada na cotação para atualização.");
    }

    const valoresLinhaAtualizada = [...dadosCot[linhaEncontradaIndex]]; // Cópia dos valores da linha
    const updateRequests = [];

    // 2. Aplicar todas as alterações em memória
    for (const coluna in alteracoes) {
      if (indicesCot[coluna] !== undefined) {
        valoresLinhaAtualizada[indicesCot[coluna]] = alteracoes[coluna];
      }
    }

    // 3. Recalcular campos dependentes
    const preco = _parseNumeroPtBr(valoresLinhaAtualizada[indicesCot['Preço']]) || 0;
    const comprar = _parseNumeroPtBr(valoresLinhaAtualizada[indicesCot['Comprar']]) || 0;
    const fator = _parseNumeroPtBr(valoresLinhaAtualizada[indicesCot['Fator']]) || 0;
    
    const valorTotalCalculado = (preco * comprar);
    const precoPorFatorCalculado = (fator !== 0) ? (preco / fator) : 0;

    valoresLinhaAtualizada[indicesCot['Valor Total']] = valorTotalCalculado;
    valoresLinhaAtualizada[indicesCot['Preço por Fator']] = precoPorFatorCalculado;
    
    resultado.valoresCalculados = {
      valorTotal: valorTotalCalculado,
      precoPorFator: precoPorFatorCalculado
    };
    
    // 4. Adicionar a atualização da linha inteira da Cotação
    const linhaPlanilhaCot = linhaEncontradaIndex + 1; // 1-based
    
    // ====================== INÍCIO DA CORREÇÃO 1 ======================
    const numColunasCot = cabecalhosCot.length;
    const ultimaColunaLetraCot = String.fromCharCode(65 + (numColunasCot - 1) % 26);
    const prefixoColunaCot = numColunasCot > 26 ? String.fromCharCode(64 + Math.floor((numColunasCot - 1) / 26)) : '';
    const rangeUpdateCotacoes = `${ABA_COTACOES}!A${linhaPlanilhaCot}:${prefixoColunaCot}${ultimaColunaLetraCot}${linhaPlanilhaCot}`;
    // ======================= FIM DA CORREÇÃO 1 ========================

    updateRequests.push({
      range: rangeUpdateCotacoes,
      values: [valoresLinhaAtualizada]
    });
    resultado.updatedInCotacoes = true;
    if (alteracoes.SubProduto) {
      resultado.novoSubProdutoNomeSeAlterado = alteracoes.SubProduto;
    }

    // 5. Sincronizar com a aba SubProdutos
    const alteracoesSincronizaveis = Object.keys(alteracoes).some(k => colunasSincronizaveis.includes(k));
    if (alteracoesSincronizaveis) {
      const dadosSub = await _getRawSheetData(sheets, spreadsheetId, ABA_SUBPRODUTOS);
      if (dadosSub.length > 1) {
        const cabecalhosSub = dadosSub[0];
        const indicesSub = cabecalhosSub.reduce((acc, c, i) => ({ ...acc, [c]: i }), {});
        const idxProdV = indicesSub['Produto Vinculado'];
        const idxSubProd = indicesSub['SubProduto'];
        const idxForn = indicesSub['Fornecedor'];

        if (idxProdV !== undefined && idxSubProd !== undefined) {
          for (let i = 1; i < dadosSub.length; i++) {
            const linhaSub = dadosSub[i];
            const fornecedorPlanilha = (idxForn !== undefined) ? String(linhaSub[idxForn] || '').trim() : null;

            const match = (
              String(linhaSub[idxProdV] || '').trim() === String(identificadoresLinha.Produto).trim() &&
              String(linhaSub[idxSubProd] || '').trim() === String(identificadoresLinha.SubProdutoChave).trim() &&
              (fornecedorPlanilha === null || fornecedorPlanilha === String(identificadoresLinha.Fornecedor).trim())
            );

            if (match) {
              const linhaEncontradaSub = i + 1; // 1-based
              const valoresLinhaSubAtualizada = [...linhaSub];
              
              for (const coluna in alteracoes) {
                if (colunasSincronizaveis.includes(coluna) && indicesSub[coluna] !== undefined) {
                  valoresLinhaSubAtualizada[indicesSub[coluna]] = alteracoes[coluna];
                }
              }
              
              // ====================== INÍCIO DA CORREÇÃO 2 ======================
              const numColunasSub = cabecalhosSub.length;
              const ultimaColunaLetraSub = String.fromCharCode(65 + (numColunasSub - 1) % 26);
              const prefixoColunaSub = numColunasSub > 26 ? String.fromCharCode(64 + Math.floor((numColunasSub - 1) / 26)) : '';
              const rangeUpdateSub = `${ABA_SUBPRODUTOS}!A${linhaEncontradaSub}:${prefixoColunaSub}${ultimaColunaLetraSub}${linhaEncontradaSub}`;
              // ======================= FIM DA CORREÇÃO 2 ========================

              updateRequests.push({
                range: rangeUpdateSub,
                values: [valoresLinhaSubAtualizada]
              });
              resultado.updatedInSubProdutos = true;
              break; // Para de procurar
            }
          }
        }
      }
    }

    // 6. Executar o batch update
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: spreadsheetId,
      resource: {
        valueInputOption: 'USER_ENTERED',
        data: updateRequests
      }
    });

    resultado.success = true;
    resultado.message = "Detalhes do item atualizados com sucesso!";
    return resultado;

  } catch (e) {
    console.error(`ERRO em salvarEdicoesModalDetalhes: ${e.toString()}`, e.stack);
    resultado.message = `Erro no servidor: ${e.message}`;
    return resultado;
  }
}

/**
 * Acrescenta novos itens a uma cotação existente.
 * (Migrado de CotacaoIndividualCRUD_acrescentarItensCotacao)
 */
async function acrescentarItensCotacao(sheets, spreadsheetId, idCotacaoExistente, opcoesCriacao) {
    console.log(`[CRUD] Acrescentando itens ao ID '${idCotacaoExistente}'...`);

    try {
        const dataAbertura = new Date().toISOString();

        // 1. Busca dados de SubProdutos e Produtos em paralelo
        const subProdutosPromise = _obterDadosCompletosDaAba(sheets, spreadsheetId, ABA_SUBPRODUTOS, CABECALHOS_SUBPRODUTOS);
        const produtosPromise = _obterDadosCompletosDaAba(sheets, spreadsheetId, ABA_PRODUTOS, CABECALHOS_PRODUTOS);

        const [todosSubProdutos, todosProdutos] = await Promise.all([subProdutosPromise, produtosPromise]);

        if (!todosSubProdutos || !todosProdutos) {
            return { success: false, message: "Falha ao carregar dados de Produtos ou SubProdutos." };
        }

        const produtosMap = todosProdutos.reduce((map, prod) => {
            map[prod["Produto"]] = prod;
            return map;
        }, {});

        // 2. Filtra os SubProdutos com base nas opções
        let subProdutosFiltrados = [];
        const tipo = opcoesCriacao.tipo;
        const selecoesLowerCase = opcoesCriacao.selecoes.map(s => String(s).toLowerCase());

        if (tipo === 'categoria') {
            const nomesProdutosDaCategoria = new Set(todosProdutos
                .filter(p => p["Categoria"] && selecoesLowerCase.includes(String(p["Categoria"]).toLowerCase()))
                .map(p => String(p["Produto"]).toLowerCase()));
            subProdutosFiltrados = todosSubProdutos.filter(sp => {
                const produtoVinculado = sp["Produto Vinculado"] ? String(sp["Produto Vinculado"]).toLowerCase() : null;
                return produtoVinculado && nomesProdutosDaCategoria.has(produtoVinculado);
            });
        } else if (tipo === 'fornecedor') {
            subProdutosFiltrados = todosSubProdutos.filter(sp => {
                const fornecedorSubProduto = sp["Fornecedor"] ? String(sp["Fornecedor"]).toLowerCase() : null;
                return fornecedorSubProduto && selecoesLowerCase.includes(fornecedorSubProduto);
            });
        } else if (tipo === 'curvaABC') {
            const nomesProdutosDaCurva = new Set(todosProdutos
                .filter(p => p["ABC"] && selecoesLowerCase.includes(String(p["ABC"]).toLowerCase()))
                .map(p => String(p["Produto"]).toLowerCase()));
            subProdutosFiltrados = todosSubProdutos.filter(sp => {
                const produtoVinculado = sp["Produto Vinculado"] ? String(sp["Produto Vinculado"]).toLowerCase() : null;
                return produtoVinculado && nomesProdutosDaCurva.has(produtoVinculado);
            });
        } else if (tipo === 'produtoEspecifico') {
            subProdutosFiltrados = todosSubProdutos.filter(sp => {
                const produtoVinculado = sp["Produto Vinculado"] ? String(sp["Produto Vinculado"]).toLowerCase() : null;
                return produtoVinculado && selecoesLowerCase.includes(produtoVinculado);
            });
        } else {
            return { success: false, message: "Tipo de criação desconhecido: " + tipo };
        }

        console.log(`[CRUD] ${subProdutosFiltrados.length} subprodutos filtrados para acrescentar.`);

        if (subProdutosFiltrados.length === 0) {
            return { success: true, idCotacao: idCotacaoExistente, numItens: 0, message: "Nenhum novo subproduto encontrado para os critérios selecionados." };
        }

        // 3. Mapeia para o formato da aba Cotações
        const linhasParaAdicionar = subProdutosFiltrados.map(subProd => {
            const produtoPrincipal = produtosMap[subProd["Produto Vinculado"]];
            const estoqueMinimo = produtoPrincipal ? produtoPrincipal["Estoque Minimo"] : "";
            const nomeProdutoPrincipalParaCotacao = subProd["Produto Vinculado"];

            // Constrói o array na ordem exata de CABECALHOS_COTACOES
            return CABECALHOS_COTACOES.map(header => {
                switch (header) {
                    case "ID da Cotação": return idCotacaoExistente;
                    case "Data Abertura": return dataAbertura;
                    case "Produto": return nomeProdutoPrincipalParaCotacao;
                    case "SubProduto": return subProd["SubProduto"];
                    case "Categoria": return produtoPrincipal ? produtoPrincipal["Categoria"] : subProd["Categoria"];
                    case "Fornecedor": return subProd["Fornecedor"];
                    case "Tamanho": return subProd["Tamanho"];
                    case "UN": return subProd["UN"];
                    case "Fator": return subProd["Fator"];
                    case "Estoque Mínimo": return estoqueMinimo;
                    case "NCM": return subProd["NCM"];
                    case "CST": return subProd["CST"];
                    case "CFOP": return subProd["CFOP"];
                    case "Status da Cotação": return COTacoesCRUD_STATUS_NOVA_COTACAO;
                    default:
                        return ""; // Deixa campos calculáveis em branco
                }
            });
        });

        // 4. Adiciona as novas linhas na aba de Cotações
        await sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId,
            range: ABA_COTACOES, // Append no final da aba
            valueInputOption: 'USER_ENTERED', // Para formatar datas corretamente
            resource: {
                values: linhasParaAdicionar
            }
        });

        console.log(`[CRUD] ${linhasParaAdicionar.length} itens adicionados à cotação ${idCotacaoExistente}.`);
        return {
            success: true,
            idCotacao: idCotacaoExistente,
            numItens: linhasParaAdicionar.length,
            message: "Itens acrescentados com sucesso."
        };

    } catch (e) {
        console.error(`ERRO CRÍTICO em acrescentarItensCotacao: ${e.toString()}`, e.stack);
        return { success: false, message: "Erro no servidor ao acrescentar itens: " + e.message };
    }
}

// Exporta as funções
module.exports = {
    buscarProdutosPorIdCotacao,
    salvarEdicaoCelulaCotacao,
    salvarEdicoesModalDetalhes,
    acrescentarItensCotacao
};