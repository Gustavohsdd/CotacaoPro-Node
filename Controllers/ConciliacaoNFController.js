// CotacaoPro-Node/Controllers/ConciliacaoNFController.js
// VERSÃO CORRIGIDA - Remove autenticação local e usa req.sheets/req.drive

// [REMOVIDO] Não precisamos mais do 'googleapis' nem do 'getAuth' aqui.
const crud = require('./ConciliacaoNFCrud'); // O ConciliacaoNFCrud.js que migramos
const constants = require('../config/constants');
const { parseStringPromise } = require('xml2js');

// [NOVO] Importe os outros módulos CRUD que este controller utiliza
// (Assumindo que eles existem no seu projeto Node)
const cotacoesCRUD = require('./CotacoesCRUD');
const fornecedoresCRUD = require('./FornecedoresCRUD');
const produtosCRUD = require('./ProdutosCRUD');
const subProdutosCRUD = require('./SubProdutosCRUD');
// const rateioCrud = require('./RateioCrud'); // O seu 'RateioCrud.js' original
// const mapeamentoCRUD = require('./MapeamentoConciliacaoCRUD'); // O seu 'Mapeamento...CRUD.js' original

// [REMOVIDO] O 'drive' agora virá do req.drive

// --- FUNÇÕES HELPER (extrairDadosNF, prepararDadosParaPlanilha, _safeGet) ---
// (Estas funções permanecem inalteradas)

/**
 * Busca de forma segura um valor aninhado em um objeto (resultado do xml2js).
 * @param {Object} obj - O objeto (JSON) resultante da análise do XML.
 * @param {string} path - O caminho para a propriedade (ex: 'nfeProc.NFe[0].infNFe[0].emit[0].xNome[0]').
 * @param {*} defaultValue - O valor a ser retornado se o caminho não for encontrado.
 * @returns {*} - O valor encontrado ou o valor padrão.
 */
function _safeGet(obj, path, defaultValue = '') {
  try {
    const keys = path.split('.').flatMap(key => {
      const match = key.match(/(\w+)\[(\d+)\]/); 
      if (match) {
        return [match[1], parseInt(match[2])]; 
      }
      return key;
    });

    let result = obj;
    for (const key of keys) {
      if (result === null || typeof result === 'undefined') {
        return defaultValue;
      }
      result = result[key];
    }
    return (typeof result === 'undefined' || result === null) ? defaultValue : result;
  } catch (e) {
    return defaultValue;
  }
}

/**
 * Extrai os dados de um conteúdo XML de NF-e usando xml2js.
 * @param {string} xmlContent - O conteúdo do arquivo XML.
 * @returns {Promise<Object>} - Um objeto estruturado com os dados da NF.
 */
