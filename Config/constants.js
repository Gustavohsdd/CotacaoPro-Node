// config/constants.js
// Migrado de Constantes.js e outros arquivos que dependiam delas.

// IDs das planilhas e pastas (lidos do .env)
const ID_PLANILHA_PRINCIPAL = process.env.ID_PLANILHA_PRINCIPAL;
const ID_PLANILHA_NF = process.env.ID_PLANILHA_NF;
const ID_PLANILHA_FINANCEIRO = process.env.ID_PLANILHA_FINANCEIRO;
// Adicionado com base no ConstantesNF.js original
const ID_PASTA_XML = process.env.ID_PASTA_XML;
const ID_PASTA_XML_PROCESSADOS = process.env.ID_PASTA_XML_PROCESSADOS;

// Nomes de Abas Principais
const ABA_FORNECEDORES = "Fornecedores";
const ABA_PRODUTOS = "Produtos";
const ABA_SUBPRODUTOS = "SubProdutos";
const ABA_COTACOES = "Cotacoes";
const ABA_PORTAL = "Portal";
const ABA_CADASTROS = "Cadastros";
const ABA_CONCILIACAO = "Conciliacao";

// Nomes de Abas de NF (da Planilha Externa)
const ABA_NF_NOTAS_FISCAIS = 'NotasFiscais';
const ABA_NF_ITENS = 'ItensNF';
const ABA_NF_FATURAS = 'FaturasNF';
// Adicionado com base no ConstantesNF.js original
const ABA_NF_TRANSPORTE = 'TransporteNF'; 
const ABA_NF_TRIBUTOS_TOTAIS = 'TributosTotaisNF';

// Nomes de Abas Financeiras (da Planilha Externa)
const ABA_FINANCEIRO_REGRAS_RATEIO = 'RegrasRateio';
const ABA_FINANCEIRO_CONTAS_A_PAGAR = 'ContasAPagar';

// Cabeçalhos (essenciais para os CRUDs)

// --- CABEÇALHOS PRINCIPAIS ---
const CABECALHOS_FORNECEDORES = [
  "Data de Cadastro", "ID", "Fornecedor", "CNPJ", "Categoria",
  "Vendedor", "Telefone", "Email", "Dias de Pedido", "Dias de Entrega",
  "Condições de Pagamento", "Dia de Faturamento", "Pedido Mínimo (R$)",
  "Regime Tributário", "Contato Financeiro"
];

const CABECALHOS_PRODUTOS = [
  "Data de Cadastro", "ID", "Produto", "ABC", "Categoria",
  "Tamanho", "UN", "Estoque Minimo", "Status"
];

const CABECALHOS_SUBPRODUTOS = [
  "Data de Cadastro", "ID", "SubProduto", "Produto Vinculado", "Categoria",
  "Fornecedor", "Tamanho", "UN", "Fator", "NCM", "CST", "CFOP", "Status"
];

const CABECALHOS_COTACOES = [
  "ID da Cotação", "Data Abertura", "Produto", "SubProduto", "Categoria",
  "Fornecedor", "Tamanho", "UN", "Fator", "Estoque Mínimo", "Estoque Atual",
  "Preço", "Preço por Fator", "Comprar", "Valor Total", "Economia em Cotação",
  "NCM", "CST", "CFOP", "Empresa Faturada", "Condição de Pagamento", 
  "Status da Cotação", "Status do SubProduto", "Quantidade Recebida", 
  "Divergencia da Nota", "Quantidade na Nota", "Preço da Nota", "Número da Nota"
];

const CABECALHOS_PORTAL = [
  "ID da Cotação",
  "Nome Fornecedor",
  "Token Acesso",
  "Link Acesso",
  "Status",
  "Data Envio",
  "Data Resposta",
  "Texto Personalizado Link"
];

const STATUS_PORTAL = {
  LINK_GERADO: "Link Gerado",
  RESPONDIDO: "Respondido",
  EM_PREENCHIMENTO: "Em Preenchimento",
  FECHADO: "Fechado",
  ERRO_PORTAL: "Erro no Portal",
  EXPIRADO: "Expirado"
};
Object.freeze(STATUS_PORTAL);

const CABECALHOS_CADASTROS = [
  "Empresas",
  "CNPJ",
  "Endereço",
  "Telefone",
  "Email",
  "Contato"
];

// --- CABEÇALHOS NF (Migrados de ConstantesNF.js) ---

const CABECALHOS_NF_NOTAS_FISCAIS = [
  "Chave de Acesso",
  "ID da Cotação (Sistema)",
  "Status da Conciliação",
  "Número NF",
  "Série NF",
  "Data e Hora Emissão",
  "Natureza da Operação",
  "CNPJ Emitente",
  "Nome Emitente",
  "Inscrição Estadual Emitente",
  "Logradouro Emitente",
  "Número End. Emitente",
  "Bairro Emitente",
  "Município Emitente",
  "UF Emitente",
  "CEP Emitente",
  "CNPJ Destinatário",
  "Nome Destinatário",
  "Informações Adicionais",
  "Número do Pedido (Extraído)",
  "Status do Rateio"
];

