/**
 * @file Controllers/NotasFiscaisController.js
 * @description Controller para o módulo de gerenciamento de Notas Fiscais.
 */

const crud = require('./NotasFiscaisCRUD');
// Importamos o CRUD de conciliação se precisarmos de alguma função específica compartilhada,
// mas tentaremos manter independente usando o NotasFiscaisCRUD recém criado.

/**
 * Lista todas as notas fiscais com filtros.
 * GET /api/notasfiscais/listar
 */
async function NotasFiscaisController_listarNotas(req, res) {
    try {
        const filtros = req.query; // Express coloca query params aqui
        const dados = await crud.NotasFiscaisCRUD_obterTodasAsNotas(req.sheets, req.ID_PLANILHA_NF, filtros);
        res.json({ success: true, dados });
    } catch (e) {
        console.error('Erro ao listar notas:', e);
        res.status(500).json({ success: false, message: e.message });
    }
}

/**
 * Desfaz a conciliação de uma NF.
 * Executa operações sequenciais críticas para garantir integridade.
 * POST /api/notasfiscais/desfazer-conciliacao
 * Body: { chaveAcesso, numeroNF }
 */
async function NotasFiscaisController_desfazerConciliacao(req, res) {
    const { chaveAcesso, numeroNF } = req.body;

    if (!chaveAcesso || !numeroNF) {
        return res.status(400).json({ success: false, message: 'Chave de Acesso e Número da NF são obrigatórios.' });
    }

    console.log(`[NotasFiscais] Iniciando desfazer conciliação. Chave: ${chaveAcesso}, NF: ${numeroNF}`);

    try {
        // 1. Remove Contas a Pagar (Financeiro)
        // Usamos o ID_PLANILHA_FINANCEIRO aqui
        await crud.NotasFiscaisCRUD_excluirContasAPagarPorChave(req.sheets, req.ID_PLANILHA_FINANCEIRO, chaveAcesso);
        console.log(`[NotasFiscais] Contas a pagar excluídas.`);

        // 2. Limpa campos da aba Cotações (Planilha Principal)
        await crud.NotasFiscaisCRUD_limparDadosCotacoesPorNumeroNota(req.sheets, req.ID_PLANILHA_PRINCIPAL, numeroNF);
        console.log(`[NotasFiscais] Dados da cotação limpos.`);

        // 3. Ajusta status da cotação para "Aguardando Faturamento" (Planilha Principal)
        await crud.NotasFiscaisCRUD_atualizarStatusCotacoesPorNumeroNota(req.sheets, req.ID_PLANILHA_PRINCIPAL, numeroNF, 'Aguardando Faturamento');
        console.log(`[NotasFiscais] Status da cotação revertido.`);

        // 4. Reseta NF para "Pendente" (Planilha NF)
        await crud.NotasFiscaisCRUD_resetarStatusNF(req.sheets, req.ID_PLANILHA_NF, chaveAcesso);
        console.log(`[NotasFiscais] Status da NF resetado.`);

        res.json({ 
            success: true, 
            message: 'Conciliação desfeita: NF voltou a "Pendente", Cotações limpas e Financeiro removido.' 
        });

    } catch (e) {
        console.error('Erro ao desfazer conciliação:', e);
        res.status(500).json({ success: false, message: 'Erro ao desfazer conciliação: ' + e.message });
    }
}

/**
 * Obtém resumo financeiro (Faturas e Contas a Pagar).
 * GET /api/notasfiscais/resumo-financeiro/:chaveAcesso
 */
async function NotasFiscaisController_obterResumoFinanceiro(req, res) {
    try {
        const { chaveAcesso } = req.params;
        const dados = await crud.NotasFiscaisCRUD_obterResumoFinanceiroDaNF(
            req.sheets, 
            req.ID_PLANILHA_NF, 
            req.ID_PLANILHA_FINANCEIRO, 
            chaveAcesso
        );
        res.json({ success: true, dados });
    } catch (e) {
        console.error('Erro ao obter resumo financeiro:', e);
        res.status(500).json({ success: false, message: e.message });
    }
}

/**
 * Salva (substitui) as faturas de uma NF.
 * POST /api/notasfiscais/salvar-faturas
 * Body: { chaveAcesso, faturas: [] }
 */
async function NotasFiscaisController_salvarFaturas(req, res) {
    try {
        const { chaveAcesso, faturas } = req.body;
        await crud.NotasFiscaisCRUD_substituirFaturasDaNF(req.sheets, req.ID_PLANILHA_NF, chaveAcesso, faturas);
        res.json({ success: true, message: "Faturas salvas com sucesso!" });
    } catch (e) {
        console.error('Erro ao salvar faturas:', e);
        res.status(500).json({ success: false, message: e.message });
    }
}