async function extrairDadosNF(xmlContent) {
  try {
    const result = await parseStringPromise(xmlContent, { ignoreAttrs: false, explicitArray: true });
    const infNFe = _safeGet(result, 'nfeProc.NFe[0].infNFe[0]');
    if (!infNFe) {
      throw new Error('Estrutura XML inválida: tag <infNFe> não encontrada.');
    }
    const chaveAcesso = _safeGet(infNFe, '$.Id', '').replace('NFe', '');
    if (!chaveAcesso) {
      throw new Error('Não foi possível extrair a Chave de Acesso do XML.');
    }

    const dadosNF = {
      geral: {
        chaveAcesso: chaveAcesso,
        numero: _safeGet(infNFe, 'ide[0].nNF[0]'),
        serie: _safeGet(infNFe, 'ide[0].serie[0]'),
        dataEmissao: _safeGet(infNFe, 'ide[0].dhEmi[0]'),
        naturezaOperacao: _safeGet(infNFe, 'ide[0].natOp[0]'),
        infoAdicionais: _safeGet(infNFe, 'infAdic[0].infCpl[0]'),
        numeroPedido: _safeGet(infNFe, 'compra[0].xPed[0]')
      },
      emitente: {
        cnpj: _safeGet(infNFe, 'emit[0].CNPJ[0]'),
        nome: _safeGet(infNFe, 'emit[0].xNome[0]'),
        ie: _safeGet(infNFe, 'emit[0].IE[0]'),
        logradouro: _safeGet(infNFe, 'emit[0].enderEmit[0].xLgr[0]'),
        numero: _safeGet(infNFe, 'emit[0].enderEmit[0].nro[0]'),
        bairro: _safeGet(infNFe, 'emit[0].enderEmit[0].xBairro[0]'),
        municipio: _safeGet(infNFe, 'emit[0].enderEmit[0].xMun[0]'),
        uf: _safeGet(infNFe, 'emit[0].enderEmit[0].UF[0]'),
        cep: _safeGet(infNFe, 'emit[0].enderEmit[0].CEP[0]')
      },
      destinatario: {
        cnpj: _safeGet(infNFe, 'dest[0].CNPJ[0]'),
        nome: _safeGet(infNFe, 'dest[0].xNome[0]')
      },
      itens: [], faturas: [],
      transporte: {
        modalidadeFrete: _safeGet(infNFe, 'transp[0].modFrete[0]'),
        cnpjTransportadora: _safeGet(infNFe, 'transp[0].transporta[0].CNPJ[0]'),
        nomeTransportadora: _safeGet(infNFe, 'transp[0].transporta[0].xNome[0]'),
        ieTransportadora: _safeGet(infNFe, 'transp[0].transporta[0].IE[0]'),
        enderecoTransportadora: _safeGet(infNFe, 'transp[0].transporta[0].xEnder[0]'),
        placaVeiculo: _safeGet(infNFe, 'transp[0].veicTransp[0].placa[0]'),
        qntVolumes: _safeGet(infNFe, 'transp[0].vol[0].qVol[0]'),
        especieVolumes: _safeGet(infNFe, 'transp[0].vol[0].esp[0]'),
        pesoLiquido: _safeGet(infNFe, 'transp[0].vol[0].pesoL[0]'),
        pesoBruto: _safeGet(infNFe, 'transp[0].vol[0].pesoB[0]')
      },
      totais: {
        totalBaseCalculoICMS: _safeGet(infNFe, 'total[0].ICMSTot[0].vBC[0]'),
        totalValorICMS: _safeGet(infNFe, 'total[0].ICMSTot[0].vICMS[0]'),
        totalValorICMSST: _safeGet(infNFe, 'total[0].ICMSTot[0].vST[0]'),
        totalValorProdutos: _safeGet(infNFe, 'total[0].ICMSTot[0].vProd[0]'),
        totalValorFrete: _safeGet(infNFe, 'total[0].ICMSTot[0].vFrete[0]'),
        totalValorSeguro: _safeGet(infNFe, 'total[0].ICMSTot[0].vSeg[0]'),
        totalValorDesconto: _safeGet(infNFe, 'total[0].ICMSTot[0].vDesc[0]'),
        totalValorIPI: _safeGet(infNFe, 'total[0].ICMSTot[0].vIPI[0]'),
        totalValorPIS: _safeGet(infNFe, 'total[0].ICMSTot[0].vPIS[0]'),
        totalValorCOFINS: _safeGet(infNFe, 'total[0].ICMSTot[0].vCOFINS[0]'),
        totalOutrasDespesas: _safeGet(infNFe, 'total[0].ICMSTot[0].vOutro[0]'),
        valorTotalNF: _safeGet(infNFe, 'total[0].ICMSTot[0].vNF[0]')
      }
    };

    const itensXML = _safeGet(infNFe, 'det', []);
    for (const item of itensXML) {
      dadosNF.itens.push({
        numeroItem: _safeGet(item, '$.nItem', ''),
        codigoProduto: _safeGet(item, 'prod[0].cProd[0]'),
        gtin: _safeGet(item, 'prod[0].cEAN[0]'),
        descricaoProduto: _safeGet(item, 'prod[0].xProd[0]'),
        ncm: _safeGet(item, 'prod[0].NCM[0]'),
        cfop: _safeGet(item, 'prod[0].CFOP[0]'),
        unidadeComercial: _safeGet(item, 'prod[0].uCom[0]'),
        quantidadeComercial: _safeGet(item, 'prod[0].qCom[0]'),
        valorUnitarioComercial: _safeGet(item, 'prod[0].vUnCom[0]'),
        valorTotalBruto: _safeGet(item, 'prod[0].vProd[0]'),
        valorFrete: _safeGet(item, 'prod[0].vFrete[0]'),
        valorSeguro: _safeGet(item, 'prod[0].vSeg[0]'),
        valorDesconto: _safeGet(item, 'prod[0].vDesc[0]'),
        outrasDespesas: _safeGet(item, 'prod[0].vOutro[0]'),
        cstICMS: _safeGet(item, 'imposto[0].ICMS[0].ICMS00[0].CST[0]') || _safeGet(item, 'imposto[0].ICMS[0].ICMS10[0].CST[0]') || _safeGet(item, 'imposto[0].ICMS[0].ICMS20[0].CST[0]') || _safeGet(item, 'imposto[0].ICMS[0].ICMS40[0].CST[0]') || _safeGet(item, 'imposto[0].ICMS[0].ICMS51[0].CST[0]') || _safeGet(item, 'imposto[0].ICMS[0].ICMS60[0].CST[0]') || _safeGet(item, 'imposto[0].ICMS[0].ICMSSN101[0].CSOSN[0]') || _safeGet(item, 'imposto[0].ICMS[0].ICMSSN102[0].CSOSN[0]') || '',
        baseCalculoICMS: _safeGet(item, 'imposto[0].ICMS[0].ICMS00[0].vBC[0]') || _safeGet(item, 'imposto[0].ICMS[0].ICMS10[0].vBC[0]') || _safeGet(item, 'imposto[0].ICMS[0].ICMS20[0].vBC[0]') || '',
        aliquotaICMS: _safeGet(item, 'imposto[0].ICMS[0].ICMS00[0].pICMS[0]') || _safeGet(item, 'imposto[0].ICMS[0].ICMS10[0].pICMS[0]') || _safeGet(item, 'imposto[0].ICMS[0].ICMS20[0].pICMS[0]') || '',
        valorICMS: _safeGet(item, 'imposto[0].ICMS[0].ICMS00[0].vICMS[0]') || _safeGet(item, 'imposto[0].ICMS[0].ICMS10[0].vICMS[0]') || _safeGet(item, 'imposto[0].ICMS[0].ICMS20[0].vICMS[0]') || '',
        valorICMSST: _safeGet(item, 'imposto[0].ICMS[0].ICMS10[0].vICMSST[0]') || _safeGet(item, 'imposto[0].ICMS[0].ICMS60[0].vICMSST[0]') || '',
        cstIPI: _safeGet(item, 'imposto[0].IPI[0].IPITrib[0].CST[0]') || _safeGet(item, 'imposto[0].IPI[0].IPINT[0].CST[0]') || '',
        baseCalculoIPI: _safeGet(item, 'imposto[0].IPI[0].IPITrib[0].vBC[0]'),
        aliquotaIPI: _safeGet(item, 'imposto[0].IPI[0].IPITrib[0].pIPI[0]'),
        valorIPI: _safeGet(item, 'imposto[0].IPI[0].IPITrib[0].vIPI[0]'),
        cstPIS: _safeGet(item, 'imposto[0].PIS[0].PISAliq[0].CST[0]') || _safeGet(item, 'imposto[0].PIS[0].PISNT[0].CST[0]') || _safeGet(item, 'imposto[0].PIS[0].PISOutr[0].CST[0]') || '',
        valorPIS: _safeGet(item, 'imposto[0].PIS[0].PISAliq[0].vPIS[0]') || _safeGet(item, 'imposto[0].PIS[0].PISOutr[0].vPIS[0]') || '',
        cstCOFINS: _safeGet(item, 'imposto[0].COFINS[0].COFINSAliq[0].CST[0]') || _safeGet(item, 'imposto[0].COFINS[0].COFINSNT[0].CST[0]') || _safeGet(item, 'imposto[0].COFINS[0].COFINSOutr[0].CST[0]') || '',
        valorCOFINS: _safeGet(item, 'imposto[0].COFINS[0].COFINSAliq[0].vCOFINS[0]') || _safeGet(item, 'imposto[0].COFINS[0].COFINSOutr[0].vCOFINS[0]') || ''
      });
    }

    const faturasXML = _safeGet(infNFe, 'cobr[0].dup', []);
    const numeroFatura = _safeGet(infNFe, 'cobr[0].fat[0].nFat[0]', '');
    for (const fatura of faturasXML) {
      dadosNF.faturas.push({
        numeroFatura: numeroFatura,
        numeroParcela: _safeGet(fatura, 'nDup[0]'),
        dataVencimento: _safeGet(fatura, 'dVenc[0]'),
        valorParcela: _safeGet(fatura, 'vDup[0]')
      });
    }
    return dadosNF;
  } catch (err) {
    console.error('Erro ao analisar XML:', err);
    throw new Error(`Falha na extração de dados do XML: ${err.message}`);
  }
}

