// controllers/FuncoesCRUD.js
// Migrado de FuncoesCRUD.js e EtapasCRUD.js (para a função de impressão)

const {
    ID_PLANILHA_PRINCIPAL,
    ABA_PORTAL,
    CABECALHOS_PORTAL,
    STATUS_PORTAL,
    ABA_COTACOES,
    CABECALHOS_COTACOES,
    ABA_SUBPRODUTOS,
    CABECALHOS_SUBPRODUTOS,
    ABA_PRODUTOS,
    CABECALHOS_PRODUTOS,
    ABA_CADASTROS,
    CABECALHOS_CADASTROS
} = require('../config/constants');

// --- Funções Auxiliares (reutilizadas de outros CRUDs) ---

/**
 * Busca o ID de uma aba (Sheet) pelo seu nome.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha.
 * @param {string} sheetName - O nome da aba.
 * @returns {Promise<number|null>} O ID da aba.
 */
async function getSheetIdByName(sheets, spreadsheetId, sheetName) {
    try {
        const response = await sheets.spreadsheets.get({
            spreadsheetId: spreadsheetId,
        });
        const sheet = response.data.sheets.find(s => s.properties.title === sheetName);
        return sheet ? sheet.properties.sheetId : null;
    } catch (error) {
        console.error(`Erro ao buscar ID da aba '${sheetName}':`, error.message);
        throw new Error(`Erro ao buscar ID da aba '${sheetName}'.`);
    }
}

/**
 * Lê todos os dados de uma aba.
 * @param {object} sheets - O cliente da API Google Sheets autenticado.
 * @param {string} spreadsheetId - O ID da planilha.
 * @param {string} aba - O nome da aba.
 * @returns {Promise<Array<Array<string>>>} Os dados brutos (incluindo cabeçalho).
 */
async function lerAbaCompleta(sheets, spreadsheetId, aba) {
    console.log(`[FuncoesCRUD] Lendo aba: ${aba}`);
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: aba,
        });
        return response.data.values || [
            []
        ]; // Retorna [[]] se a aba estiver vazia
    } catch (error) {
        console.error(`Erro ao ler dados da aba '${aba}':`, error.message);
        throw new Error(`Erro ao ler dados da aba '${aba}'.`);
    }
}

/**
 * Converte dados da planilha (array de arrays) em objetos.
 * @param {Array<Array<string>>} data - Dados brutos (com cabeçalho).
 * @param {Array<string>} cabecalhosConst - Cabeçalhos esperados (de constants.js).
 * @returns {Array<object>} Array de objetos.
 */
function sheetDataToObjects(data, cabecalhosConst) {
    if (!data || data.length < 2) return [];
    const headersPlanilha = data[0].map(String);
    const dataRows = data.slice(1);

    return dataRows.map(row => {
        const obj = {};
        cabecalhosConst.forEach(headerConst => {
            const indexNaPlanilha = headersPlanilha.indexOf(headerConst);
            if (indexNaPlanilha !== -1) {
                obj[headerConst] = row[indexNaPlanilha];
            } else {
                obj[headerConst] = null;
            }
        });
        // Garante ID se existir
        const indexId = headersPlanilha.indexOf("ID");
        if (indexId !== -1 && !obj.ID) {
            obj.ID = row[indexId];
        }
        return obj;
    });
}

/**
 * Normaliza números em formato pt-BR ("1.234,56") ou en-US ("1234.56") para float.
 * @param {*} valor O valor da célula.
 * @returns {number} O número parseado ou NaN.
 */
function parseNumeroPtBr(valor) {
    if (valor === null || valor === undefined) return NaN;
    if (typeof valor === 'number') return Number(valor);
    if (valor instanceof Date) return NaN;

    const s = String(valor).trim();
    if (!s) return NaN;

    const normalizado = s
        .replace(/\s+/g, '')
        .replace(/\.(?=\d{3}(?:,|\.|$))/g, '') // Remove "." de milhar
        .replace(',', '.');

    const n = Number(normalizado);
    return Number.isFinite(n) ? n : NaN;
}

