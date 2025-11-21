// controllers/CotacoesCRUD.js
// Migrado de CotacoesCRUD.gs

const {
  ABA_COTACOES,
  CABECALHOS_COTACOES,
  ABA_SUBPRODUTOS,
  CABECALHOS_SUBPRODUTOS,
  ABA_PRODUTOS,
  CABECALHOS_PRODUTOS,
  ABA_FORNECEDORES,
  CABECALHOS_FORNECEDORES
} = require('../config/constants');

const STATUS_NOVA_COTACAO = "Nova Cotação";

// --- Funções Auxiliares Internas ---

/**
 * Função genérica para buscar todos os dados de uma aba.
 * @param {object} sheets - Cliente da API Google Sheets.
 * @param {string} spreadsheetId - ID da planilha.
 * @param {string} nomeAba - Nome da aba a ser lida.
 * @returns {Promise<Array<Array<string>>>} Dados brutos da planilha (incluindo cabeçalho).
 */
async function _obterDadosPlanilha(sheets, spreadsheetId, nomeAba) {
  try {
    console.log(`[CotacoesCRUD] Lendo dados da aba: ${nomeAba}`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: nomeAba,
    });
    return response.data.values || [];
  } catch (e) {
    console.error(`[CotacoesCRUD] Erro ao ler a aba ${nomeAba}: ${e.message}`);
    // Lança o erro para que a função chamadora possa tratá-lo
    throw new Error(`Falha ao ler dados da aba "${nomeAba}": ${e.message}`);
  }
}

/**
 * Converte dados da planilha (array de arrays) em um array de objetos.
 * @param {Array<Array<string>>} data - Dados brutos (com cabeçalho).
 * @returns {Array<object>}
 */
function _sheetDataToObjects(data) {
  if (!data || data.length < 2) return [];
  const headers = data[0].map(String);
  const rows = data.slice(1);
  return rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

/**
 * Gera o próximo ID sequencial.
 * @param {Array<Array<string>>} data - Os dados brutos da planilha (com cabeçalho).
 * @param {number} idColumnIndex - O índice (0-based) da coluna de ID.
 * @returns {number} O próximo ID.
 */
function _gerarProximoId(data, idColumnIndex) {
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
 * Formata uma data para o padrão DD/MM/YYYY.
 * @param {Date} dateObj - O objeto de data.
 * @returns {string} A data formatada.
 */
function _formatarDataParaDDMMYYYY(dateObj) {
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return "Data inválida";
  }
  // Usamos toLocaleString para formatar corretamente no fuso horário do servidor (GMT)
  // Nota: Isso pode precisar de ajuste se o fuso do servidor for diferente de Brasília.
  // Para maior robustez, considere usar uma biblioteca como date-fns-tz.
  return dateObj.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo' // Garante o fuso de Brasília
  });
}

// --- Funções CRUD Exportadas ---

/**
 * Migração de CotacoesCRUD_obterResumosDeCotacoes
 * Obtém os resumos das cotações.
 */