/**
 * Prepara os dados extraídos do XML para o formato de objeto da planilha.
 * @param {Object} dadosNF - Os dados brutos extraídos do XML.
 * @returns {Object} - Os dados formatados em objetos para cada aba.
 */
function prepararDadosParaPlanilha(dadosNF) {
  const chaveAcesso = dadosNF.geral.chaveAcesso;
  const dadosNotasFiscais = {
    "Chave de Acesso": chaveAcesso, "ID da Cotação (Sistema)": "", "Status da Conciliação": "Pendente",
    "Número NF": dadosNF.geral.numero, "Série NF": dadosNF.geral.serie, "Data e Hora Emissão": dadosNF.geral.dataEmissao,
    "Natureza da Operação": dadosNF.geral.naturezaOperacao, "CNPJ Emitente": dadosNF.emitente.cnpj, "Nome Emitente": dadosNF.emitente.nome,
    "Inscrição Estadual Emitente": dadosNF.emitente.ie, "Logradouro Emitente": dadosNF.emitente.logradouro, "Número End. Emitente": dadosNF.emitente.numero,
    "Bairro Emitente": dadosNF.emitente.bairro, "Município Emitente": dadosNF.emitente.municipio, "UF Emitente": dadosNF.emitente.uf,
    "CEP Emitente": dadosNF.emitente.cep, "CNPJ Destinatário": dadosNF.destinatario.cnpj, "Nome Destinatário": dadosNF.destinatario.nome,
    "Informações Adicionais": dadosNF.geral.infoAdicionais, "Número do Pedido (Extraído)": dadosNF.geral.numeroPedido, "Status do Rateio": "Pendente"
  };
  const dadosItensNF = dadosNF.itens.map(item => ({
    "Chave de Acesso": chaveAcesso, "Número do Item": item.numeroItem, "Código Produto (Forn)": item.codigoProduto,
    "GTIN/EAN (Cód. Barras)": item.gtin, "Descrição Produto (NF)": item.descricaoProduto, "NCM": item.ncm, "CFOP": item.cfop,
    "Unidade Comercial": item.unidadeComercial, "Quantidade Comercial": item.quantidadeComercial, "Valor Unitário Comercial": item.valorUnitarioComercial,
    "Valor Total Bruto Item": item.valorTotalBruto, "Valor do Frete (Item)": item.valorFrete, "Valor do Seguro (Item)": item.valorSeguro,
    "Valor do Desconto (Item)": item.valorDesconto, "Outras Despesas (Item)": item.outrasDespesas, "CST/CSOSN (ICMS)": item.cstICMS,
    "Base de Cálculo (ICMS)": item.baseCalculoICMS, "Alíquota (ICMS)": item.aliquotaICMS, "Valor (ICMS)": item.valorICMS, "Valor (ICMS ST)": item.valorICMSST,
    "CST (IPI)": item.cstIPI, "Base de Cálculo (IPI)": item.baseCalculoIPI, "Alíquota (IPI)": item.aliquotaIPI, "Valor (IPI)": item.valorIPI,
    "CST (PIS)": item.cstPIS, "Valor (PIS)": item.valorPIS, "CST (COFINS)": item.cstCOFINS, "Valor (COFINS)": item.valorCOFINS
  }));
  const dadosFaturasNF = dadosNF.faturas.map(fatura => ({
    "Chave de Acesso": chaveAcesso, "Número da Fatura": fatura.numeroFatura, "Número da Parcela": fatura.numeroParcela,
    "Data de Vencimento": fatura.dataVencimento, "Valor da Parcela": fatura.valorParcela
  }));
  const dadosTransporteNF = {
    "Chave de Acesso": chaveAcesso, "Modalidade Frete": dadosNF.transporte.modalidadeFrete, "CNPJ Transportadora": dadosNF.transporte.cnpjTransportadora,
    "Nome Transportadora": dadosNF.transporte.nomeTransportadora, "IE Transportadora": dadosNF.transporte.ieTransportadora,
    "Endereço Transportadora": dadosNF.transporte.enderecoTransportadora, "Placa Veículo": dadosNF.transporte.placaVeiculo,
    "Quantidade Volumes": dadosNF.transporte.qntVolumes, "Espécie Volumes": dadosNF.transporte.especieVolumes,
    "Peso Líquido Total": dadosNF.transporte.pesoLiquido, "Peso Bruto Total": dadosNF.transporte.pesoBruto
  };
  const dadosTributosTotaisNF = {
    "Chave de Acesso": chaveAcesso, "Total Base Cálculo ICMS": dadosNF.totais.totalBaseCalculoICMS, "Total Valor ICMS": dadosNF.totais.totalValorICMS,
    "Total Valor ICMS ST": dadosNF.totais.totalValorICMSST, "Total Valor Produtos": dadosNF.totais.totalValorProdutos,
    "Total Valor Frete": dadosNF.totais.totalValorFrete, "Total Valor Seguro": dadosNF.totais.totalValorSeguro,
    "Total Valor Desconto": dadosNF.totais.totalValorDesconto, "Total Valor IPI": dadosNF.totais.totalValorIPI,
    "Total Valor PIS": dadosNF.totais.totalValorPIS, "Total Valor COFINS": dadosNF.totais.totalValorCOFINS,
    "Total Outras Despesas": dadosNF.totais.totalOutrasDespesas, "Valor Total da NF": dadosNF.totais.valorTotalNF
  };
  return {
    NotasFiscais: dadosNotasFiscais,
    Itens: dadosItensNF,
    Faturas: dadosFaturasNF,
    Transporte: dadosTransporteNF,
    TributosTotais: dadosTributosTotaisNF
  };
}