// --- CRUD: Gerenciar Cotações (Portal) ---

/**
 * (Migrado de FuncoesCRUD_getDadosGerenciarCotacoes)
 * Obtém dados das cotações e seus fornecedores da aba Portal.
 */
async function getDadosGerenciarCotacoes(sheets, spreadsheetId) {
    console.log("[FuncoesCRUD] getDadosGerenciarCotacoes: Iniciando.");
    const dadosPlanilha = await lerAbaCompleta(sheets, spreadsheetId, ABA_PORTAL);
    if (dadosPlanilha.length < 2) {
        return []; // Vazia ou só cabeçalho
    }

    const cabecalhos = dadosPlanilha[0].map(c => String(c).trim());
    const idxIdCotacao = cabecalhos.indexOf(CABECALHOS_PORTAL[0]); // "ID da Cotação"
    const idxFornecedor = cabecalhos.indexOf(CABECALHOS_PORTAL[1]); // "Nome Fornecedor"
    const idxTokenLink = cabecalhos.indexOf(CABECALHOS_PORTAL[2]); // "Token Acesso"
    const idxLinkAcesso = cabecalhos.indexOf(CABECALHOS_PORTAL[3]); // "Link Acesso"
    const idxStatusResposta = cabecalhos.indexOf(CABECALHOS_PORTAL[4]); // "Status"
    const idxTextoPersonalizado = cabecalhos.indexOf(CABECALHOS_PORTAL[7]); // "Texto Personalizado Link"

    if ([idxIdCotacao, idxFornecedor, idxLinkAcesso, idxStatusResposta].some(idx => idx === -1)) {
        throw new Error(`Colunas essenciais (ID, Fornecedor, Link, Status) não encontradas na aba "${ABA_PORTAL}".`);
    }

    // A URL base não é mais necessária aqui, pois o link já está na planilha
    const cotacoesAgrupadas = {};

    for (let i = 1; i < dadosPlanilha.length; i++) {
        const linha = dadosPlanilha[i];
        const idCotacao = String(linha[idxIdCotacao] || "").trim();
        if (!idCotacao) continue;

        if (!cotacoesAgrupadas[idCotacao]) {
            cotacoesAgrupadas[idCotacao] = {
                idCotacao: idCotacao,
                fornecedores: [],
                totalFornecedores: 0,
                respondidos: 0,
                textoPersonalizadoCotacao: null
            };
        }

        const fornecedorNome = String(linha[idxFornecedor] || "").trim();
        const linkCompleto = String(linha[idxLinkAcesso] || "").trim();
        const statusResposta = String(linha[idxStatusResposta] || "").trim();
        let textoPersonalizadoValor = (idxTextoPersonalizado !== -1 && linha[idxTextoPersonalizado] !== null) ?
            String(linha[idxTextoPersonalizado]) :
            "";

        if (cotacoesAgrupadas[idCotacao].textoPersonalizadoCotacao === null) {
            cotacoesAgrupadas[idCotacao].textoPersonalizadoCotacao = textoPersonalizadoValor;
        }

        cotacoesAgrupadas[idCotacao].fornecedores.push({
            nome: fornecedorNome,
            link: linkCompleto,
            statusResposta: statusResposta
        });

        cotacoesAgrupadas[idCotacao].totalFornecedores++;
        if (statusResposta.toLowerCase() === STATUS_PORTAL.RESPONDIDO.toLowerCase()) {
            cotacoesAgrupadas[idCotacao].respondidos++;
        }
    }

    return Object.values(cotacoesAgrupadas).map(cot => {
        cot.percentualRespondido = (cot.totalFornecedores > 0) ? (cot.respondidos / cot.totalFornecedores) * 100 : 0;
        return cot;
    });
}

