/**
 * @file Controllers/NotasFiscaisCRUD.js
 * @description CRUD migrado para Node.js utilizando googleapis.
 */

const {
    ABA_NF_NOTAS_FISCAIS,
    ABA_NF_TRIBUTOS_TOTAIS,
    ABA_NF_FATURAS,
    ABA_FINANCEIRO_CONTAS_A_PAGAR,
    ABA_COTACOES,
    CABECALHOS_FINANCEIRO_CONTAS_A_PAGAR
} = require('../Config/constants');

/**
 * Função auxiliar para converter dados da planilha (Array de Arrays) em Array de Objetos.
 */
function NotasFiscaisCRUD_sheetDataToObjects(data, headers) {
    if (!data || data.length === 0) return [];
    // Se headers não for passado, assume a primeira linha
    const keys = headers || data[0];
    const rows = headers ? data : data.slice(1);

    return rows.map(row => {
        const obj = {};
        keys.forEach((key, index) => {
            obj[key] = row[index] !== undefined ? row[index] : '';
        });
        return obj;
    });
}

/**
 * Obtém todas as notas fiscais, aplicando filtros em memória (Node.js é rápido o suficiente para isso).
 */
async function NotasFiscaisCRUD_obterTodasAsNotas(sheets, spreadsheetId, filtros = {}) {
    // 1. Busca dados das Notas Fiscais
    const resNF = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: ABA_NF_NOTAS_FISCAIS,
        valueRenderOption: 'UNFORMATTED_VALUE', // Para datas e números virem brutos
        dateTimeRenderOption: 'FORMATTED_STRING' // Datas como string para facilitar
    });

    const rowsNF = resNF.data.values;
    if (!rowsNF || rowsNF.length < 2) return [];
    const headersNF = rowsNF[0];
    const dadosNF = NotasFiscaisCRUD_sheetDataToObjects(rowsNF);

    // 2. Busca Tributos (Opcional - para Valor Total)
    let mapaValoresTotais = {};
    try {
        const resTrib = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: ABA_NF_TRIBUTOS_TOTAIS,
            valueRenderOption: 'UNFORMATTED_VALUE'
        });
        const rowsTrib = resTrib.data.values;
        if (rowsTrib && rowsTrib.length > 1) {
            const headersTrib = rowsTrib[0];
            const idxChave = headersTrib.indexOf('Chave de Acesso');
            const idxValor = headersTrib.indexOf('Valor Total da NF');
            if (idxChave > -1 && idxValor > -1) {
                rowsTrib.slice(1).forEach(r => {
                    mapaValoresTotais[r[idxChave]] = r[idxValor] || 0;
                });
            }
        }
    } catch (e) {
        console.warn("Aba TributosTotais não encontrada ou vazia.");
    }

    // 3. Busca Faturas (Opcional - para contagem)
    let mapaContagemFaturas = {};
    try {
        const resFat = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: ABA_NF_FATURAS
        });
        const rowsFat = resFat.data.values;
        if (rowsFat && rowsFat.length > 1) {
            const headersFat = rowsFat[0];
            const idxChave = headersFat.indexOf('Chave de Acesso');
            if (idxChave > -1) {
                rowsFat.slice(1).forEach(r => {
                    const k = r[idxChave];
                    if (k) mapaContagemFaturas[k] = (mapaContagemFaturas[k] || 0) + 1;
                });
            }
        }
    } catch (e) {
        console.warn("Aba Faturas não encontrada ou vazia.");
    }

    // Filtros
    const dataInicio = filtros.dataInicio ? new Date(filtros.dataInicio) : null;
    const dataFim = filtros.dataFim ? new Date(filtros.dataFim) : null;
    if (dataFim) dataFim.setHours(23, 59, 59, 999);
    const busca = filtros.busca ? String(filtros.busca).toLowerCase() : null;
    const fornecedorFiltro = filtros.fornecedor ? String(filtros.fornecedor).toLowerCase() : null;

    const resultados = [];

    for (const nf of dadosNF) {
        // Parse Data Emissão (Formato esperado YYYY-MM-DD ou DD/MM/YYYY vindo do Sheets)
        let dataEmissao = null;
        if (nf['Data e Hora Emissão']) {
            // Tenta criar data. Se vier do Sheets como string formatada
            dataEmissao = new Date(nf['Data e Hora Emissão']);
        }

        // Filtro Data
        if (dataInicio && dataEmissao && dataEmissao < dataInicio) continue;
        if (dataFim && dataEmissao && dataEmissao > dataFim) continue;

        // Filtro Status
        if (filtros.status && nf['Status da Conciliação'] !== filtros.status) continue;

        // Filtro Busca Textual
        if (busca) {
            const termo = busca;
            const match = (
                String(nf['Nome Emitente'] || '').toLowerCase().includes(termo) ||
                String(nf['Número NF'] || '').toLowerCase().includes(termo) ||
                String(nf['CNPJ Emitente'] || '').toLowerCase().includes(termo) ||
                String(nf['Chave de Acesso'] || '').toLowerCase().includes(termo)
            );
            if (!match) continue;
        }

        // Filtro Fornecedor
        if (fornecedorFiltro) {
            if (!String(nf['Nome Emitente'] || '').toLowerCase().includes(fornecedorFiltro)) continue;
        }

        resultados.push({
            chaveAcesso: nf['Chave de Acesso'],
            numeroNF: nf['Número NF'],
            nomeEmitente: nf['Nome Emitente'],
            cnpjEmitente: nf['CNPJ Emitente'],
            dataEmissao: dataEmissao ? dataEmissao.toLocaleDateString('pt-BR') : '',
            statusConciliacao: nf['Status da Conciliação'] || '',
            valorTotalNF: mapaValoresTotais[nf['Chave de Acesso']] || 0,
            faturasCount: mapaContagemFaturas[nf['Chave de Acesso']] || 0
        });

        if (resultados.length >= 200) break; // Limite de segurança
    }

    return resultados;
}