/**
 * Cria as entradas de Contas a Pagar com base nas faturas e regras de rateio.
 * @param {object} sheets - Cliente autenticado do Google Sheets (de req.sheets).
 * @param {Array<Object>} faturas - Array de faturas extraídas (do XML).
 * @param {string} chaveAcesso - Chave de acesso da NF.
 * @param {Array<Object>} itensNF - Itens da NF (do XML) para resumo.
 */
async function criarContasAPagar(sheets, faturas, chaveAcesso, itensNF) {
  try {
    const regrasRateio = await crud.getRegrasRateio(sheets);
    if (regrasRateio.length === 0) {
      console.warn('Nenhuma regra de rateio encontrada. Contas a Pagar não será gerado.');
      return;
    }
    const resumoItens = itensNF.map(item => `${item.descricaoProduto} (Qtd: ${item.quantidadeComercial})`).join('; ');
    const contasAPagar = [];
    for (const fatura of faturas) {
      const valorTotalParcela = parseFloat(fatura.valorParcela) || 0;
      if (valorTotalParcela === 0) continue;
      for (const regra of regrasRateio) {
        const porcentagem = parseFloat(regra["Porcentagem"]) || 0;
        const valorPorSetor = (valorTotalParcela * porcentagem) / 100;
        contasAPagar.push({
          "Chave de Acesso": chaveAcesso, "Número da Fatura": fatura.numeroFatura, "Número da Parcela": fatura.numeroParcela,
          "Resumo dos Itens": resumoItens, "Data de Vencimento": fatura.dataVencimento, "Valor da Parcela": fatura.valorParcela,
          "Setor": regra["Setor"], "Valor por Setor": valorPorSetor.toFixed(2)
        });
      }
    }
    if (contasAPagar.length > 0) {
      await crud.updateContasAPagar(sheets, contasAPagar);
      console.log(`Contas a Pagar geradas para a NF ${chaveAcesso}`);
    }
  } catch (err) {
    console.error(`Erro ao criar Contas a Pagar para NF ${chaveAcesso}:`, err);
  }
}