async function obterResumosDeCotacoes(sheets, spreadsheetId) {
  const todasAsLinhasDeProdutos = await _obterDadosPlanilha(sheets, spreadsheetId, ABA_COTACOES);
  
  if (todasAsLinhasDeProdutos.length <= 1) {
    return []; // Vazio ou só cabeçalho
  }

  const cabecalhos = todasAsLinhasDeProdutos[0].map(String);
  const indiceIdCotacao = cabecalhos.indexOf("ID da Cotação");
  const indiceDataAbertura = cabecalhos.indexOf("Data Abertura");
  const indiceCategoria = cabecalhos.indexOf("Categoria");
  const indiceStatus = cabecalhos.indexOf("Status da Cotação");

  if ([indiceIdCotacao, indiceDataAbertura, indiceCategoria, indiceStatus].includes(-1)) {
    throw new Error("Colunas essenciais (ID da Cotação, Data Abertura, Categoria, Status da Cotação) não foram encontradas na aba Cotações.");
  }

  const cotacoesUnicas = {};
  const dados = todasAsLinhasDeProdutos.slice(1);

  dados.forEach((linhaProduto, i) => {
    let idCotacao = linhaProduto[indiceIdCotacao];
    if (idCotacao === null || idCotacao === undefined || idCotacao === "") return;
    idCotacao = String(idCotacao);

    const dataAberturaValor = linhaProduto[indiceDataAbertura];
    const categoriaProduto = linhaProduto[indiceCategoria];
    const statusCotacao = linhaProduto[indiceStatus];

    if (!cotacoesUnicas[idCotacao]) {
      cotacoesUnicas[idCotacao] = {
        ID_da_Cotacao: linhaProduto[indiceIdCotacao],
        Data_Abertura_Original_ISO: null,
        Data_Abertura_Formatada: "N/A",
        Status_da_Cotacao: statusCotacao || "Status Desconhecido",
        Categorias: new Set()
      };

      if (dataAberturaValor) {
        try {
          // O Google Sheets pode retornar a data como string ou número (serial date)
          // O cliente node-goolge-sheets geralmente converte para string.
          const dataObj = new Date(dataAberturaValor);
          if (!isNaN(dataObj.getTime())) {
            cotacoesUnicas[idCotacao].Data_Abertura_Original_ISO = dataObj.toISOString();
            cotacoesUnicas[idCotacao].Data_Abertura_Formatada = _formatarDataParaDDMMYYYY(dataObj);
          }
        } catch (e) { /* Ignora data inválida */ }
      }
    }

    if (statusCotacao && (!cotacoesUnicas[idCotacao].Status_da_Cotacao || cotacoesUnicas[idCotacao].Status_da_Cotacao === "Status Desconhecido")) {
      cotacoesUnicas[idCotacao].Status_da_Cotacao = statusCotacao;
    }

    if (categoriaProduto) cotacoesUnicas[idCotacao].Categorias.add(categoriaProduto);
  });

  const arrayDeResumos = Object.values(cotacoesUnicas).map(cotacao => ({
    ID_da_Cotacao: cotacao.ID_da_Cotacao,
    Data_Abertura_Original: cotacao.Data_Abertura_Original_ISO,
    Data_Abertura_Formatada: cotacao.Data_Abertura_Formatada,
    Status_da_Cotacao: cotacao.Status_da_Cotacao,
    Categorias_Unicas_String: Array.from(cotacao.Categorias).join(', ')
  }));

  return arrayDeResumos;
}

/**
 * Combina as funções de obter listas para o modal de nova cotação.
 * Migração de: CotacoesCRUD_obterListaCategoriasProdutos, CotacoesCRUD_obterListaFornecedores, CotacoesCRUD_obterListaProdutos
 */
async function obterOpcoesNovaCotacao(sheets, spreadsheetId) {
  // 1. Obter Categorias e Produtos (da aba Produtos)
  const produtosData = await _obterDadosPlanilha(sheets, spreadsheetId, ABA_PRODUTOS);
  const produtosObj = _sheetDataToObjects(produtosData);
  
  const categoriasSet = new Set();
  const produtosLista = [];
  
  const idxIdProd = "ID";
  const idxNomeProd = "Produto";
  const idxCatProd = "Categoria";

  produtosObj.forEach(p => {
    if (p[idxCatProd]) categoriasSet.add(p[idxCatProd]);
    if (p[idxIdProd] && p[idxNomeProd]) {
      produtosLista.push({ id: p[idxIdProd], nome: p[idxNomeProd] });
    }
  });
  
  const categorias = Array.from(categoriasSet).sort();
  produtosLista.sort((a,b) => a.nome.localeCompare(b.nome));

  // 2. Obter Fornecedores (da aba Fornecedores)
  const fornecedoresData = await _obterDadosPlanilha(sheets, spreadsheetId, ABA_FORNECEDORES);
  const fornecedoresObj = _sheetDataToObjects(fornecedoresData);
  
  const idxIdForn = "ID";
  const idxNomeForn = "Fornecedor";
  
  const fornecedoresLista = fornecedoresObj
    .map(f => ({ id: f[idxIdForn], nome: f[idxNomeForn] }))
    .filter(f => f.id && f.nome);
  
  fornecedoresLista.sort((a,b) => a.nome.localeCompare(b.nome));

  // 3. Retornar dados combinados
  return {
    categorias: categorias,
    fornecedores: fornecedoresLista,
    produtos: produtosLista
  };
}