/**
 * Salva (substitui) contas a pagar de uma NF.
 * POST /api/notasfiscais/salvar-contas-pagar
 * Body: { chaveAcesso, linhas: [] }
 */
async function NotasFiscaisController_salvarContasAPagar(req, res) {
    try {
        const { chaveAcesso, linhas } = req.body;
        await crud.NotasFiscaisCRUD_substituirContasAPagarDaNF(req.sheets, req.ID_PLANILHA_FINANCEIRO, chaveAcesso, linhas);
        res.json({ success: true, message: "Contas a Pagar salvas com sucesso!" });
    } catch (e) {
        console.error('Erro ao salvar contas a pagar:', e);
        res.status(500).json({ success: false, message: e.message });
    }
}

/**
 * Lista setores para rateio (simples leitura de coluna única).
 * GET /api/notasfiscais/setores-rateio
 * (Implementação simplificada lendo da aba RegrasRateio se existir, ou pegando do financeiro)
 */
async function NotasFiscaisController_listarSetoresRegrasRateio(req, res) {
    try {
        // Assumindo que existe uma aba 'RegrasRateio' no Financeiro
        // Se não existir, pode adaptar para ler de outro lugar
        const sheetName = 'RegrasRateio'; 
        
        // Tenta no financeiro
        let response;
        try {
            response = await req.sheets.spreadsheets.values.get({
                spreadsheetId: req.ID_PLANILHA_FINANCEIRO,
                range: `${sheetName}!A:Z` // Lê tudo para achar coluna Setor
            });
        } catch(e) {
            // Fallback para NF se não achar no financeiro (conforme GAS)
            response = await req.sheets.spreadsheets.values.get({
                spreadsheetId: req.ID_PLANILHA_NF,
                range: `${sheetName}!A:Z`
            });
        }

        const rows = response.data.values;
        if (!rows || rows.length < 2) return res.json({ success: true, dados: [] });

        const headers = rows[0].map(s => String(s).toLowerCase());
        const idxSetor = headers.findIndex(h => h.includes('setor') || h.includes('centro de custo'));
        
        if (idxSetor === -1) return res.json({ success: true, dados: [] });

        const setores = new Set();
        for (let i = 1; i < rows.length; i++) {
            const val = rows[i][idxSetor];
            if (val) setores.add(val);
        }

        res.json({ success: true, dados: Array.from(setores).sort() });

    } catch (e) {
        console.warn('Erro ao listar setores:', e.message);
        res.json({ success: true, dados: [] }); // Retorna vazio em vez de erro 500 para não quebrar front
    }
}

/**
 * Atualiza o status de uma NF (usado pelo botão Classificar).
 * POST /api/notasfiscais/atualizar-status
 * Body: { chaveAcesso, novoStatus }
 */
async function NotasFiscaisController_atualizarStatusNF(req, res) {
    try {
        const { chaveAcesso, novoStatus } = req.body;
        
        // Reutiliza a função do CRUD que já criamos (ou cria se não existir, mas resetarStatusNF é similar)
        // Vamos criar uma atualização simples de célula baseada na chave
        const sheets = req.sheets;
        const spreadsheetId = req.ID_PLANILHA_NF;
        const ABA_NF_NOTAS_FISCAIS = 'NotasFiscais'; // Importante: use a constante correta

        // 1. Buscar a linha
        const resBusca = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: ABA_NF_NOTAS_FISCAIS
        });
        const rows = resBusca.data.values;
        if (!rows) throw new Error("Planilha vazia.");

        const headers = rows[0];
        const idxChave = headers.indexOf("Chave de Acesso");
        const idxStatus = headers.indexOf("Status da Conciliação");
        
        if (idxChave === -1 || idxStatus === -1) throw new Error("Colunas não encontradas.");

        let rowIndex = -1;
        for (let i = 1; i < rows.length; i++) {
            if (String(rows[i][idxChave]).trim() === String(chaveAcesso).trim()) {
                rowIndex = i + 1; // 1-based
                break;
            }
        }

        if (rowIndex === -1) throw new Error("NF não encontrada.");

        // 2. Atualizar
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${ABA_NF_NOTAS_FISCAIS}!${String.fromCharCode(65 + idxStatus)}${rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[novoStatus]] }
        });

        res.json({ success: true, message: `Status atualizado para "${novoStatus}".` });

    } catch (e) {
        console.error('Erro ao atualizar status:', e);
        res.status(500).json({ success: false, message: e.message });
    }
}

// ATUALIZE O MODULE.EXPORTS:
module.exports = {
    NotasFiscaisController_listarNotas,
    NotasFiscaisController_desfazerConciliacao,
    NotasFiscaisController_obterResumoFinanceiro,
    NotasFiscaisController_salvarFaturas,
    NotasFiscaisController_salvarContasAPagar,
    NotasFiscaisController_listarSetoresRegrasRateio,
    NotasFiscaisController_atualizarStatusNF
};