// --- ENDPOINTS (Rotas) ---

/**
 * [MIGRADO] Processa arquivos XML da pasta de importação no Drive.
 * (Endpoint: POST /conciliacaonf/processar)
 */
const processarXMLs = async (req, res) => {
  // [REMOVIDO] A autenticação agora vem de req.sheets e req.drive
  const logs = [];
  let arquivosProcessados = 0, arquivosIgnorados = 0, arquivosComErro = 0;

  try {
    // [CORRIGIDO] Passa o req.drive (cliente autenticado) para o CRUD
    const files = await crud.getXmlFiles(req.drive);
    if (files.length === 0) {
      return res.json({ message: 'Nenhum arquivo XML encontrado para processar.' });
    }
    logs.push(`Encontrados ${files.length} arquivos XML.`);

    for (const file of files) {
      const fileId = file.id; const fileName = file.name;
      try {
        console.log(`Processando arquivo: ${fileName} (ID: ${fileId})`);
        // [CORRIGIDO] Passa req.drive
        const xmlContent = await crud.getXmlContent(req.drive, fileId);
        const dadosNF = await extrairDadosNF(xmlContent);
        const chaveAcesso = dadosNF.geral.chaveAcesso;
        if (!chaveAcesso) throw new Error(`Não foi possível extrair a Chave de Acesso do arquivo ${fileName}`);

        // [CORRIGIDO] Passa req.sheets
        const existe = await crud.findChaveAcesso(req.sheets, chaveAcesso);
        if (existe) {
          logs.push(`Arquivo ${fileName} (Chave: ${chaveAcesso}) já processado. Ignorando.`);
          arquivosIgnorados++;
        } else {
          const dadosPlanilha = prepararDadosParaPlanilha(dadosNF);
          // [CORRIGIDO] Passa req.sheets
          await Promise.all([
            crud.updateNotasFiscais(req.sheets, dadosPlanilha.NotasFiscais),
            crud.updateItensNF(req.sheets, dadosPlanilha.Itens),
            crud.updateFaturasNF(req.sheets, dadosPlanilha.Faturas),
            crud.updateTransporteNF(req.sheets, dadosPlanilha.Transporte),
            crud.updateTributosTotaisNF(req.sheets, dadosPlanilha.TributosTotais)
          ]);
          logs.push(`Arquivo ${fileName} (Chave: ${chaveAcesso}) salvo nas planilhas.`);
          // [CORRIGIDO] Passa req.sheets
          await criarContasAPagar(req.sheets, dadosNF.faturas, chaveAcesso, dadosNF.itens);
          arquivosProcessados++;
        }
        
        if (constants.ID_PASTA_XML_PROCESSADOS) {
          // [CORRIGIDO] Usa req.drive
          const fileMetadata = await req.drive.files.get({ fileId: fileId, fields: 'parents' });
          const previousParents = fileMetadata.data.parents.join(',');
          await req.drive.files.update({
            fileId: fileId,
            addParents: constants.ID_PASTA_XML_PROCESSADOS,
            removeParents: previousParents,
            fields: 'id, parents'
          });
          logs.push(`Arquivo ${fileName} movido para a pasta de processados.`);
        } else {
          logs.push(`AVISO: ID_PASTA_XML_PROCESSADOS não definido. Arquivo ${fileName} não foi movido.`);
        }
      } catch (fileErr) {
        console.error(`Erro ao processar o arquivo ${fileName}:`, fileErr);
        logs.push(`ERRO: Falha ao processar ${fileName}. Motivo: ${fileErr.message}`);
        arquivosComErro++;
      }
    }
    const resumo = `Processamento concluído. Total: ${files.length} | Sucesso: ${arquivosProcessados} | Ignorados: ${arquivosIgnorados} | Erros: ${arquivosComErro}`;
    logs.push(resumo);
    res.json({ message: resumo, logs: logs });
  } catch (err) {
    console.error('Erro fatal no processamento de XMLs:', err);
    logs.push(`ERRO FATAL: ${err.message}`);
    res.status(500).json({ error: 'Ocorreu um erro geral no processamento.', logs: logs });
  }
};

/**
 * [NOVO - MIGRADO] Recebe arquivos XML via upload da interface.
 * (Endpoint: POST /conciliacaonf/upload-xmls)
 */