/**
 * Migração de CotacoesCRUD_criarNovaCotacao
 * Cria uma nova cotação na planilha.
 */
async function criarNovaCotacao(sheets, spreadsheetId, opcoesCriacao) {
  console.log("[CotacoesCRUD] Iniciando criarNovaCotacao com opções:", JSON.stringify(opcoesCriacao));

  // 1. Gerar novo ID
  const cotacoesData = await _obterDadosPlanilha(sheets, spreadsheetId, ABA_COTACOES);
  if (cotacoesData.length === 0) {
    // Se a aba estiver vazia, adiciona cabeçalhos primeiro (melhor prática)
    await sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheetId,
        range: ABA_COTACOES,
        valueInputOption: 'RAW',
        resource: { values: [CABECALHOS_COTACOES] },
    });
    cotacoesData.push(CABECALHOS_COTACOES); // Adiciona ao array local
  }
  
  const cabecalhosCotacoes = cotacoesData[0].map(String);
  const idColunaIndex = cabecalhosCotacoes.indexOf("ID da Cotação");
  if (idColunaIndex === -1) throw new Error("Coluna 'ID da Cotação' não encontrada.");
  
  const novoIdCotacaoNumerico = _gerarProximoId(cotacoesData, idColunaIndex);
  const dataAbertura = new Date();

  // 2. Obter dados de SubProdutos e Produtos
  const todosSubProdutosData = await _obterDadosPlanilha(sheets, spreadsheetId, ABA_SUBPRODUTOS);
  const todosProdutosData = await _obterDadosPlanilha(sheets, spreadsheetId, ABA_PRODUTOS);

  const todosSubProdutos = _sheetDataToObjects(todosSubProdutosData);
  const todosProdutos = _sheetDataToObjects(todosProdutosData);

  if (todosSubProdutos.length === 0 || todosProdutos.length === 0) {
    throw new Error("Falha ao carregar dados de Produtos ou SubProdutos.");
  }

  const produtosMap = todosProdutos.reduce((map, prod) => {
    map[prod["Produto"]] = prod;
    return map;
  }, {});

  // 3. Filtrar SubProdutos com base nas opções
  let subProdutosFiltrados = [];
  const tipo = opcoesCriacao.tipo;
  const selecoesLowerCase = opcoesCriacao.selecoes.map(s => String(s).toLowerCase());

  console.log(`[CotacoesCRUD] Tipo "${tipo}", Seleções: ${JSON.stringify(selecoesLowerCase)}`);

  if (tipo === 'categoria') {
    const nomesProdutosDaCategoria = todosProdutos
      .filter(p => p["Categoria"] && selecoesLowerCase.includes(String(p["Categoria"]).toLowerCase()))
      .map(p => String(p["Produto"]).toLowerCase());
    subProdutosFiltrados = todosSubProdutos.filter(sp => {
      const produtoVinculado = sp["Produto Vinculado"] ? String(sp["Produto Vinculado"]).toLowerCase() : null;
      return produtoVinculado && nomesProdutosDaCategoria.includes(produtoVinculado);
    });
  } else if (tipo === 'fornecedor') {
    subProdutosFiltrados = todosSubProdutos.filter(sp => {
      const fornecedorSubProduto = sp["Fornecedor"] ? String(sp["Fornecedor"]).toLowerCase() : null;
      return fornecedorSubProduto && selecoesLowerCase.includes(fornecedorSubProduto);
    });
  } else if (tipo === 'curvaABC') {
    const nomesProdutosDaCurva = todosProdutos
      .filter(p => p["ABC"] && selecoesLowerCase.includes(String(p["ABC"]).toLowerCase()))
      .map(p => String(p["Produto"]).toLowerCase());
    subProdutosFiltrados = todosSubProdutos.filter(sp => {
      const produtoVinculado = sp["Produto Vinculado"] ? String(sp["Produto Vinculado"]).toLowerCase() : null;
      return produtoVinculado && nomesProdutosDaCurva.includes(produtoVinculado);
    });
  } else if (tipo === 'produtoEspecifico') {
    subProdutosFiltrados = todosSubProdutos.filter(sp => {
      const produtoVinculado = sp["Produto Vinculado"] ? String(sp["Produto Vinculado"]).toLowerCase() : null;
      return produtoVinculado && selecoesLowerCase.includes(produtoVinculado);
    });
  } else {
    throw new Error("Tipo de criação desconhecido: " + tipo);
  }

  console.log(`[CotacoesCRUD] ${subProdutosFiltrados.length} subprodutos filtrados.`);

  if (subProdutosFiltrados.length === 0) {
    return { success: true, idCotacao: novoIdCotacaoNumerico, numItens: 0, message: "Nenhum subproduto encontrado para os critérios. Cotação criada vazia." };
  }

  // 4. Mapear e Adicionar Linhas
  const linhasParaAdicionar = subProdutosFiltrados.map(subProd => {
    const produtoPrincipal = produtosMap[subProd["Produto Vinculado"]];
    const estoqueMinimo = produtoPrincipal ? produtoPrincipal["Estoque Minimo"] : "";
    const nomeProdutoPrincipalParaCotacao = subProd["Produto Vinculado"];

    let linha = [];
    CABECALHOS_COTACOES.forEach(header => {
      switch (header) {
        case "ID da Cotação": linha.push(novoIdCotacaoNumerico); break;
        case "Data Abertura": linha.push(dataAbertura.toISOString()); break;
        case "Produto": linha.push(nomeProdutoPrincipalParaCotacao); break;
        case "SubProduto": linha.push(subProd["SubProduto"]); break;
        case "Categoria": linha.push(produtoPrincipal ? produtoPrincipal["Categoria"] : subProd["Categoria"]); break;
        case "Fornecedor": linha.push(subProd["Fornecedor"]); break;
        case "Tamanho": linha.push(subProd["Tamanho"]); break;
        case "UN": linha.push(subProd["UN"]); break;
        case "Fator": linha.push(subProd["Fator"]); break;
        case "Estoque Mínimo": linha.push(estoqueMinimo); break;
        case "NCM": linha.push(subProd["NCM"]); break;
        case "CST": linha.push(subProd["CST"]); break;
        case "CFOP": linha.push(subProd["CFOP"]); break;
        case "Status da Cotação": linha.push(STATUS_NOVA_COTACAO); break;
        default:
          linha.push("");
      }
    });
    return linha;
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId,
    range: ABA_COTACOES,
    valueInputOption: 'USER_ENTERED', // USER_ENTERED para formatar data
    resource: {
      values: linhasParaAdicionar,
    },
  });

  console.log(`[CotacoesCRUD] ${linhasParaAdicionar.length} itens adicionados à cotação ${novoIdCotacaoNumerico}.`);
  return {
    success: true,
    idCotacao: novoIdCotacaoNumerico,
    numItens: linhasParaAdicionar.length,
    message: "Nova cotação criada com sucesso."
  };
}


module.exports = {
  obterResumosDeCotacoes,
  obterOpcoesNovaCotacao,
  criarNovaCotacao
};