const CABECALHOS_NF_ITENS = [
  "Chave de Acesso",
  "Número do Item",
  "Código Produto (Forn)",
  "GTIN/EAN (Cód. Barras)",
  "Descrição Produto (NF)",
  "NCM",
  "CFOP",
  "Unidade Comercial",
  "Quantidade Comercial",
  "Valor Unitário Comercial",
  "Valor Total Bruto Item",
  "Valor do Frete (Item)",
  "Valor do Seguro (Item)",
  "Valor do Desconto (Item)",
  "Outras Despesas (Item)",
  "CST/CSOSN (ICMS)",
  "Base de Cálculo (ICMS)",
  "Alíquota (ICMS)",
  "Valor (ICMS)",
  "Valor (ICMS ST)",
  "CST (IPI)",
  "Base de Cálculo (IPI)",
  "Alíquota (IPI)",
  "Valor (IPI)",
  "CST (PIS)",
  "Valor (PIS)",
  "CST (COFINS)",
  "Valor (COFINS)"
];

const CABECALHOS_NF_FATURAS = [
  "Chave de Acesso", "Número da Fatura", "Número da Parcela",
  "Data de Vencimento", "Valor da Parcela"
];

const CABECALHOS_NF_TRANSPORTE = [
  "Chave de Acesso",
  "Modalidade Frete",
  "CNPJ Transportadora",
  "Nome Transportadora",
  "IE Transportadora",
  "Endereço Transportadora",
  "Placa Veículo",
  "Quantidade Volumes",
  "Espécie Volumes",
  "Peso Líquido Total",
  "Peso Bruto Total"
];

const CABECALHOS_NF_TRIBUTOS_TOTAIS = [
  "Chave de Acesso",
  "Total Base Cálculo ICMS",
  "Total Valor ICMS",
  "Total Valor ICMS ST",
  "Total Valor Produtos",
  "Total Valor Frete",
  "Total Valor Seguro",
  "Total Valor Desconto",
  "Total Valor IPI",
  "Total Valor PIS",
  "Total Valor COFINS",
  "Total Outras Despesas",
  "Valor Total da NF"
];

// --- CABEÇALHOS FINANCEIRO (Migrados de ConstantesFinanceiro.js) ---

const CABECALHOS_FINANCEIRO_REGRAS_RATEIO = [
  "Item da Cotação",
  "Setor",
  "Porcentagem"
];

const CABECALHOS_FINANCEIRO_CONTAS_A_PAGAR = [
  "Chave de Acesso", "Número da Fatura", "Número da Parcela", "Resumo dos Itens",
  "Data de Vencimento", "Valor da Parcela", "Setor", "Valor por Setor"
];


// Exporta tudo para ser usado em outros arquivos do Node.js
module.exports = {
  // IDs
  ID_PLANILHA_PRINCIPAL,
  ID_PLANILHA_NF,
  ID_PLANILHA_FINANCEIRO,
  ID_PASTA_XML,
  ID_PASTA_XML_PROCESSADOS,
  
  // Abas Principais
  ABA_FORNECEDORES,
  ABA_PRODUTOS,
  ABA_SUBPRODUTOS,
  ABA_COTACOES,
  ABA_PORTAL,
  ABA_CADASTROS,
  ABA_CONCILIACAO,

  // Abas NF
  ABA_NF_NOTAS_FISCAIS,
  ABA_NF_ITENS,
  ABA_NF_FATURAS,
  ABA_NF_TRANSPORTE,
  ABA_NF_TRIBUTOS_TOTAIS,
  
  // Abas Financeiro
  ABA_FINANCEIRO_REGRAS_RATEIO,
  ABA_FINANCEIRO_CONTAS_A_PAGAR,
  
  // Cabeçalhos Principais
  CABECALHOS_FORNECEDORES,
  CABECALHOS_PRODUTOS,
  CABECALHOS_SUBPRODUTOS,
  CABECALHOS_COTACOES,
  CABECALHOS_PORTAL,
  STATUS_PORTAL,
  CABECALHOS_CADASTROS,

  // Cabeçalhos NF
  CABECALHOS_NF_NOTAS_FISCAIS,
  CABECALHOS_NF_ITENS,
  CABECALHOS_NF_FATURAS,
  CABECALHOS_NF_TRANSPORTE,
  CABECALHOS_NF_TRIBUTOS_TOTAIS,

  // Cabeçalhos Financeiro
  CABECALHOS_FINANCEIRO_REGRAS_RATEIO,
  CABECALHOS_FINANCEIRO_CONTAS_A_PAGAR
};