const uploadArquivos = async (req, res) => {
  // [REMOVIDO] A autenticação agora vem de req.sheets e req.drive
  const arquivos = req.body.files;
  if (!arquivos || arquivos.length === 0) {
    return res.status(400).json({ success: false, message: "Nenhum arquivo recebido." });
  }

  let arquivosProcessados = 0, arquivosDuplicados = 0, arquivosComErro = 0;
  const logs = [];

  for (const file of arquivos) {
    const fileName = file.fileName;
    try {
      // 1. Decodificar o conteúdo base64
      const xmlContent = Buffer.from(file.content, 'base64').toString('utf-8');

      // 2. Extrair dados (reutilizando a função)
      const dadosNF = await extrairDadosNF(xmlContent);
      const chaveAcesso = dadosNF.geral.chaveAcesso;
      if (!chaveAcesso) throw new Error(`Não foi possível extrair a Chave de Acesso do arquivo ${fileName}`);

      // 3. Verificar duplicidade (Passando req.sheets)
      const existe = await crud.findChaveAcesso(req.sheets, chaveAcesso);
      if (existe) {
        logs.push(`Arquivo ${fileName} (Chave: ${chaveAcesso}) já processado. Ignorando.`);
        arquivosDuplicados++;
      } else {
        // 4. Salvar dados nas planilhas (Passando req.sheets)
        const dadosPlanilha = prepararDadosParaPlanilha(dadosNF);
        await Promise.all([
          crud.updateNotasFiscais(req.sheets, dadosPlanilha.NotasFiscais),
          crud.updateItensNF(req.sheets, dadosPlanilha.Itens),
          crud.updateFaturasNF(req.sheets, dadosPlanilha.Faturas),
          crud.updateTransporteNF(req.sheets, dadosPlanilha.Transporte),
          crud.updateTributosTotaisNF(req.sheets, dadosPlanilha.TributosTotais)
        ]);
        logs.push(`Arquivo ${fileName} (Chave: ${chaveAcesso}) salvo nas planilhas.`);

        // 5. Criar Contas a Pagar (Passando req.sheets)
        await criarContasAPagar(req.sheets, dadosNF.faturas, chaveAcesso, dadosNF.itens);

        // 6. Salvar o XML no Drive (na pasta de processados) (Usando req.drive)
        if (constants.ID_PASTA_XML_PROCESSADOS) {
          await req.drive.files.create({
            resource: {
              name: fileName,
              parents: [constants.ID_PASTA_XML_PROCESSADOS]
            },
            media: {
              mimeType: 'text/xml',
              body: xmlContent
            }
          });
          logs.push(`Arquivo ${fileName} salvo no Drive (Processados).`);
        }
        
        arquivosProcessados++;
      }
    } catch (fileErr) {
      console.error(`Erro ao processar o upload do arquivo ${fileName}:`, fileErr);
      logs.push(`ERRO: Falha ao processar ${fileName}. Motivo: ${fileErr.message}`);
      arquivosComErro++;
    }
  }

  const resumo = `Upload concluído. Total: ${arquivos.length} | Sucesso: ${arquivosProcessados} | Duplicados: ${arquivosDuplicados} | Erros: ${arquivosComErro}`;
  res.json({ success: true, message: resumo, logs: logs });
};

/**
 * [NOVO - MIGRADO] Obtém todos os dados necessários para carregar a página de conciliação.
 * (Endpoint: GET /conciliacaonf/dados-pagina)
 */