/**
 * Reseta o status de uma NF para 'Pendente', 'Status do Rateio' para 'Pendente' e limpa 'ID da Cotação'.
 */
async function NotasFiscaisCRUD_resetarStatusNF(sheets, spreadsheetId, chaveAcesso) {
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: ABA_NF_NOTAS_FISCAIS
    });
    const rows = res.data.values;
    if (!rows || rows.length < 2) throw new Error('Planilha de NF vazia ou sem cabeçalhos.');

    const headers = rows[0];
    const idxChave = headers.indexOf("Chave de Acesso");
    const idxStatusConc = headers.indexOf("Status da Conciliação");
    const idxStatusRateio = headers.indexOf("Status do Rateio");
    const idxIdCotacao = headers.indexOf("ID da Cotação (Sistema)");

    if (idxChave === -1) throw new Error('Coluna Chave de Acesso não encontrada.');

    // Encontrar a linha (1-based para API do Sheets)
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][idxChave]).trim() === String(chaveAcesso).trim()) {
            rowIndex = i + 1;
            break;
        }
    }

    if (rowIndex === -1) throw new Error(`NF com chave ${chaveAcesso} não encontrada.`);

    // Montar updates
    const updates = [];
    if (idxStatusConc > -1) {
        updates.push({ range: `${ABA_NF_NOTAS_FISCAIS}!${String.fromCharCode(65 + idxStatusConc)}${rowIndex}`, values: [['Pendente']] });
    }
    if (idxStatusRateio > -1) {
        updates.push({ range: `${ABA_NF_NOTAS_FISCAIS}!${String.fromCharCode(65 + idxStatusRateio)}${rowIndex}`, values: [['Pendente']] });
    }
    if (idxIdCotacao > -1) {
        updates.push({ range: `${ABA_NF_NOTAS_FISCAIS}!${String.fromCharCode(65 + idxIdCotacao)}${rowIndex}`, values: [['']] });
    }

    await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        resource: {
            valueInputOption: 'USER_ENTERED',
            data: updates
        }
    });
}

/**
 * Exclui todas as linhas de Contas a Pagar associadas a uma chave de acesso.
 * Usa batchUpdate deleteDimension para remover as linhas fisicamente.
 */
async function NotasFiscaisCRUD_excluirContasAPagarPorChave(sheets, spreadsheetId, chaveAcesso) {
    // 1. Obter ID da aba ContasAPagar
    const ssInfo = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = ssInfo.data.sheets.find(s => s.properties.title === ABA_FINANCEIRO_CONTAS_A_PAGAR);
    if (!sheet) return; // Aba não existe, nada a fazer.
    const sheetId = sheet.properties.sheetId;

    // 2. Ler dados para encontrar índices
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: ABA_FINANCEIRO_CONTAS_A_PAGAR
    });
    const rows = res.data.values;
    if (!rows || rows.length < 2) return;

    const idxChave = rows[0].indexOf("Chave de Acesso");
    if (idxChave === -1) return;

    // 3. Coletar índices para exclusão (de trás para frente para não afetar índices)
    const requests = [];
    // Importante: deleteDimension remove indices. Devemos agrupar intervalos ou deletar um por um com cuidado.
    // A estratégia mais segura aqui: Encontrar os índices originais e deletar de baixo para cima.
    
    const indicesParaDeletar = [];
    for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][idxChave]).trim() === String(chaveAcesso).trim()) {
            indicesParaDeletar.push(i); // Índice 0-based relativo ao array, que corresponde ao índice da linha na API (0-based)
        }
    }

    indicesParaDeletar.sort((a, b) => b - a); // Decrescente

    indicesParaDeletar.forEach(idx => {
        requests.push({
            deleteDimension: {
                range: {
                    sheetId: sheetId,
                    dimension: "ROWS",
                    startIndex: idx,
                    endIndex: idx + 1
                }
            }
        });
    });

    if (requests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: { requests }
        });
    }
}

