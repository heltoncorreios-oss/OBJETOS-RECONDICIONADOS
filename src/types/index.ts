/**
 * Tipos e interfaces para o sistema de Controle de Objetos Recondicionados
 * e Termos de Constatação do CDD São Manuel - Correios
 * Baseado rigorosamente nos modelos operacionais da unidade.
 */

export type StatusRegistro = 'rascunho' | 'cadastrado' | 'termo_emitido' | 'reemitido' | 'cancelado';

export interface AnomaliaOpcoes {
  embalagemMolhadaParcialmente: boolean;
  conteudoBalancando: boolean; // com suspeita de quebra
  conteudoExtravasandoLiquido: boolean;
  embalagemDilaceradaMostraConteudo: boolean;
  embalagemIntactaSemCondicoes: boolean; // sem condições de reintegrar ao tráfego postal
  conteudoAvariado: boolean;
  embalagemDilaceradaTotalmenteAvariado: boolean; // com mostra do conteúdo totalmente avariado
  embalagemIntactaMolhadaSemCondicoes: boolean; // intacta, porém molhada e sem condições de reintegração
  outrasOcorrencias: boolean;
  outrasOcorrenciasTexto: string; // Ex: ENCAMINHADA PARA AC SÃO MANUEL
}

export type ProvidenciaTipo = 
  | 'encaminhado_destino'
  | 'recondicionado_encaminhado'
  | 'devolvido_postagem'
  | 'auto_irregularidade'
  | 'destruicao'
  | 'orgao_seg_operacional'
  | 'outras';

export interface ProvidenciasAdotadas {
  tipo: ProvidenciaTipo;
  recondicionadoDescricao?: string;
  devolvidoUnidade?: string;
  devolvidoData?: string;
  autoIrregularidadeNumero?: string;
  autoIrregularidadeLavradoEm?: string;
  termoDestruicaoNumero?: string;
  termoDestruicaoData?: string;
  orgaoSegOperacionalDR?: string; // DR/SPI
  orgaoSegOperacionalFace?: string;
  outrasDescricao?: string;
  observacoesComplementares?: string;
}

export type DeclaracaoTipoCliente = 'destinatario' | 'remetente';

export type DeclaracaoClienteTipo = 
  | 'aceite_sem_contestacao'
  | 'aceite_com_contestacao'
  | 'recusa'
  | 'outra'
  | 'nao_se_aplica';

export interface DeclaracaoCliente {
  tipoCliente: DeclaracaoTipoCliente;
  tipo: DeclaracaoClienteTipo;
  recusaFace?: string;
  especificacaoOutra?: string;
  nomeCliente?: string;
  documentoIdentificacao?: string;
  dataDeclaracao?: string;
}

export interface ObjetoRecord {
  id: string; // UUID único
  // Identificação temporal e de ordem
  dataConstatacao: string; // YYYY-MM-DD
  diaDoMes: number; // 14, 21...
  mesReferencia: number; // 1 - 12
  anoReferencia: number; // YYYY
  itemNumero: number; // Sequencial no dia (1, 2...)
  
  // Identificação do termo e objeto
  termoNumero: string; // Ex: "99" ou "00099"
  anoCorrente: number; // Ex: 2026
  codigoRastreamento: string; // Ex: "AE047884658BR"
  
  // Unidade onde foi constatada a irregularidade e DR / STO
  unidadeConstatacao: string; // Ex: "CDD SÃO MANUEL"
  dr: string; // Ex: "SPI"
  codigoSto: string; // Ex: "18650-972"
  
  // Pesos e Valor Declarado
  pesoPostalGramas: number; // Ex: 760 ou 14730
  pesoRealGramas: number; // Ex: 760 ou 13260
  valorDeclaradoTexto: string; // Ex: "NC" ou "R$ 150,00"
  
  // Unidades operacionais e Destino
  unidadePostagem: string; // Ex: "AC PIRAPOZINHO - PIRAPOZINHO / SP"
  unidadeDestinoCodigo: string; // Ex: "18650065", "18654066", "18654570" (CEP/Código)
  
  // Partes envolvidas
  remetenteNome: string; // Ex: "SUMETAL IND E COM DE BOT E FIVELAS DE METAL LTDA"
  remetenteEndereco: string; // Ex: "RUA GOTARDO PELIN, 206"
  
  destinatarioNome: string; // Ex: "BOA NOVA COMERCIAL AGROPECUÁRIA E PARTICIPAÇÕES"
  destinatarioEndereco: string; // Ex: "RUA XV DE NOVEMBRO 792"
  
  // Anomalias e Motivo para o Controle Mensal
  anomalias: AnomaliaOpcoes;
  motivoResumo: string; // Ex: "MOLHADA", "EMBALAGEM ABERTA" (em maiúsculas como no modelo)
  aiTcCie: string; // Ex: "SEQUENCIA DO SISTEMA" ou "TC 99"
  
  // Providências
  providencias: ProvidenciasAdotadas;
  
  // Responsáveis e operadores
  operadorMatricula: string; // Ex: "81149042"
  operadorNome?: string;
  chefeNome: string; // Ex: "HELTON JULIO SANTOS MANUEL"
  chefeMatricula: string; // Ex: "8.114.904-2"
  
  // Declaração do cliente
  declaracao: DeclaracaoCliente;
  
  // Metadados
  status: StatusRegistro;
  versaoDocumento: number;
  criadoEm: string;
  atualizadoEm: string;
  historicoEmissoes: HistoricoEmissao[];
}

export interface HistoricoEmissao {
  id: string;
  tipoDocumento: 'termo_individual' | 'controle_mensal';
  dataEmissao: string;
  versao: number;
  usuarioOperador: string;
  nomeArquivoGerado: string;
}

export interface UnitSettings {
  // Dados Fixos da Unidade
  nomeUnidade: string; // CDD SÃO MANUEL
  dr: string; // SPI
  codigoSto: string; // 18650-972
  cidade: string; // São Manuel
  uf: string; // SP
  
  // Chefia e Operador
  chefeNome: string; // HELTON JULIO SANTOS MANUEL
  chefeMatricula: string; // 8.114.904-2
  operadorMatriculaPadrao: string; // 81149042
  operadorPadraoNome: string; // Helton
  destinoPadrao: string; // 18650065
  
  // Regras de Numeração
  reiniciarNumeracao: 'anual' | 'mensal' | 'continuo';
  formatoNumeroTermo: 'simples' | 'com_zeros'; // 'simples' -> 99 | 'com_zeros' -> 00099
  numeroSequenciaInicial: number; // Novo campo para definir a sequência inicial
  ultimoSequencialAno: Record<string, number>;
  ultimoSequencialMes: Record<string, number>;
  sequencialGeral: number;
  
  // Opção visual de cor do texto digitado no PDF
  corTextoDigitado: 'vermelho' | 'preto'; // 'vermelho' como na imagem do modelo ou 'preto'
}