const getDadosPagina = async (req, res) => {
  try {
    // [REMOVIDO] A autenticação agora vem de req.sheets
    
    // 1. Obter todos os dados brutos em paralelo (passando req.sheets)
    const [
      notasFiscais, 
      todosItensNF, 
      todosTributos, 
      todasFaturas, 
      regrasRateio,
      // Assumindo que estas funções existem nos seus outros módulos CRUD
      // cotacoes, 
      // todosItensCotacao,
      // mapeamentoConciliacao
    ] = await Promise.all([
      crud.getNotasFiscais(req.sheets),
      crud.getItensNF(req.sheets), // Sem chave, obtém todos
      crud.getTributosTotaisNF(req.sheets), // Sem chave, obtém todos
      crud.getFaturasNF(req.sheets), // Sem chave, obtém todos
      crud.getRegrasRateio(req.sheets),
      // cotacoesCRUD.obterCotacoesAbertas(req.sheets),
      // cotacoesCRUD.obterTodosItensCotacoes(req.sheets),
      // mapeamentoCRUD.getMapeamento(req.sheets)
    ]);

    // [Simulação] Substitua pelos dados reais dos CRUDs acima
    // Assumindo que os outros CRUDs também esperam 'sheets'
    const cotacoes = await cotacoesCRUD.getAll(req.sheets); 
    const todosItensCotacao = await cotacoesCRUD.getAllItens(req.sheets);
    const mapeamentoConciliacao = []; //await mapeamentoCRUD.getMapeamento(req.sheets);


    // 2. Processar e filtrar os dados (lógica do GAS)
    const chavesNFsPendentes = notasFiscais
      .filter(nf => nf['Status da Conciliação'] === 'Pendente')
      .map(nf => nf['Chave de Acesso']);
    
    const itensNF = todosItensNF
      .filter(item => chavesNFsPendentes.includes(item['Chave de Acesso']))
      .map(item => ({ // Mapeia para o formato que o script espera
        chaveAcesso: item['Chave de Acesso'],
        numeroItem: item['Número do Item'],
        descricaoNF: item['Descrição Produto (NF)'],
        gtin: item['GTIN/EAN (Cód. Barras)'],
        qtdNF: parseFloat(item['Quantidade Comercial']) || 0,
        precoNF: parseFloat(item['Valor Unitário Comercial']) || 0,
        unidadeComercial: item['Unidade Comercial']
      }));

    const dadosGeraisNF = chavesNFsPendentes.map(chave => {
      const tributos = todosTributos.find(t => t['Chave de Acesso'] === chave) || {};
      const faturas = todasFaturas.filter(f => f['Chave de Acesso'] === chave);
      return {
        chaveAcesso: chave,
        valorTotalNf: parseFloat(tributos['Valor Total da NF']) || 0,
        totalValorProdutos: parseFloat(tributos['Total Valor Produtos']) || 0,
        totalValorIcms: parseFloat(tributos['Total Valor ICMS']) || 0,
        totalValorIcmsSt: parseFloat(tributos['Total Valor ICMS ST']) || 0,
        totalValorIpi: parseFloat(tributos['Total Valor IPI']) || 0,
        totalValorPis: parseFloat(tributos['Total Valor PIS']) || 0,
        totalValorCofins: parseFloat(tributos['Total Valor COFINS']) || 0,
        totalOutrasDespesas: parseFloat(tributos['Total Outras Despesas']) || 0,
        totalValorDesconto: parseFloat(tributos['Total Valor Desconto']) || 0,
        faturas: faturas.map(f => ({
          numeroParcela: f['Número da Parcela'],
          dataVencimento: f['Data de Vencimento'],
          valorParcela: parseFloat(f['Valor da Parcela']) || 0
        }))
      };
    });
    
    // Filtra cotações abertas
    const cotacoesAbertas = cotacoes.filter(c => c['Status da Cotação'] === 'Aberta' || c['Status da Cotação'] === 'Respondido');
    const chavesCotacoesAbertas = new Set(cotacoesAbertas.map(c => `${c['ID da Cotação']}-${c['Fornecedor']}`));

    const itensCotacao = todosItensCotacao
      .filter(item => {
        const compositeKey = `${item['ID da Cotação']}-${item['Fornecedor']}`;
        const qtd = parseFloat(item['Comprar']);
        return chavesCotacoesAbertas.has(compositeKey) && !isNaN(qtd) && qtd > 0;
      })
      .map(item => ({ // Mapeia para o formato que o script espera
        idCotacao: item['ID da Cotação'],
        fornecedor: item['Fornecedor'],
        subProduto: item['SubProduto'],
        qtdComprar: parseFloat(item['Comprar']) || 0,
        preco: parseFloat(item['Preço']) || 0
      }));

    // Adiciona o CNPJ do fornecedor às cotações (para o select)
    const cotacoesParaFront = cotacoesAbertas.map(c => ({
      idCotacao: c['ID da Cotação'],
      fornecedor: c['Fornecedor'],
      dataAbertura: c['Data Abertura'],
      fornecedorCnpj: c['CNPJ'], // Assumindo que o CotacoesCRUD retorna o CNPJ
      compositeKey: `${c['ID da Cotação']}-${c['Fornecedor']}`
    }));

    const setoresUnicos = [...new Set(regrasRateio.map(r => r['Setor']))];

    res.json({
      success: true,
      dados: {
        notasFiscais: notasFiscais.filter(nf => nf['Status da Conciliação'] === 'Pendente'),
        itensNF,
        dadosGeraisNF,
        cotacoes: cotacoesParaFront,
        itensCotacao,
        mapaConciliacao,
        regrasRateio,
        setoresUnicos
      }
    });

  } catch (err) {
    console.error('Erro ao obter dados da página:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * [NOVO - MIGRADO] Salva o lote de conciliações, rateios e atualizações de status.
 * (Endpoint: POST /conciliacaonf/salvar-lote)
 */
const salvarLoteUnificado = async (req, res) => {
  try {
    // [REMOVIDO] A autenticação agora vem de req.sheets
    const payload = req.body;

    // TODO: Implementar a lógica de salvamento em lote.
    // Esta lógica é complexa e depende de *muitos* outros CRUDs.
    // Você precisará migrar as funções:
    // - CotacoesCRUD.atualizarCotacoesComNF (req.sheets, payload.conciliacoes)
    // - CotacoesCRUD.marcarItensComoCortados (req.sheets, payload.itensCortados)
    // - MapeamentoConciliacaoCRUD.salvarMapeamentos (req.sheets, payload.novosMapeamentos)
    // - ConciliacaoNFCrud.atualizarStatusNF (req.sheets, payload.statusUpdates)
    // - RateioCrud.salvarNovasRegras (req.sheets, payload.rateios)
    // - ConciliacaoNFCrud.salvarContasAPagar (req.sheets, payload.rateios)
    // - ConciliacaoNFCrud.atualizarStatusRateio (req.sheets, payload.rateios)

    console.log('Recebido payload para salvar lote:', JSON.stringify(payload, null, 2));

    // Simulação de sucesso
    res.json({ success: true, message: "Lote salvo com sucesso (LÓGICA PENDENTE DE IMPLEMENTAÇÃO)." });

  } catch (err) {
    console.error('Erro ao salvar lote unificado:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * [NOVO - MIGRADO] Busca um fornecedor pelo CNPJ.
 * (Endpoint: GET /conciliacaonf/fornecedor/:cnpj)
 */
const buscarFornecedorPorCnpj = async (req, res) => {
  try {
    // [REMOVIDO] A autenticação agora vem de req.sheets
    const cnpj = req.params.cnpj;
    
    // Assumindo que seu FornecedoresCRUD tem uma função 'buscarPorCnpj'
    // [CORRIGIDO] Passa req.sheets
    const fornecedor = await fornecedoresCRUD.buscarPorCnpj(req.sheets, cnpj);
    
    res.json({ success: true, dados: fornecedor }); // Retorna o fornecedor ou null/undefined
  } catch (err) {
    console.error('Erro ao buscar fornecedor por CNPJ:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * [NOVO - MIGRADO] Salva um fornecedor (novo ou edição).
 * (Endpoint: POST /conciliacaonf/salvar-fornecedor)
 */
const salvarFornecedorViaNF = async (req, res) => {
  try {
    // [REMOVIDO] A autenticação agora vem de req.sheets
    const dadosFornecedor = req.body;

    // Assumindo que seu FornecedoresCRUD tem uma função 'salvar'
    // [CORRIGIDO] Passa req.sheets
    const resultado = await fornecedoresCRUD.salvar(req.sheets, dadosFornecedor);
    
    res.json({ success: true, message: "Fornecedor salvo com sucesso!", dados: resultado });
  } catch (err) {
    console.error('Erro ao salvar fornecedor:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * [NOVO - MIGRADO] Salva um novo produto principal.
 * (Endpoint: POST /conciliacaonf/salvar-produto-via-nf)
 */
const salvarProdutoViaNF = async (req, res) => {
  try {
    // [REMOVIDO] A autenticação agora vem de req.sheets
    const dadosProduto = req.body;
    
    // Assumindo que seu ProdutosCRUD tem uma função 'salvar'
    // [CORRIGIDO] Passa req.sheets
    const produtoSalvo = await produtosCRUD.salvar(req.sheets, dadosProduto);
    
    res.json({ success: true, produto: produtoSalvo });
  } catch (err) {
    console.error('Erro ao salvar produto:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * [NOVO - MIGRADO] Obtém dados para o modal de cadastro de itens.
 * (Endpoint: GET /conciliacaonf/dados-cadastro-itens/:chaveAcesso)
 */
const obterDadosParaCadastroItens = async (req, res) => {
  try {
    // [REMOVIDO] A autenticação agora vem de req.sheets
    const { chaveAcesso } = req.params;

    const nf = (await crud.getNotasFiscais(req.sheets)).find(n => n['Chave de Acesso'] === chaveAcesso);
    if (!nf) {
      return res.status(404).json({ success: false, message: 'NF não encontrada.' });
    }

    const cnpj = nf['CNPJ Emitente'];
    
    // [CORRIGIDO] Passa req.sheets para todas as chamadas
    const [itensNF, fornecedor, produtos] = await Promise.all([
      crud.getItensNF(req.sheets, chaveAcesso),
      fornecedoresCRUD.buscarPorCnpj(req.sheets, cnpj),
      produtosCRUD.getAll(req.sheets) // Assumindo que ProdutosCRUD tem 'getAll'
    ]);

    res.json({
      success: true,
      dados: {
        itensNF: itensNF.map(item => ({ // Mapeia para o formato simples
          descricaoNF: item['Descrição Produto (NF)'],
          unidadeComercial: item['Unidade Comercial']
        })),
        fornecedor: fornecedor,
        produtos: produtos 
      }
    });

  } catch (err) {
    console.error('Erro ao obter dados para cadastro de itens:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * [NOVO - MIGRADO] Salva um lote de subprodutos.
 * (Endpoint: POST /conciliacaonf/salvar-subprodutos-via-nf)
 */
const salvarSubProdutosViaNF = async (req, res) => {
  try {
    // [REMOVIDO] A autenticação agora vem de req.sheets
    const dadosLote = req.body; // { fornecedorId, subProdutos: [...] }
    
    // Assumindo que seu SubProdutosCRUD tem 'cadastrarMultiplosSubProdutos'
    // [CORRIGIDO] Passa req.sheets
    const resultado = await subProdutosCRUD.cadastrarMultiplosSubProdutos(req.sheets, dadosLote);
    
    res.json({ success: true, message: "Subprodutos salvos com sucesso.", ...resultado });
  } catch (err) {
    console.error('Erro ao salvar subprodutos:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// --- Exportações ---
module.exports = {
  processarXMLs,
  uploadArquivos,
  getDadosPagina,
  salvarLoteUnificado,
  buscarFornecedorPorCnpj,
  salvarFornecedorViaNF,
  salvarProdutoViaNF,
  obterDadosParaCadastroItens,
  salvarSubProdutosViaNF
};