/**
 * Limpa dados nas cotações associados ao número da nota.
 * Campos: "Status do SubProduto", "Quantidade Recebida", "Divergencia da Nota", "Quantidade na Nota", "Preço da Nota".
 */
async function NotasFiscaisCRUD_limparDadosCotacoesPorNumeroNota(sheets, spreadsheetId, numeroNF) {
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: ABA_COTACOES
    });
    const rows = res.data.values;
    if (!rows || rows.length < 2) return;

    const headers = rows[0].map(h => String(h).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim());
    
    // Helper para achar coluna
    const findCol = (termos) => headers.findIndex(h => termos.includes(h));

    const idxNumNota = findCol(['numero da nota', 'numero nf', 'nº nf']);
    if (idxNumNota === -1) return; // Não tem coluna de número da nota

    // Colunas alvo para limpar
    const colsAlvo = [
        findCol(['status do subproduto']),
        findCol(['quantidade recebida']),
        findCol(['divergencia da nota', 'divergencia']),
        findCol(['quantidade na nota']),
        findCol(['preco da nota', 'preco nota'])
    ].filter(idx => idx !== -1);

    if (colsAlvo.length === 0) return;

    const dataUpdates = [];
    const numeroNFStr = String(numeroNF).trim();

    for (let i = 1; i < rows.length; i++) {
        const valNota = String(rows[i][idxNumNota] || '').trim();
        if (valNota === numeroNFStr) {
            const rowNum = i + 1;
            colsAlvo.forEach(colIdx => {
                dataUpdates.push({
                    range: `${ABA_COTACOES}!${String.fromCharCode(65 + colIdx)}${rowNum}`,
                    values: [['']]
                });
            });
        }
    }

    if (dataUpdates.length > 0) {
        // O limite de requests no batchUpdate é alto, mas se for muito grande pode falhar.
        // Para simplificar, vamos mandar tudo.
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            resource: {
                valueInputOption: 'USER_ENTERED',
                data: dataUpdates
            }
        });
    }
}

/**
 * Atualiza o Status da Cotação baseado no Número da Nota.
 */
async function NotasFiscaisCRUD_atualizarStatusCotacoesPorNumeroNota(sheets, spreadsheetId, numeroNF, novoStatus) {
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: ABA_COTACOES
    });
    const rows = res.data.values;
    if (!rows || rows.length < 2) return;

    const headers = rows[0].map(h => String(h).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim());
    
    const idxNumNota = headers.findIndex(h => ['numero da nota', 'numero nf'].includes(h));
    const idxStatus = headers.findIndex(h => ['status da cotacao', 'status'].includes(h));

    if (idxNumNota === -1 || idxStatus === -1) return;

    const dataUpdates = [];
    const numeroNFStr = String(numeroNF).trim();

    for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][idxNumNota] || '').trim() === numeroNFStr) {
            const rowNum = i + 1;
            dataUpdates.push({
                range: `${ABA_COTACOES}!${String.fromCharCode(65 + idxStatus)}${rowNum}`,
                values: [[novoStatus]]
            });
        }
    }

    if (dataUpdates.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            resource: {
                valueInputOption: 'USER_ENTERED',
                data: dataUpdates
            }
        });
    }
}

/**
 * Obtém faturas e contas a pagar de uma NF.
 */