/**
 * (Migrado de FuncoesCRUD_excluirFornecedorDaCotacaoPortal)
 * Exclui um fornecedor de uma cotação na aba Portal.
 */
async function excluirFornecedorDaCotacaoPortal(sheets, spreadsheetId, idCotacao, nomeFornecedor) {
    console.log(`[FuncoesCRUD] excluindoFornecedor: Cotação '${idCotacao}', Fornecedor '${nomeFornecedor}'.`);
    const dadosPlanilha = await lerAbaCompleta(sheets, spreadsheetId, ABA_PORTAL);
    if (dadosPlanilha.length < 2) {
        throw new Error(`Aba "${ABA_PORTAL}" está vazia.`);
    }

    const cabecalhos = dadosPlanilha[0].map(c => String(c).trim());
    const idxIdCotacao = cabecalhos.indexOf(CABECALHOS_PORTAL[0]);
    const idxFornecedor = cabecalhos.indexOf(CABECALHOS_PORTAL[1]);

    if (idxIdCotacao === -1 || idxFornecedor === -1) {
        throw new Error("Colunas chave (ID, Fornecedor) não encontradas na aba Portal.");
    }

    let linhaParaExcluirIndex = -1; // 0-based
    for (let i = 1; i < dadosPlanilha.length; i++) {
        if (String(dadosPlanilha[i][idxIdCotacao] || "").trim() === idCotacao &&
            String(dadosPlanilha[i][idxFornecedor] || "").trim() === nomeFornecedor) {
            linhaParaExcluirIndex = i;
            break;
        }
    }

    if (linhaParaExcluirIndex === -1) {
        throw new Error(`Fornecedor '${nomeFornecedor}' não encontrado na cotação '${idCotacao}' no portal.`);
    }

    const sheetId = await getSheetIdByName(sheets, spreadsheetId, ABA_PORTAL);
    const requests = [{
        deleteDimension: {
            range: {
                sheetId: sheetId,
                dimension: "ROWS",
                startIndex: linhaParaExcluirIndex, // 0-based (linha 1 é index 0)
                endIndex: linhaParaExcluirIndex + 1
            }
        }
    }];

    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId,
        resource: {
            requests: requests
        }
    });

    return {
        success: true,
        message: `Fornecedor '${nomeFornecedor}' excluído da cotação '${idCotacao}' no portal.`
    };
}

/**
 * (Migrado de FuncoesCRUD_salvarTextoGlobalCotacaoPortal)
 * Salva o texto personalizado GLOBAL para uma cotação na aba Portal.
 */
async function salvarTextoGlobalCotacaoPortal(sheets, spreadsheetId, idCotacao, textoGlobal) {
    console.log(`[FuncoesCRUD] salvandoTextoGlobal: Cotação '${idCotacao}'.`);
    const dadosPlanilha = await lerAbaCompleta(sheets, spreadsheetId, ABA_PORTAL);
    if (dadosPlanilha.length < 2) {
        return {
            success: true,
            message: "Aba Portal vazia, nada para salvar."
        };
    }

    const cabecalhos = dadosPlanilha[0].map(c => String(c).trim());
    const idxIdCotacao = cabecalhos.indexOf(CABECALHOS_PORTAL[0]);
    const idxTextoPersonalizado = cabecalhos.indexOf(CABECALHOS_PORTAL[7]); // "Texto Personalizado Link"

    if (idxIdCotacao === -1) throw new Error(`Coluna "${CABECALHOS_PORTAL[0]}" não encontrada.`);
    if (idxTextoPersonalizado === -1) throw new Error(`Coluna "${CABECALHOS_PORTAL[7]}" não encontrada.`);

    const requests = [];
    const sheetId = await getSheetIdByName(sheets, spreadsheetId, ABA_PORTAL);
    let linhasAtualizadas = 0;

    for (let i = 1; i < dadosPlanilha.length; i++) {
        if (String(dadosPlanilha[i][idxIdCotacao] || "").trim() === idCotacao) {
            requests.push({
                updateCells: {
                    rows: [{
                        values: [{
                            userEnteredValue: {
                                stringValue: textoGlobal
                            }
                        }]
                    }],
                    fields: "userEnteredValue",
                    start: {
                        sheetId: sheetId,
                        rowIndex: i, // 0-based
                        columnIndex: idxTextoPersonalizado
                    }
                }
            });
            linhasAtualizadas++;
        }
    }

    if (requests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: spreadsheetId,
            resource: {
                requests: requests
            }
        });
    }

    return {
        success: true,
        message: `Texto global salvo para ${linhasAtualizadas} fornecedor(es) da Cotação '${idCotacao}'.`
    };
}

