import jsPDF from 'jspdf';
import { ObjetoRecord, UnitSettings } from '../types';
import { CORREIOS_LOGO_BASE64 } from '../assets/correiosLogo';

export const MESES_POR_EXTENSO = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
];

export function getNomeMesExtenso(mes: number): string {
  if (mes >= 1 && mes <= 12) {
    return MESES_POR_EXTENSO[mes - 1];
  }
  return '';
}

/**
 * Desenha o logotipo oficial dos Correios a partir da imagem oficial
 */
function drawCorreiosLogo(doc: jsPDF, x: number, y: number, w = 13, h = 13) {
  try {
    doc.addImage(CORREIOS_LOGO_BASE64, 'JPEG', x, y, w, h);
  } catch (err) {
    console.warn('Erro ao inserir logotipo dos Correios no PDF:', err);
    doc.saveGraphicsState();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text('Correios', x, y + h / 2);
    doc.restoreGraphicsState();
  }
}

/**
 * DOCUMENTO 1: CONTROLE DE OBJETOS RECONDICIONADOS CDD SÃO MANUEL MÊS E ANO CORRENTE
 * Reproduz com exatidão a planilha oficial da imagem image_9a5bd827.png
 */
export function gerarControleMensalPDF(
  mes: number,
  ano: number,
  registros: ObjetoRecord[],
  settings: UnitSettings
): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const mesExtenso = getNomeMesExtenso(mes);
  const totalValidos = registros.filter(r => r.status !== 'cancelado');
  const totalTermos = totalValidos.length;

  // Cor do texto digitado: Preto institucional conforme solicitado pelo usuário
  const userTextColor: [number, number, number] = [0, 0, 0];

  const startX = 10;
  const startY = 12;
  const contentWidth = 277;

  // 1. TÍTULO DO CABEÇALHO COM LOGOTIPO OFICIAL DOS CORREIOS
  const logoSize = 10;
  drawCorreiosLogo(doc, startX, 6, logoSize, logoSize);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  const titleLeft = `CONTROLE DE OBJETOS RECONDICIONADOS  ${settings.nomeUnidade.toUpperCase()} `;
  doc.text(titleLeft, startX + logoSize + 3, startY);

  const titleLeftWidth = doc.getTextWidth(titleLeft);
  doc.text(`${mesExtenso} ${ano}`, startX + logoSize + 3 + titleLeftWidth, startY);

  // 2. GRADE DA TABELA
  // Larguras exatas das 10 colunas (soma = 277mm)
  const colWidths = [9, 9, 36, 15, 15, 48, 24, 22, 71, 28];
  const colX: number[] = [startX];
  for (let i = 0; i < colWidths.length; i++) {
    colX.push(colX[i] + colWidths[i]);
  }

  const tableTopY = startY + 6; // y = 18
  const headerRow1Height = 5.5;
  const headerRow2Height = 5.5;
  const totalHeaderHeight = headerRow1Height + headerRow2Height; // 11mm
  const rowHeight = 6.2;
  const maxRowsPerPage = 17;

  const drawTableHeader = (topY: number) => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);

    doc.rect(startX, topY, contentWidth, totalHeaderHeight);
    doc.line(colX[3], topY + headerRow1Height, colX[5], topY + headerRow1Height);

    doc.line(colX[1], topY, colX[1], topY + totalHeaderHeight);
    doc.text('DIA', (colX[0] + colX[1]) / 2, topY + 7, { align: 'center' });

    doc.line(colX[2], topY, colX[2], topY + totalHeaderHeight);
    doc.text('ITEM', (colX[1] + colX[2]) / 2, topY + 7, { align: 'center' });

    doc.line(colX[3], topY, colX[3], topY + totalHeaderHeight);
    doc.text('RASTREAMENTO', (colX[2] + colX[3]) / 2, topY + 7, { align: 'center' });

    doc.text('PESO', (colX[3] + colX[5]) / 2, topY + 4, { align: 'center' });

    doc.setFontSize(6.5);
    doc.text('POST', (colX[3] + colX[4]) / 2, topY + 9.5, { align: 'center' });
    doc.line(colX[4], topY + headerRow1Height, colX[4], topY + totalHeaderHeight);
    doc.text('REAL', (colX[4] + colX[5]) / 2, topY + 9.5, { align: 'center' });

    doc.setFontSize(7.5);
    doc.line(colX[5], topY, colX[5], topY + totalHeaderHeight);
    doc.text('POSTAGEM', (colX[5] + colX[6]) / 2, topY + 7, { align: 'center' });

    doc.line(colX[6], topY, colX[6], topY + totalHeaderHeight);
    doc.text('DESTINO', (colX[6] + colX[7]) / 2, topY + 7, { align: 'center' });

    doc.line(colX[7], topY, colX[7], topY + totalHeaderHeight);
    doc.text('AI/TC/', (colX[7] + colX[8]) / 2, topY + 5, { align: 'center' });
    doc.text('CIE', (colX[7] + colX[8]) / 2, topY + 8.5, { align: 'center' });

    doc.line(colX[8], topY, colX[8], topY + totalHeaderHeight);
    doc.text('MOTIVO', (colX[8] + colX[9]) / 2, topY + 7, { align: 'center' });

    doc.line(colX[9], topY, colX[9], topY + totalHeaderHeight);
    doc.text('OPERADOR', (colX[9] + colX[10]) / 2, topY + 7, { align: 'center' });
  };

  drawTableHeader(tableTopY);

  let currentY = tableTopY + totalHeaderHeight;

  const sortedRegistros = [...totalValidos].sort((a, b) => {
    if (a.dataConstatacao !== b.dataConstatacao) {
      return a.dataConstatacao.localeCompare(b.dataConstatacao);
    }
    return a.itemNumero - b.itemNumero;
  });

  const rowsToRender = Math.max(maxRowsPerPage, sortedRegistros.length);

  for (let rowIndex = 0; rowIndex < rowsToRender; rowIndex++) {
    if (currentY + rowHeight > 175) {
      doc.addPage();
      currentY = 15;
      drawTableHeader(currentY);
      currentY += totalHeaderHeight;
    }

    const rec = sortedRegistros[rowIndex];

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.rect(startX, currentY, contentWidth, rowHeight);

    for (let c = 1; c < colX.length - 1; c++) {
      doc.line(colX[c], currentY, colX[c], currentY + rowHeight);
    }

    if (rec) {
      const dia = String(rec.diaDoMes || (rec.dataConstatacao ? rec.dataConstatacao.split('-')[2] : ''));
      const pesoPost = String(rec.pesoPostalGramas || '');
      const pesoReal = String(rec.pesoRealGramas || '');
      const destino = rec.unidadeDestinoCodigo || settings.destinoPadrao || '18650065';
      const aiTcCie = rec.termoNumero || rec.aiTcCie || '';
      const motivo = (rec.motivoResumo || 'MOLHADA').toUpperCase();
      const operador = rec.operadorMatricula || settings.operadorMatriculaPadrao || '81149042';

      doc.setTextColor(userTextColor[0], userTextColor[1], userTextColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);

      doc.text(dia, (colX[0] + colX[1]) / 2, currentY + 4.2, { align: 'center' });
      doc.text(String(rec.itemNumero), (colX[1] + colX[2]) / 2, currentY + 4.2, { align: 'center' });

      doc.setFontSize(7.5);
      doc.text(rec.codigoRastreamento, (colX[2] + colX[3]) / 2, currentY + 4.2, { align: 'center' });

      doc.setFontSize(8);
      doc.text(pesoPost, (colX[3] + colX[4]) / 2, currentY + 4.2, { align: 'center' });
      doc.text(pesoReal, (colX[4] + colX[5]) / 2, currentY + 4.2, { align: 'center' });

      doc.setFontSize(6.8);
      const postagemLines = doc.splitTextToSize(rec.unidadePostagem, colWidths[5] - 2);
      if (postagemLines.length > 1) {
        doc.text(postagemLines[0], (colX[5] + colX[6]) / 2, currentY + 2.8, { align: 'center' });
        doc.text(postagemLines[1], (colX[5] + colX[6]) / 2, currentY + 5.3, { align: 'center' });
      } else {
        doc.text(postagemLines[0] || '', (colX[5] + colX[6]) / 2, currentY + 4.2, { align: 'center' });
      }

      doc.setFontSize(8);
      doc.text(destino, (colX[6] + colX[7]) / 2, currentY + 4.2, { align: 'center' });

      doc.setFontSize(8);
      doc.text(aiTcCie, (colX[7] + colX[8]) / 2, currentY + 4.2, { align: 'center' });

      doc.setFontSize(7.5);
      doc.text(motivo, (colX[8] + colX[9]) / 2, currentY + 4.2, { align: 'center' });

      doc.setFontSize(8);
      doc.text(operador, (colX[9] + colX[10]) / 2, currentY + 4.2, { align: 'center' });
    }

    currentY += rowHeight;
  }

  const totalRowHeight = 7.5;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.rect(startX, currentY, contentWidth, totalRowHeight);
  doc.line(colX[9], currentY, colX[9], currentY + totalRowHeight);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text('TOTAL DE TERMOS DO PERÍODO', (colX[0] + colX[9]) / 2, currentY + 5.2, { align: 'center' });

  if (totalTermos > 0) {
    doc.setTextColor(userTextColor[0], userTextColor[1], userTextColor[2]);
    doc.text(String(totalTermos), (colX[9] + colX[10]) / 2, currentY + 5.2, { align: 'center' });
  }

  currentY += totalRowHeight + 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  const gerenteLabel = `GERENTE ${settings.nomeUnidade.toUpperCase()}`;
  doc.text(gerenteLabel, startX, currentY);

  const labelWidth = doc.getTextWidth(gerenteLabel);
  const lineStartX = startX + labelWidth + 4;
  const lineEndX = lineStartX + 85;
  doc.line(lineStartX, currentY, lineEndX, currentY);

  return doc;
}