async function NotasFiscaisCRUD_obterResumoFinanceiroDaNF(sheets, idPlanilhaNF, idPlanilhaFin, chaveAcesso) {
    // 1. Faturas (na planilha de NF)
    let faturas = [];
    try {
        const resFat = await sheets.spreadsheets.values.get({
            spreadsheetId: idPlanilhaNF,
            range: ABA_NF_FATURAS
        });
        const rowsFat = resFat.data.values;
        if (rowsFat && rowsFat.length > 1) {
            const headers = rowsFat[0];
            const dados = NotasFiscaisCRUD_sheetDataToObjects(rowsFat, headers);
            faturas = dados.filter(d => String(d['Chave de Acesso']) === String(chaveAcesso));
        }
    } catch (e) { console.warn("Erro ao ler Faturas", e.message); }

    // 2. Contas a Pagar (na planilha Financeira)
    let contasAPagar = [];
    try {
        const resCap = await sheets.spreadsheets.values.get({
            spreadsheetId: idPlanilhaFin,
            range: ABA_FINANCEIRO_CONTAS_A_PAGAR
        });
        const rowsCap = resCap.data.values;
        if (rowsCap && rowsCap.length > 1) {
            const headers = rowsCap[0];
            const dados = NotasFiscaisCRUD_sheetDataToObjects(rowsCap, headers);
            contasAPagar = dados.filter(d => String(d['Chave de Acesso']) === String(chaveAcesso));
        }
    } catch (e) { console.warn("Erro ao ler Contas a Pagar", e.message); }

    return { faturas, contasAPagar };
}

/**
 * Substitui Faturas: Apaga as antigas dessa chave e insere novas.
 */
async function NotasFiscaisCRUD_substituirFaturasDaNF(sheets, spreadsheetId, chaveAcesso, novasFaturas) {
    // 1. Ler tudo para identificar linhas a excluir
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: ABA_NF_FATURAS });
    const rows = res.data.values;
    if (!rows) return; // Criar aba se não existir? Assumimos que existe.
    
    const ssInfo = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetId = ssInfo.data.sheets.find(s => s.properties.title === ABA_NF_FATURAS).properties.sheetId;

    const idxChave = rows[0].indexOf("Chave de Acesso");
    const requests = [];
    const indicesExcluir = [];

    // Identifica linhas
    for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][idxChave]) === String(chaveAcesso)) {
            indicesExcluir.push(i);
        }
    }
    indicesExcluir.sort((a, b) => b - a);

    // Request de Exclusão
    indicesExcluir.forEach(idx => {
        requests.push({
            deleteDimension: {
                range: { sheetId, dimension: "ROWS", startIndex: idx, endIndex: idx + 1 }
            }
        });
    });

    // Executa exclusão
    if (requests.length > 0) {
        await sheets.spreadsheets.batchUpdate({ spreadsheetId, resource: { requests } });
    }

    // 2. Inserir Novas
    if (novasFaturas && novasFaturas.length > 0) {
        const cabecalhos = rows[0]; // Usa os cabeçalhos existentes
        const values = novasFaturas.map(fat => {
            return cabecalhos.map(col => fat[col] !== undefined ? fat[col] : '');
        });

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: ABA_NF_FATURAS,
            valueInputOption: 'USER_ENTERED',
            resource: { values }
        });
    }
}

/**
 * Substitui Contas a Pagar: Apaga as antigas e insere novas.
 */
async function NotasFiscaisCRUD_substituirContasAPagarDaNF(sheets, spreadsheetId, chaveAcesso, novasLinhas) {
    // Lógica idêntica à de Faturas, mas na aba ContasAPagar e usando CABECALHOS_FINANCEIRO_CONTAS_A_PAGAR
    
    // 1. Identificar e Excluir
    await NotasFiscaisCRUD_excluirContasAPagarPorChave(sheets, spreadsheetId, chaveAcesso);

    // 2. Inserir Novas
    if (novasLinhas && novasLinhas.length > 0) {
        // Precisamos garantir a ordem correta das colunas baseada na constante, 
        // pois a exclusão pode ter deixado a planilha vazia de dados (mas com cabeçalhos)
        const values = novasLinhas.map(linha => {
            return CABECALHOS_FINANCEIRO_CONTAS_A_PAGAR.map(col => {
                let val = linha[col];
                if (col === 'Valor da Parcela' || col === 'Valor por Setor') {
                    // Garante formato numérico se vier string com virgula
                    if (typeof val === 'string') val = parseFloat(val.replace(',', '.'));
                }
                return val !== undefined ? val : '';
            });
        });

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: ABA_FINANCEIRO_CONTAS_A_PAGAR,
            valueInputOption: 'USER_ENTERED',
            resource: { values }
        });
    }
}

module.exports = {
    NotasFiscaisCRUD_obterTodasAsNotas,
    NotasFiscaisCRUD_resetarStatusNF,
    NotasFiscaisCRUD_excluirContasAPagarPorChave,
    NotasFiscaisCRUD_limparDadosCotacoesPorNumeroNota,
    NotasFiscaisCRUD_atualizarStatusCotacoesPorNumeroNota,
    NotasFiscaisCRUD_obterResumoFinanceiroDaNF,
    NotasFiscaisCRUD_substituirFaturasDaNF,
    NotasFiscaisCRUD_substituirContasAPagarDaNF
};