// --- CRUD: Preencher Últimos Preços ---

/**
 * (Migrado de FuncoesCRUD_preencherUltimosPrecos)
 * Preenche os últimos preços em uma cotação.
 */
async function preencherUltimosPrecos(sheets, spreadsheetId, idCotacaoAlvo) {
    console.log(`[FuncoesCRUD] preencherUltimosPrecos: Iniciando para ID '${idCotacaoAlvo}'.`);
    const dadosPlanilha = await lerAbaCompleta(sheets, spreadsheetId, ABA_COTACOES);
    if (dadosPlanilha.length < 2) {
        return {
            success: true,
            numItens: 0,
            message: "Aba Cotações vazia."
        };
    }

    const cabecalhos = dadosPlanilha[0].map(String);
    const indices = {
        idCotacao: cabecalhos.indexOf("ID da Cotação"),
        subProduto: cabecalhos.indexOf("SubProduto"),
        fornecedor: cabecalhos.indexOf("Fornecedor"),
        preco: cabecalhos.indexOf("Preço"),
        tamanho: cabecalhos.indexOf("Tamanho"),
        un: cabecalhos.indexOf("UN"),
        fator: cabecalhos.indexOf("Fator"),
        comprar: cabecalhos.indexOf("Comprar"),
        valorTotal: cabecalhos.indexOf("Valor Total"),
        precoPorFator: cabecalhos.indexOf("Preço por Fator"),
    };

    if (Object.values(indices).some(idx => idx === -1)) {
        throw new Error("Uma ou mais colunas essenciais (ID, SubProduto, Fornecedor, Preço, etc.) não foram encontradas na aba 'Cotacoes'.");
    }

    const ultimosDadosMap = {};
    // 1. Construir mapa de últimos dados (de baixo para cima)
    for (let i = dadosPlanilha.length - 1; i > 0; i--) { // i > 0 para pular cabeçalho
        const linha = dadosPlanilha[i];
        if (String(linha[indices.idCotacao] || "").trim() === idCotacaoAlvo) continue;

        const subProduto = String(linha[indices.subProduto] || "").trim();
        const fornecedor = String(linha[indices.fornecedor] || "").trim();
        const preco = parseNumeroPtBr(linha[indices.preco]);

        if (subProduto && fornecedor) {
            const chave = `${subProduto}__${fornecedor}`;
            if (!ultimosDadosMap.hasOwnProperty(chave) && Number.isFinite(preco) && preco > 0) {
                ultimosDadosMap[chave] = {
                    preco: preco,
                    tamanho: linha[indices.tamanho],
                    un: linha[indices.un],
                    fator: linha[indices.fator]
                };
            }
        }
    }
    console.log(`[FuncoesCRUD] Mapa de dados históricos construído com ${Object.keys(ultimosDadosMap).length} entradas.`);

    // 2. Aplicar dados na cotação alvo
    const requests = [];
    const sheetId = await getSheetIdByName(sheets, spreadsheetId, ABA_COTACOES);
    let itensAtualizadosCount = 0;

    for (let i = 1; i < dadosPlanilha.length; i++) {
        const linha = dadosPlanilha[i];
        if (String(linha[indices.idCotacao] || "").trim() === idCotacaoAlvo) {
            const precoAtual = parseNumeroPtBr(linha[indices.preco]);

            if (!Number.isFinite(precoAtual) || precoAtual === 0) {
                const subProduto = String(linha[indices.subProduto] || "").trim();
                const fornecedor = String(linha[indices.fornecedor] || "").trim();
                const chave = `${subProduto}__${fornecedor}`;

                if (ultimosDadosMap.hasOwnProperty(chave)) {
                    const dadosHistoricos = ultimosDadosMap[chave];
                    const preco = dadosHistoricos.preco || 0;
                    const comprar = parseNumeroPtBr(linha[indices.comprar]) || 0;
                    const fator = parseNumeroPtBr(dadosHistoricos.fator) || 0;
                    const valorTotalCalculado = preco * comprar;
                    const precoPorFatorCalculado = (fator !== 0) ? (preco / fator) : 0;

                    // Adiciona requests para atualizar todas as colunas relevantes
                    requests.push({
                        updateCells: {
                            rows: [{
                                values: [
                                    { userEnteredValue: { numberValue: preco } }, // Preço
                                    { userEnteredValue: { stringValue: dadosHistoricos.tamanho } }, // Tamanho
                                    { userEnteredValue: { stringValue: dadosHistoricos.un } }, // UN
                                    { userEnteredValue: { numberValue: fator } }, // Fator
                                    { userEnteredValue: { numberValue: valorTotalCalculado } }, // Valor Total
                                    { userEnteredValue: { numberValue: precoPorFatorCalculado } } // Preço por Fator
                                ]
                            }],
                            fields: "userEnteredValue",
                            start: {
                                sheetId: sheetId,
                                rowIndex: i, // 0-based
                                columnIndex: indices.preco // Começa na coluna Preço
                            }
                        }
                    });
                    // NOTA: Esta implementação assume que as colunas (Preço, Tamanho, UN, Fator, Valor Total, Preço por Fator)
                    // estão em uma sequência específica na planilha.
                    // Se não estiverem, esta lógica de batchUpdate falhará.
                    // A lógica original (FuncoesCRUD.js) atualizava uma por uma, o que é mais seguro
                    // se a ordem não for garantida, mas é muito mais lento.
                    // Para esta migração, vou assumir que a lógica de batch é arriscada e
                    // vou reverter para atualizações individuais (mais lento, porém mais seguro).

                    // Lógica mais segura (uma a uma, como no original):
                    // await sheets.spreadsheets.values.update({
                    //     spreadsheetId, range: `${ABA_COTACOES}!${String.fromCharCode(65 + indices.preco)}${i + 1}`,
                    //     valueInputOption: 'USER_ENTERED', resource: { values: [[dadosHistoricos.preco]] }
                    // });
                    // ... (e assim por diante para cada coluna)
                    // Pela simplicidade da migração, manterei a lógica de batch,
                    // mas adiciono esta nota de risco.

                    itensAtualizadosCount++;
                }
            }
        }
    }

    // A lógica de batch update acima está incorreta porque as colunas NÃO SÃO CONTÍGUAS.
    // Vamos corrigir para enviar múltiplos requests individuais dentro do batchUpdate.
    const requestsCorrigidos = [];
    for (let i = 1; i < dadosPlanilha.length; i++) {
        const linha = dadosPlanilha[i];
        if (String(linha[indices.idCotacao] || "").trim() === idCotacaoAlvo) {
            const precoAtual = parseNumeroPtBr(linha[indices.preco]);
            if (!Number.isFinite(precoAtual) || precoAtual === 0) {
                const subProduto = String(linha[indices.subProduto] || "").trim();
                const fornecedor = String(linha[indices.fornecedor] || "").trim();
                const chave = `${subProduto}__${fornecedor}`;

                if (ultimosDadosMap.hasOwnProperty(chave)) {
                    const dadosHistoricos = ultimosDadosMap[chave];
                    const preco = dadosHistoricos.preco || 0;
                    const comprar = parseNumeroPtBr(linha[indices.comprar]) || 0;
                    const fator = parseNumeroPtBr(dadosHistoricos.fator) || 0;
                    const valorTotalCalculado = preco * comprar;
                    const precoPorFatorCalculado = (fator !== 0) ? (preco / fator) : 0;

                    // Criar um request para cada célula
                    const rowIndex = i; // 0-based
                    requestsCorrigidos.push(
                        { updateCells: { rows: [{ values: [{ userEnteredValue: { numberValue: preco } }] }], fields: "userEnteredValue", start: { sheetId, rowIndex, columnIndex: indices.preco } } },
                        { updateCells: { rows: [{ values: [{ userEnteredValue: { stringValue: dadosHistoricos.tamanho } }] }], fields: "userEnteredValue", start: { sheetId, rowIndex, columnIndex: indices.tamanho } } },
                        { updateCells: { rows: [{ values: [{ userEnteredValue: { stringValue: dadosHistoricos.un } }] }], fields: "userEnteredValue", start: { sheetId, rowIndex, columnIndex: indices.un } } },
                        { updateCells: { rows: [{ values: [{ userEnteredValue: { numberValue: fator } }] }], fields: "userEnteredValue", start: { sheetId, rowIndex, columnIndex: indices.fator } } },
                        { updateCells: { rows: [{ values: [{ userEnteredValue: { numberValue: valorTotalCalculado } }] }], fields: "userEnteredValue", start: { sheetId, rowIndex, columnIndex: indices.valorTotal } } },
                        { updateCells: { rows: [{ values: [{ userEnteredValue: { numberValue: precoPorFatorCalculado } }] }], fields: "userEnteredValue", start: { sheetId, rowIndex, columnIndex: indices.precoPorFator } } }
                    );
                    itensAtualizadosCount++;
                }
            }
        }
    }

    if (requestsCorrigidos.length > 0) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: spreadsheetId,
            resource: {
                requests: requestsCorrigidos
            }
        });
        console.log(`[FuncoesCRUD] Preços preenchidos para ${itensAtualizadosCount} itens.`);
    }

    return {
        success: true,
        numItens: itensAtualizadosCount,
        message: itensAtualizadosCount > 0 ?
            `Dados de ${itensAtualizadosCount} item(ns) foram atualizados.` :
            "Nenhum dado a ser atualizado foi encontrado no histórico."
    };
}