/**
 * DOCUMENTO 2: TERMO DE CONSTATAÇÃO (Formato Retrato, preenchendo toda a folha A4 com fontes maiores e pretas)
 */
export function renderTermoPage(
  doc: jsPDF,
  registro: ObjetoRecord,
  settings: UnitSettings
): void {
  const userTextColor: [number, number, number] = [0, 0, 0];

  const startX = 10;
  let y = 10;
  const width = 190;
  const pageHeight = 290; // altura útil A4 portrait (297mm)

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);

  // ==========================================
  // LINHA 1: CABEÇALHO (LOGO | TÍTULO | NÚMERO) (~16mm)
  // ==========================================
  const h1 = 16;
  doc.rect(startX, y, width, h1);

  const logoBoxWidth = 48;
  doc.line(startX + logoBoxWidth, y, startX + logoBoxWidth, y + h1);
  const logoSize = 13;
  drawCorreiosLogo(doc, startX + (logoBoxWidth - logoSize) / 2, y + (h1 - logoSize) / 2, logoSize, logoSize);

  const titleBoxWidth = 92;
  const numBoxStartX = startX + logoBoxWidth + titleBoxWidth; // 150
  doc.line(numBoxStartX, y, numBoxStartX, y + h1);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.setTextColor(0, 0, 0);
  doc.text('TERMO DE CONSTATAÇÃO', (startX + logoBoxWidth + numBoxStartX) / 2, y + 10, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('NUMERO', numBoxStartX + 3, y + 4);

  const numBoxInnerX = numBoxStartX + 3;
  const numBoxInnerY = y + 5;
  doc.rect(numBoxInnerX, numBoxInnerY, 20, 8);
  doc.text('/', numBoxInnerX + 22, numBoxInnerY + 5.5);
  doc.rect(numBoxInnerX + 24, numBoxInnerY, 19, 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(userTextColor[0], userTextColor[1], userTextColor[2]);
  doc.text(String(registro.termoNumero || '99'), numBoxInnerX + 10, numBoxInnerY + 5.8, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  doc.text(String(registro.anoCorrente || new Date().getFullYear()), numBoxInnerX + 33.5, numBoxInnerY + 5.2, { align: 'center' });

  y += h1;

  // ==========================================
  // LINHA 2: UNIDADE | DR | CODIGO STO (~10mm)
  // ==========================================
  const h2 = 10;
  doc.rect(startX, y, width, h2);

  const drColStartX = startX + 115;
  const stoColStartX = startX + 142;

  doc.line(drColStartX, y, drColStartX, y + h2);
  doc.line(stoColStartX, y, stoColStartX, y + h2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(0, 0, 0);
  doc.text('UNIDADE (ONDE FOI CONSTATADA A IRREGULARIDADE)', startX + 2, y + 3.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(settings.nomeUnidade.toUpperCase(), startX + 2, y + 7.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text('DR', drColStartX + 2, y + 3.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(settings.dr || 'SPI', (drColStartX + stoColStartX) / 2, y + 7.8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text('CODIGO STO', stoColStartX + 2, y + 3.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(settings.codigoSto || '18650-972', (stoColStartX + startX + width) / 2, y + 7.8, { align: 'center' });

  y += h2;

  // ==========================================
  // LINHA 3: POSTAGEM | OBJETO | PESO | VALOR (~11mm)
  // ==========================================
  const h3 = 11;
  doc.rect(startX, y, width, h3);

  const objColStartX = startX + 82;
  const pesoColStartX = objColStartX + 42;
  const valColStartX = pesoColStartX + 24;

  doc.line(objColStartX, y, objColStartX, y + h3);
  doc.line(pesoColStartX, y, pesoColStartX, y + h3);
  doc.line(valColStartX, y, valColStartX, y + h3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(0, 0, 0);
  doc.text('UNIDADE DE POSTAGEM', startX + 2, y + 3.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(userTextColor[0], userTextColor[1], userTextColor[2]);
  const postLines = doc.splitTextToSize(registro.unidadePostagem || '', 78);
  doc.text(postLines, startX + 2, y + 7.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('NÚMERO OBJETO', objColStartX + 2, y + 3.5);
  doc.setFontSize(9.5);
  doc.setTextColor(userTextColor[0], userTextColor[1], userTextColor[2]);
  doc.text(registro.codigoRastreamento || '', objColStartX + 2, y + 8.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(0, 0, 0);
  doc.text('PESO (Gs)', pesoColStartX + 2, y + 3.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(userTextColor[0], userTextColor[1], userTextColor[2]);
  doc.text(String(registro.pesoPostalGramas || ''), (pesoColStartX + valColStartX) / 2, y + 8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(0, 0, 0);
  doc.text('VALOR DECLARADO', valColStartX + 2, y + 3.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(userTextColor[0], userTextColor[1], userTextColor[2]);
  doc.text(registro.valorDeclaradoTexto || 'NC', (valColStartX + startX + width) / 2, y + 8, { align: 'center' });

  y += h3;

  // ==========================================
  // LINHAS 4 a 7: REMETENTE E DESTINATÁRIO (~9mm cada)
  // ==========================================
  const hFields = 9;

  // Remetente Nome
  doc.rect(startX, y, width, hFields);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(0, 0, 0);
  doc.text('NOME DO REMETENTE', startX + 2, y + 3.2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(userTextColor[0], userTextColor[1], userTextColor[2]);
  doc.text(registro.remetenteNome || '', startX + 2, y + 7);
  y += hFields;

  // Remetente Endereço
  doc.rect(startX, y, width, hFields);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(0, 0, 0);
  doc.text('ENDEREÇO DO REMETENTE', startX + 2, y + 3.2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(userTextColor[0], userTextColor[1], userTextColor[2]);
  doc.text(registro.remetenteEndereco || '', startX + 2, y + 7);
  y += hFields;

  // Destinatário Nome
  doc.rect(startX, y, width, hFields);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(0, 0, 0);
  doc.text('DESTINATÁRIO', startX + 2, y + 3.2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(userTextColor[0], userTextColor[1], userTextColor[2]);
  doc.text(registro.destinatarioNome || '', startX + 2, y + 7);
  y += hFields;

  // Destinatário Endereço
  doc.rect(startX, y, width, hFields);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(0, 0, 0);
  doc.text('ENDEREÇO DO DESTINATÁRIO', startX + 2, y + 3.2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(userTextColor[0], userTextColor[1], userTextColor[2]);
  doc.text(registro.destinatarioEndereco || '', startX + 2, y + 7);
  y += hFields;

  // ==========================================
  // SEÇÃO 8: ANORMALIDADES CONSTATADAS (~64mm)
  // ==========================================
  const h8 = 64;
  doc.rect(startX, y, width, h8);

  const carimboStartX = startX + 140;
  doc.line(carimboStartX, y, carimboStartX, y + h8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  doc.text('CARIMBO DATADOR', (carimboStartX + startX + width) / 2, y + 5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('ANORMALIDADES CONSTATADAS', startX + 2, y + 5);

  const drawModelCheckbox = (boxX: number, boxY: number, checked: boolean) => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(boxX, boxY, 3.5, 3.5);
    if (checked) {
      doc.setLineWidth(0.4);
      doc.line(boxX, boxY, boxX + 3.5, boxY + 3.5);
      doc.line(boxX + 3.5, boxY, boxX, boxY + 3.5);
    }
  };

  const anom = registro.anomalias || {} as ObjetoRecord['anomalias'];
  const anomList = [
    { key: 'embalagemMolhadaParcialmente', label: 'Embalagem molhada parcialmente;' },
    { key: 'conteudoBalancando', label: 'Conteúdo balançando, com suspeita de quebra;' },
    { key: 'conteudoExtravasandoLiquido', label: 'Conteúdo extravasando líquido;' },
    { key: 'embalagemDilaceradaMostraConteudo', label: 'Embalagem dilacerada e com mostra do conteúdo;' },
    { key: 'embalagemIntactaSemCondicoes', label: 'Embalagem intacta, porém sem condições de reintegrar ao tráfego postal;' },
    { key: 'conteudoAvariado', label: 'Conteúdo avariado;' },
    { key: 'embalagemDilaceradaTotalmenteAvariado', label: 'Embalagem dilacerada e com mostra do conteúdo totalmente avariado;' },
    { key: 'embalagemIntactaMolhadaSemCondicoes', label: 'Embalagem intacta, porém molhada e sem condições de reintegração ao tráfego postal;' },
  ];

  let anomY = y + 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);

  anomList.forEach(item => {
    const isChecked = !!anom[item.key as keyof typeof anom];
    drawModelCheckbox(startX + 3, anomY - 2.8, isChecked);
    doc.text(item.label, startX + 9, anomY);
    anomY += 5.8;
  });

  const isOutras = !!anom.outrasOcorrencias;
  drawModelCheckbox(startX + 3, anomY - 2.8, isOutras);
  doc.text('Outras (especificar):', startX + 9, anomY);

  const outrasBoxX = startX + 59;
  const outrasBoxWidth = 78;
  doc.rect(outrasBoxX, anomY - 3.5, outrasBoxWidth, 5);
  if (isOutras && anom.outrasOcorrenciasTexto) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(userTextColor[0], userTextColor[1], userTextColor[2]);
    doc.text(anom.outrasOcorrenciasTexto, outrasBoxX + 2, anomY);
  }

  y += h8;

  // ==========================================
  // SEÇÃO 9: PROVIDÊNCIAS (~52mm)
  // ==========================================
  const h9 = 52;
  doc.rect(startX, y, width, h9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text('PROVIDÊNCIAS', startX + 2, y + 5);

  const prov = registro.providencias || { tipo: 'recondicionado_encaminhado' as const };
  let provY = y + 9.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  drawModelCheckbox(startX + 3, provY - 2.8, prov.tipo === 'encaminhado_destino');
  doc.text('Encaminhado ao destino;', startX + 9, provY);
  provY += 6;

  drawModelCheckbox(startX + 3, provY - 2.8, prov.tipo === 'recondicionado_encaminhado');
  doc.text('Recondicionado e encaminhado ao destino;', startX + 9, provY);
  provY += 6;

  drawModelCheckbox(startX + 3, provY - 2.8, prov.tipo === 'devolvido_postagem');
  doc.text('Devolvido a unidade de postagem', startX + 9, provY);
  doc.rect(startX + 62, provY - 3.5, 38, 4.5);
  doc.text('em', startX + 103, provY);
  doc.rect(startX + 109, provY - 3.5, 8, 4.5);
  doc.text('/', startX + 118, provY);
  doc.rect(startX + 120, provY - 3.5, 8, 4.5);
  doc.text('/', startX + 129, provY);
  doc.rect(startX + 131, provY - 3.5, 14, 4.5);
  doc.text(';', startX + 147, provY);
  provY += 6;

  drawModelCheckbox(startX + 3, provY - 2.8, prov.tipo === 'auto_irregularidade');
  doc.text('Auto de Irregularidade de nº', startX + 9, provY);
  doc.rect(startX + 52, provY - 3.5, 18, 4.5);
  doc.text('/', startX + 71, provY);
  doc.rect(startX + 73, provY - 3.5, 20, 4.5);
  doc.text(', lavrado em', startX + 95, provY);
  doc.rect(startX + 114, provY - 3.5, 8, 4.5);
  doc.text('/', startX + 123, provY);
  doc.rect(startX + 125, provY - 3.5, 8, 4.5);
  doc.text('/', startX + 134, provY);
  doc.rect(startX + 136, provY - 3.5, 14, 4.5);
  doc.text(';', startX + 152, provY);
  provY += 6;

  drawModelCheckbox(startX + 3, provY - 2.8, prov.tipo === 'destruicao');
  doc.text('Destruído. Emitido o Termo de Destruição nº', startX + 9, provY);
  doc.rect(startX + 72, provY - 3.5, 16, 4.5);
  doc.text('/', startX + 89, provY);
  doc.rect(startX + 91, provY - 3.5, 20, 4.5);
  doc.text('em', startX + 113, provY);
  doc.rect(startX + 118, provY - 3.5, 16, 4.5);
  doc.text(', conforme anexo, dado a', startX + 136, provY);
  provY += 4.5;
  doc.text('inviabilidade de reintegrar ao tráfego postal;', startX + 9, provY);
  provY += 6;

  drawModelCheckbox(startX + 3, provY - 2.8, prov.tipo === 'orgao_seg_operacional');
  doc.text('Encaminhado ao Órgão de Seg. Operacional/DR/', startX + 9, provY);
  doc.rect(startX + 83, provY - 3.5, 8, 4.5);
  doc.text(', face', startX + 93, provY);
  doc.rect(startX + 103, provY - 3.5, 75, 4.5);
  doc.text(';', startX + 179, provY);
  provY += 6;

  drawModelCheckbox(startX + 3, provY - 2.8, prov.tipo === 'outras');
  doc.text('Outras (especificar):', startX + 9, provY);
  doc.rect(startX + 55, provY - 3.5, 131, 4.5);
  if (prov.tipo === 'outras' && prov.outrasDescricao) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(userTextColor[0], userTextColor[1], userTextColor[2]);
    doc.text(prov.outrasDescricao, startX + 57, provY);
  }

  y += h9;

  // ==========================================
  // SEÇÃO 10: CONFERENTES / CHEFE (~22mm)
  // ==========================================
  const h10 = 22;
  doc.rect(startX, y, width, h10);

  const colMatStartX = startX + 85;
  const colAssStartX = colMatStartX + 30;

  doc.line(startX, y + 5, startX + width, y + 5);
  doc.line(colMatStartX, y, colMatStartX, y + h10);
  doc.line(colAssStartX, y, colAssStartX, y + h10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(0, 0, 0);
  doc.text('CONFERENTES / TESTEMUNHAS', (startX + colMatStartX) / 2, y + 3.5, { align: 'center' });
  doc.text('MATRÍCULAS', (colMatStartX + colAssStartX) / 2, y + 3.5, { align: 'center' });
  doc.text('ASSINATURAS', (colAssStartX + startX + width) / 2, y + 3.5, { align: 'center' });

  const chefeRowY = y + 11;
  doc.line(startX, chefeRowY, startX + width, chefeRowY);
  doc.line(startX, chefeRowY + 4.5, startX + width, chefeRowY + 4.5);

  doc.text('CHEFE DA UNIDADE', (startX + colMatStartX) / 2, chefeRowY + 3.2, { align: 'center' });
  doc.text('MATRÍCULA', (colMatStartX + colAssStartX) / 2, chefeRowY + 3.2, { align: 'center' });
  doc.text('ASSINATURA', (colAssStartX + startX + width) / 2, chefeRowY + 3.2, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(userTextColor[0], userTextColor[1], userTextColor[2]);
  doc.text(settings.chefeNome || 'HELTON JULIO SANTOS MANUEL', startX + 3, chefeRowY + 8);
  doc.text(settings.chefeMatricula || '8.114.904-2', (colMatStartX + colAssStartX) / 2, chefeRowY + 8, { align: 'center' });

  y += h10;

  // ==========================================
  // SEÇÃO 11: DECLARAÇÃO DO DESTINATÁRIO OU REMETENTE (~remaining to fill page)
  // ==========================================
  const h11 = pageHeight - y - 2;
  doc.rect(startX, y, width, h11);

  const decl = registro.declaracao || { tipoCliente: 'destinatario', tipo: 'aceite_sem_contestacao' as const };
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text('DECLARAÇÃO DO DESTINATÁRIO', startX + 2, y + 5);
  drawModelCheckbox(startX + 62, y + 2.2, decl.tipoCliente === 'destinatario');

  doc.text('OU REMETENTE', startX + 70, y + 5);
  drawModelCheckbox(startX + 100, y + 2.2, decl.tipoCliente === 'remetente');
  doc.text(':', startX + 106, y + 5);

  let declY = y + 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  drawModelCheckbox(startX + 3, declY - 2.8, decl.tipo === 'aceite_sem_contestacao');
  doc.text('Aceito o objeto sem contestação;', startX + 9, declY);
  declY += 6;

  drawModelCheckbox(startX + 3, declY - 2.8, decl.tipo === 'aceite_com_contestacao');
  doc.text('Aceito o objeto com contestação, conforme ressalva à parte;', startX + 9, declY);
  declY += 6;

  drawModelCheckbox(startX + 3, declY - 2.8, decl.tipo === 'recusa');
  doc.text('Recuso o objeto, face', startX + 9, declY);
  doc.rect(startX + 45, declY - 3.8, 137, 5);
  declY += 6;

  drawModelCheckbox(startX + 3, declY - 2.8, decl.tipo === 'outra');
  doc.text('Outra (especificar):', startX + 9, declY);
  doc.rect(startX + 45, declY - 3.8, 137, 5);

  const signRowY = y + h11 - 6;
  doc.line(startX + 10, signRowY, startX + 75, signRowY);
  doc.line(startX + 85, signRowY, startX + 145, signRowY);
  doc.line(startX + 155, signRowY, startX + 185, signRowY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text('ASSINATURA', startX + 42.5, signRowY + 3.5, { align: 'center' });
  doc.text('DOC. DE IDENTIFICAÇÃO', startX + 115, signRowY + 3.5, { align: 'center' });
  doc.text('DATA', startX + 170, signRowY + 3.5, { align: 'center' });
}

/**
 * DOCUMENTO 2: TERMO DE CONSTATAÇÃO (Individual)
 */
export function gerarTermoConstatacaoPDF(
  registro: ObjetoRecord,
  settings: UnitSettings
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  renderTermoPage(doc, registro, settings);
  return doc;
}

/**
 * GERAÇÃO EM LOTE: Todos os termos do período em um único PDF multipáginas
 */
export function gerarLoteTermosPDF(registros: ObjetoRecord[], settings: UnitSettings): jsPDF {
  const validos = registros.filter(r => r.status !== 'cancelado');
  const masterDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  if (validos.length === 0) {
    masterDoc.setFont('helvetica', 'bold');
    masterDoc.text('Nenhum termo de constatação válido no período.', 20, 30);
    return masterDoc;
  }

  validos.forEach((rec, idx) => {
    if (idx > 0) {
      masterDoc.addPage();
    }
    renderTermoPage(masterDoc, rec, settings);
  });

  return masterDoc;
}

export function downloadPDF(doc: jsPDF, filename: string): boolean {
  try {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 2000);
    return true;
  } catch (err) {
    console.warn('Erro ao baixar via link Blob, tentando fallback doc.save:', err);
    try {
      doc.save(filename);
      return true;
    } catch (saveErr) {
      console.error('Falha em doc.save:', saveErr);
      return false;
    }
  }
}

export function getPDFBlobUrl(doc: jsPDF): string {
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}