// --- CRUD: Geração de Dados para Impressão ---

/**
 * (Reimplementação de EtapasCRUD_buscarDadosAgrupadosParaImpressao)
 * Busca dados na aba 'Cotações' e 'Cadastros' e agrupa os resultados por Fornecedor.
 * Esta função é a fonte de dados para a impressão no cliente.
 */
async function obterDadosParaImpressaoManual(sheets, spreadsheetId, idCotacaoAlvo) {
    console.log(`[FuncoesCRUD] obterDadosParaImpressaoManual: ID '${idCotacaoAlvo}'.`);

    // 1. Mapear CNPJs da aba Cadastros
    const dadosCadastros = await lerAbaCompleta(sheets, spreadsheetId, ABA_CADASTROS);
    const mapaCnpj = {};
    if (dadosCadastros.length > 1) {
        const cabecalhosCadastros = dadosCadastros[0].map(String);
        const colEmpresaCad = cabecalhosCadastros.indexOf(CABECALHOS_CADASTROS[0]); // "Empresas"
        const colCnpjCad = cabecalhosCadastros.indexOf(CABECALHOS_CADASTROS[1]); // "CNPJ"
        if (colEmpresaCad > -1 && colCnpjCad > -1) {
            dadosCadastros.slice(1).forEach(linha => {
                if (linha[colEmpresaCad]) {
                    mapaCnpj[linha[colEmpresaCad].toString().trim()] = linha[colCnpjCad] || 'Não informado';
                }
            });
        }
    }

    // 2. Processar a aba de Cotações
    const dadosCotacoes = await lerAbaCompleta(sheets, spreadsheetId, ABA_COTACOES);
    if (dadosCotacoes.length < 2) {
        return {}; // Sem dados
    }
    const cabecalhosCotacoes = dadosCotacoes[0].map(String);
    const colMap = {
        id: cabecalhosCotacoes.indexOf("ID da Cotação"),
        empresa: cabecalhosCotacoes.indexOf("Empresa Faturada"),
        condicao: cabecalhosCotacoes.indexOf("Condição de Pagamento"),
        fornecedor: cabecalhosCotacoes.indexOf("Fornecedor"),
        subProduto: cabecalhosCotacoes.indexOf("SubProduto"),
        un: cabecalhosCotacoes.indexOf("UN"),
        comprar: cabecalhosCotacoes.indexOf("Comprar"),
        preco: cabecalhosCotacoes.indexOf("Preço"),
        valorTotal: cabecalhosCotacoes.indexOf("Valor Total")
    };
    if (Object.values(colMap).some(idx => idx === -1)) {
        throw new Error(`Colunas obrigatórias não encontradas na aba ${ABA_COTACOES}.`);
    }

    const pedidosTemporarios = {};
    // 3. Filtrar e agrupar
    dadosCotacoes.slice(1).forEach(linha => {
        const idLinha = linha[colMap.id];
        const comprarQtd = parseNumeroPtBr(linha[colMap.comprar]);

        if (String(idLinha) === String(idCotacaoAlvo) && Number.isFinite(comprarQtd) && comprarQtd > 0) {
            const nomeEmpresa = linha[colMap.empresa];
            if (!nomeEmpresa) return;

            const nomeFornecedor = linha[colMap.fornecedor];
            const chaveUnica = `${nomeFornecedor}__${nomeEmpresa}`;

            if (!pedidosTemporarios[chaveUnica]) {
                pedidosTemporarios[chaveUnica] = {
                    fornecedor: nomeFornecedor,
                    empresaFaturada: nomeEmpresa,
                    cnpj: mapaCnpj[nomeEmpresa.trim()] || 'Não informado',
                    condicaoPagamento: linha[colMap.condicao] || 'Não informada',
                    itens: [],
                    totalPedido: 0
                };
            }

            const precoUnit = parseNumeroPtBr(linha[colMap.preco]);
            const valorTotal = parseNumeroPtBr(linha[colMap.valorTotal]); // Usa o valor já calculado

            const item = {
                subProduto: linha[colMap.subProduto],
                un: linha[colMap.un],
                qtd: comprarQtd,
                valorUnit: precoUnit,
                valorTotal: valorTotal
            };
            pedidosTemporarios[chaveUnica].itens.push(item);
            pedidosTemporarios[chaveUnica].totalPedido += valorTotal;
        }
    });

    // 4. Estruturar o resultado final agrupado por Fornecedor
    const dadosFinaisAgrupados = {};
    for (const chave in pedidosTemporarios) {
        const pedido = pedidosTemporarios[chave];
        const fornecedor = pedido.fornecedor;
        if (!dadosFinaisAgrupados[fornecedor]) {
            dadosFinaisAgrupados[fornecedor] = [];
        }
        dadosFinaisAgrupados[fornecedor].push(pedido);
    }

    console.log(`[FuncoesCRUD] obterDadosParaImpressaoManual: ${Object.keys(dadosFinaisAgrupados).length} fornecedores encontrados.`);
    return dadosFinaisAgrupados;
}


// Exporta as funções
module.exports = {
    getDadosGerenciarCotacoes,
    excluirFornecedorDaCotacaoPortal,
    salvarTextoGlobalCotacaoPortal,
    preencherUltimosPrecos,
    obterDadosParaImpressaoManual,
    // Exporta helpers que podem ser usados por outros CRUDs se necessário
    lerAbaCompleta,
    getSheetIdByName,
    sheetDataToObjects,
    parseNumeroPtBr
};