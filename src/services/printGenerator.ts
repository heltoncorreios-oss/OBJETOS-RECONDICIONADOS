import { ObjetoRecord, UnitSettings } from '../types';
import { MESES_POR_EXTENSO } from './pdfGenerator';
import { CORREIOS_LOGO_BASE64 } from '../assets/correiosLogo';

interface PrintHtmlParams {
  title: string;
  filename: string;
  isControleMensal?: boolean;
  record?: ObjetoRecord | null;
  controleRecords?: ObjetoRecord[];
  controleMonth?: number;
  controleYear?: number;
  settings: UnitSettings;
  pdfBlobUrl?: string | null;
}

function escapeHtml(text: string | number | undefined | null): string {
  if (text === undefined || text === null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generatePrintHtml({
  title,
  filename,
  isControleMensal,
  record,
  controleRecords = [],
  controleMonth = 10,
  controleYear = 2026,
  settings,
  pdfBlobUrl,
}: PrintHtmlParams): string {
  const isLandscape = !!isControleMensal;
  const mesExtenso = MESES_POR_EXTENSO[(controleMonth || 10) - 1] || 'OUTUBRO';

  let bodyContent = '';

  if (isControleMensal) {
    // -------------------------------------------------------------
    // CONTROLE DE OBJETOS RECONDICIONADOS (FORMATO PAISAGEM / LANDSCAPE)
    // -------------------------------------------------------------
    const emptyRowsCount = Math.max(6, 12 - controleRecords.length);
    const dataRows = controleRecords.map(r => {
      const dia = r.diaDoMes || (r.dataConstatacao ? r.dataConstatacao.split('-')[2] : '');
      const aiTcCie = r.termoNumero || r.aiTcCie || '';
      return `
        <tr>
          <td class="text-center font-bold">${escapeHtml(dia)}</td>
          <td class="text-center font-bold">${escapeHtml(r.itemNumero)}</td>
          <td class="text-center font-mono font-bold">${escapeHtml(r.codigoRastreamento)}</td>
          <td class="text-center font-mono font-bold">${escapeHtml(r.pesoPostalGramas)}</td>
          <td class="text-center font-mono font-bold">${escapeHtml(r.pesoRealGramas)}</td>
          <td class="text-center uppercase" style="font-size: 9px;">${escapeHtml(r.unidadePostagem)}</td>
          <td class="text-center font-mono font-bold">${escapeHtml(r.unidadeDestinoCodigo)}</td>
          <td class="text-center font-mono font-bold" style="font-size: 9px;">${escapeHtml(aiTcCie)}</td>
          <td class="text-center uppercase" style="font-size: 9px;">${escapeHtml(r.motivoResumo)}</td>
          <td class="text-center font-mono font-bold">${escapeHtml(r.operadorMatricula)}</td>
        </tr>
      `;
    }).join('');

    let emptyRows = '';
    for (let i = 0; i < emptyRowsCount; i++) {
      emptyRows += `
        <tr class="empty-row">
          <td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
        </tr>
      `;
    }

    bodyContent = `
      <div class="landscape-page">
        <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 8px;">
          <img src="${CORREIOS_LOGO_BASE64}" alt="Correios" style="height: 38px; width: 38px; object-fit: contain; border: 1px solid #ddd; padding: 2px; background: #fff;" />
          <div>
            <h1 class="controle-title" style="margin: 0; text-align: left; font-size: 14px; line-height: 1.2;">
              CONTROLE DE OBJETOS RECONDICIONADOS ${escapeHtml(settings.nomeUnidade.toUpperCase())} ${escapeHtml(mesExtenso)} ${escapeHtml(controleYear)}
            </h1>
            <div style="font-size: 9.5px; color: #444; font-family: monospace; margin-top: 2px;">
              EMPRESA BRASILEIRA DE CORREIOS E TEL&Eacute;GRAFOS &middot; DR: ${escapeHtml(settings.dr)} &middot; STO: ${escapeHtml(settings.codigoSto)}
            </div>
          </div>
        </div>

        <table class="table-controle">
          <thead>
            <tr>
              <th rowspan="2" style="width: 32px;">DIA</th>
              <th rowspan="2" style="width: 32px;">ITEM</th>
              <th rowspan="2" style="width: 130px;">RASTREAMENTO</th>
              <th colspan="2" style="width: 100px;">PESO</th>
              <th rowspan="2" style="width: 170px;">POSTAGEM</th>
              <th rowspan="2" style="width: 85px;">DESTINO</th>
              <th rowspan="2" style="width: 80px;">AI/TC/CIE</th>
              <th rowspan="2">MOTIVO</th>
              <th rowspan="2" style="width: 95px;">OPERADOR</th>
            </tr>
            <tr>
              <th style="width: 50px;">POST</th>
              <th style="width: 50px;">REAL</th>
            </tr>
          </thead>
          <tbody>
            ${dataRows}
            ${emptyRows}
            <tr class="total-row">
              <td colspan="9" class="text-center font-bold uppercase" style="font-size: 11px; padding: 6px;">
                TOTAL DE TERMOS DO PERÍODO
              </td>
              <td class="text-center font-bold font-mono" style="font-size: 12px;">
                ${controleRecords.length > 0 ? controleRecords.length : ''}
              </td>
            </tr>
          </tbody>
        </table>

        <div class="controle-signature">
          <div class="sig-line-group">
            <span class="sig-label">GERENTE ${escapeHtml(settings.nomeUnidade.toUpperCase())}</span>
            <div class="sig-rule"></div>
          </div>
          <div class="sig-sub">${escapeHtml(settings.chefeNome)} &middot; Matrícula: ${escapeHtml(settings.chefeMatricula)}</div>
        </div>
      </div>
    `;
  } else if (record) {
    // -------------------------------------------------------------
    // TERMO DE CONSTATAÇÃO INDIVIDUAL (FORMATO RETRATO / PORTRAIT)
    // -------------------------------------------------------------
    bodyContent = renderSingleTermoHtml(record, settings);
  } else if (controleRecords && controleRecords.length > 0) {
    // -------------------------------------------------------------
    // LOTE DE MÚLTIPLOS TERMOS DE CONSTATAÇÃO
    // -------------------------------------------------------------
    bodyContent = controleRecords.map((rec, idx) => `
      <div class="portrait-page ${idx > 0 ? 'page-break' : ''}">
        ${renderSingleTermoHtml(rec, settings)}
      </div>
    `).join('');
  } else {
    bodyContent = `
      <div style="padding: 40px; text-align: center;">
        <h2>Documento pronto para impressão</h2>
        <p>Utilize os controles superiores para imprimir ou visualizar o arquivo PDF completo.</p>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)} - Correios</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
    }
    @page {
      size: ${isLandscape ? 'A4 landscape' : 'A4 portrait'};
      margin: 8mm;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      color: #000;
      background: #e2e8f0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    /* Barra Superior no topo da tela (Oculta na Impressão) */
    .print-header-bar {
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1000;
      background: #00416B;
      color: #ffffff;
      padding: 10px 20px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      border-bottom: 3px solid #FFCC00;
      font-size: 13px;
    }
    .print-header-title {
      font-weight: 800;
      font-size: 15px;
      letter-spacing: -0.02em;
    }
    .print-header-sub {
      font-size: 11px;
      color: #bae6fd;
      margin-top: 2px;
    }
    .print-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-action {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 16px;
      border-radius: 6px;
      font-weight: bold;
      font-size: 12px;
      text-decoration: none;
      border: none;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-primary {
      background: #FFCC00;
      color: #002D56;
      box-shadow: 0 2px 4px rgba(0,0,0,0.15);
    }
    .btn-primary:hover {
      background: #ffe066;
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: rgba(255,255,255,0.15);
      color: #ffffff;
      border: 1px solid rgba(255,255,255,0.3);
    }
    .btn-secondary:hover {
      background: rgba(255,255,255,0.25);
      color: #ffffff;
    }

    /* Container Principal */
    .page-wrapper {
      max-width: ${isLandscape ? '1120px' : '840px'};
      margin: 20px auto;
      padding: 24px;
      background: #ffffff;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      border-radius: 4px;
    }

    @media print {
      body {
        background: #ffffff !important;
      }
      .no-print {
        display: none !important;
      }
      .page-wrapper {
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
      .page-break {
        page-break-before: always;
        break-before: page;
      }
    }

    /* -------------------------------------------------------------
       ESTILOS DO CONTROLE DE OBJETOS RECONDICIONADOS
       ------------------------------------------------------------- */
    .controle-title {
      font-size: 14px;
      font-weight: 900;
      margin: 0 0 12px 0;
      text-transform: uppercase;
      letter-spacing: -0.01em;
      color: #000;
    }
    .table-controle {
      width: 100%;
      border-collapse: collapse;
      border: 2px solid #000;
      font-size: 10px;
    }
    .table-controle th, .table-controle td {
      border: 1px solid #000;
      padding: 4px 3px;
      vertical-align: middle;
    }
    .table-controle th {
      background: #f8fafc;
      font-weight: bold;
      text-align: center;
    }
    .table-controle .empty-row td {
      height: 22px;
    }
    .table-controle .total-row td {
      background: #f8fafc;
      border-top: 2px solid #000;
    }
    .controle-signature {
      margin-top: 22px;
    }
    .sig-line-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .sig-label {
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .sig-rule {
      width: 280px;
      border-bottom: 2px solid #000;
    }
    .sig-sub {
      font-size: 10px;
      color: #333;
      margin-top: 3px;
    }

    /* -------------------------------------------------------------
       ESTILOS DO TERMO DE CONSTATAÇÃO (OFICIAL CORREIOS)
       ------------------------------------------------------------- */
    .termo-container {
      border: 2px solid #000;
      font-size: 11px;
      color: #000;
      background: #fff;
    }
    .termo-row {
      display: flex;
      border-bottom: 2px solid #000;
      width: 100%;
    }
    .termo-row:last-child {
      border-bottom: none;
    }
    .termo-col {
      padding: 3px 6px;
      border-right: 2px solid #000;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .termo-col:last-child {
      border-right: none;
    }
    .lbl {
      font-size: 8.5px;
      font-weight: bold;
      color: #333;
      text-transform: uppercase;
      line-height: 1.1;
      display: block;
    }
    .val {
      font-size: 11px;
      font-weight: bold;
      color: #000;
      line-height: 1.2;
    }
    .checkbox-box {
      width: 13px;
      height: 13px;
      border: 1px solid #000;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 10px;
      margin-right: 6px;
      shrink: 0;
      line-height: 1;
      background: #fff;
    }
    .check-item {
      display: flex;
      align-items: center;
      margin-bottom: 3.5px;
      font-size: 10px;
      line-height: 1.2;
    }
    .stamp-box {
      border: 1px dashed #666;
      height: 105px;
      margin-top: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      color: #999;
    }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .uppercase { text-transform: uppercase; }
  </style>
</head>
<body>
  
  <!-- Barra Superior de Controle de Impressão (Não aparece ao imprimir) -->
  <div class="print-header-bar no-print">
    <div>
      <div class="print-header-title">Correios &middot; ${escapeHtml(title)}</div>
      <div class="print-header-sub">O diálogo de impressão do navegador abrirá automaticamente. Pressione <strong>Ctrl + P</strong> se necessário.</div>
    </div>
    
    <div class="print-actions">
      <button class="btn-action btn-primary" onclick="window.print();">
        &#128438; Imprimir Agora
      </button>
      ${pdfBlobUrl ? `
        <a class="btn-action btn-secondary" href="${pdfBlobUrl}" target="_blank" rel="noopener noreferrer">
          &#128196; Abrir PDF Original
        </a>
      ` : ''}
      <button class="btn-action btn-secondary" onclick="window.close();">
        &#10005; Fechar
      </button>
    </div>
  </div>

  <!-- Página Imprimível com Margens A4 Exatas -->
  <div class="page-wrapper">
    ${bodyContent}
  </div>

  <script>
    // Disparo automático e imediato da janela nativa de impressão
    window.addEventListener('load', function() {
      setTimeout(function() {
        try {
          window.focus();
          window.print();
        } catch(e) {
          console.warn('Erro ao disparar impressão automática:', e);
        }
      }, 350);
    });
  </script>
</body>
</html>`;
}

function renderSingleTermoHtml(record: ObjetoRecord, settings: UnitSettings): string {
  const anom = record.anomalias || {};
  const prov = record.providencias || {};
  const decl = record.declaracao || {};

  return `
    <div class="termo-container">
      
      <!-- Linha 1: Cabeçalho com Logo, Título e Número -->
      <div class="termo-row" style="height: 58px;">
        <div class="termo-col" style="width: 25%; align-items: center; justify-content: center; padding: 2px;">
          <img src="${CORREIOS_LOGO_BASE64}" alt="Correios" style="max-height: 50px; max-width: 90%; object-fit: contain;" />
        </div>
        <div class="termo-col" style="width: 50%; align-items: center; justify-content: center; text-align: center;">
          <div style="font-size: 15px; font-weight: 900; letter-spacing: 0.02em;">TERMO DE CONSTATAC&Atilde;O</div>
        </div>
        <div class="termo-col" style="width: 25%; justify-content: space-between; padding: 4px 6px;">
          <span class="lbl">N&Uacute;MERO</span>
          <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
            <div style="border: 1px solid #000; padding: 2px 8px; font-weight: bold; font-family: monospace; font-size: 13px;">
              ${escapeHtml(record.termoNumero)}
            </div>
            <span style="font-weight: bold;">/</span>
            <div style="border: 1px solid #000; padding: 2px 6px; font-weight: bold; font-size: 11px;">
              ${escapeHtml(record.anoCorrente || 2026)}
            </div>
          </div>
        </div>
      </div>

      <!-- Linha 2: Unidade, DR e Código STO -->
      <div class="termo-row">
        <div class="termo-col" style="width: 58%;">
          <span class="lbl">UNIDADE (ONDE FOI CONSTATADA A IRREGULARIDADE)</span>
          <span class="val uppercase">${escapeHtml(settings.nomeUnidade)}</span>
        </div>
        <div class="termo-col text-center" style="width: 17%;">
          <span class="lbl">DR</span>
          <span class="val uppercase">${escapeHtml(settings.dr)}</span>
        </div>
        <div class="termo-col text-center" style="width: 25%;">
          <span class="lbl">C&Oacute;DIGO STO</span>
          <span class="val font-mono">${escapeHtml(settings.codigoSto)}</span>
        </div>
      </div>

      <!-- Linha 3: Postagem, Número Objeto, Peso e Valor Decl. -->
      <div class="termo-row">
        <div class="termo-col" style="width: 42%;">
          <span class="lbl">UNIDADE DE POSTAGEM</span>
          <span class="val uppercase">${escapeHtml(record.unidadePostagem)}</span>
        </div>
        <div class="termo-col" style="width: 28%;">
          <span class="lbl">N&Uacute;MERO OBJETO</span>
          <span class="val font-mono">${escapeHtml(record.codigoRastreamento)}</span>
        </div>
        <div class="termo-col text-center" style="width: 15%;">
          <span class="lbl">PESO (Gs)</span>
          <span class="val font-mono">${escapeHtml(record.pesoPostalGramas)}</span>
        </div>
        <div class="termo-col text-center" style="width: 15%;">
          <span class="lbl">VALOR DECL.</span>
          <span class="val">${escapeHtml(record.valorDeclaradoTexto || 'NC')}</span>
        </div>
      </div>

      <!-- Linha 4: Nome Remetente -->
      <div class="termo-row">
        <div class="termo-col" style="width: 100%;">
          <span class="lbl">NOME DO REMETENTE</span>
          <span class="val uppercase">${escapeHtml(record.remetenteNome)}</span>
        </div>
      </div>

      <!-- Linha 5: Endereço Remetente -->
      <div class="termo-row">
        <div class="termo-col" style="width: 100%;">
          <span class="lbl">ENDERE&Ccedil;O DO REMETENTE</span>
          <span class="val uppercase">${escapeHtml(record.remetenteEndereco)}</span>
        </div>
      </div>

      <!-- Linha 6: Nome Destinatário -->
      <div class="termo-row">
        <div class="termo-col" style="width: 100%;">
          <span class="lbl">DESTINAT&Aacute;RIO</span>
          <span class="val uppercase">${escapeHtml(record.destinatarioNome)}</span>
        </div>
      </div>

      <!-- Linha 7: Endereço Destinatário -->
      <div class="termo-row">
        <div class="termo-col" style="width: 100%;">
          <span class="lbl">ENDERE&Ccedil;O DO DESTINAT&Aacute;RIO</span>
          <span class="val uppercase">${escapeHtml(record.destinatarioEndereco)}</span>
        </div>
      </div>

      <!-- Linha 8: Anormalidades Constatadas e Carimbo Datador -->
      <div class="termo-row">
        <div class="termo-col" style="width: 75%; padding: 6px 8px;">
          <span class="lbl" style="font-size: 10px; margin-bottom: 5px;">ANORMALIDADES CONSTATADAS</span>
          
          <div class="check-item">
            <span class="checkbox-box">${anom.embalagemMolhadaParcialmente ? 'X' : ''}</span>
            <span>Embalagem molhada parcialmente;</span>
          </div>
          <div class="check-item">
            <span class="checkbox-box">${anom.conteudoBalancando ? 'X' : ''}</span>
            <span>Conte&uacute;do balan&ccedil;ando, com suspeita de quebra;</span>
          </div>
          <div class="check-item">
            <span class="checkbox-box">${anom.conteudoExtravasandoLiquido ? 'X' : ''}</span>
            <span>Conte&uacute;do extravasando l&iacute;quido;</span>
          </div>
          <div class="check-item">
            <span class="checkbox-box">${anom.embalagemDilaceradaMostraConteudo ? 'X' : ''}</span>
            <span>Embalagem dilacerada e com mostra do conte&uacute;do;</span>
          </div>
          <div class="check-item">
            <span class="checkbox-box">${anom.embalagemIntactaSemCondicoes ? 'X' : ''}</span>
            <span>Embalagem intacta, por&eacute;m sem condi&ccedil;&otilde;es de reintegrar ao tr&aacute;fego postal;</span>
          </div>
          <div class="check-item">
            <span class="checkbox-box">${anom.conteudoAvariado ? 'X' : ''}</span>
            <span>Conte&uacute;do avariado;</span>
          </div>
          <div class="check-item">
            <span class="checkbox-box">${anom.embalagemDilaceradaTotalmenteAvariado ? 'X' : ''}</span>
            <span>Embalagem dilacerada e com mostra do conte&uacute;do totalmente avariado;</span>
          </div>
          <div class="check-item">
            <span class="checkbox-box">${anom.embalagemIntactaMolhadaSemCondicoes ? 'X' : ''}</span>
            <span>Embalagem intacta, por&eacute;m molhada e sem condi&ccedil;&otilde;es de reintegra&ccedil;&atilde;o ao tr&aacute;fego postal;</span>
          </div>
          <div class="check-item">
            <span class="checkbox-box">${anom.outrasOcorrencias ? 'X' : ''}</span>
            <span>Outras (especificar): ${anom.outrasOcorrencias ? `<strong>${escapeHtml(anom.outrasOcorrenciasTexto || 'ENCAMINHADA PARA AC SÃO MANUEL')}</strong>` : ''}</span>
          </div>
        </div>

        <div class="termo-col text-center" style="width: 25%; padding: 6px;">
          <span class="lbl" style="font-size: 9px;">CARIMBO DATADOR</span>
          <div class="stamp-box">CARIMBO</div>
        </div>
      </div>

      <!-- Linha 9: Providências -->
      <div class="termo-row">
        <div class="termo-col" style="width: 100%; padding: 6px 8px;">
          <span class="lbl" style="font-size: 10px; margin-bottom: 5px;">PROVID&Ecirc;NCIAS</span>
          
          <div class="check-item">
            <span class="checkbox-box">${prov.tipo === 'encaminhado_destino' ? 'X' : ''}</span>
            <span>Encaminhado ao destino;</span>
          </div>
          <div class="check-item">
            <span class="checkbox-box">${prov.tipo === 'recondicionado_encaminhado' ? 'X' : ''}</span>
            <span>Recondicionado e encaminhado ao destino;</span>
          </div>
          <div class="check-item">
            <span class="checkbox-box">${prov.tipo === 'devolvido_postagem' ? 'X' : ''}</span>
            <span>Devolvido a unidade de postagem [ &nbsp; ] em [ &nbsp; ]/[ &nbsp; ]/[ &nbsp; ];</span>
          </div>
          <div class="check-item">
            <span class="checkbox-box">${prov.tipo === 'auto_irregularidade' ? 'X' : ''}</span>
            <span>Auto de Irregularidade de n&ordm; [ &nbsp; ]/[ &nbsp; ], lavrado em [ &nbsp; ]/[ &nbsp; ]/[ &nbsp; ];</span>
          </div>
          <div class="check-item">
            <span class="checkbox-box">${prov.tipo === 'destruicao' ? 'X' : ''}</span>
            <span>Destru&iacute;do. Emitido o Termo de Destrui&ccedil;&atilde;o n&ordm; [ &nbsp; ]/[ &nbsp; ] em [ &nbsp; ]/[ &nbsp; ]/[ &nbsp; ], conforme anexo, dado a inviabilidade de reintegrar ao tr&aacute;fego postal;</span>
          </div>
          <div class="check-item">
            <span class="checkbox-box">${prov.tipo === 'orgao_seg_operacional' ? 'X' : ''}</span>
            <span>Encaminhado ao &Oacute;rg&atilde;o de Seg. Operacional/DR/ [ &nbsp; ], face [ &nbsp; ];</span>
          </div>
          <div class="check-item">
            <span class="checkbox-box">${prov.tipo === 'outras' ? 'X' : ''}</span>
            <span>Outras (especificar): ${prov.tipo === 'outras' ? `<strong>${escapeHtml(prov.outrasDescricao || 'ENCAMINHADA PARA AC SÃO MANUEL')}</strong>` : ''}</span>
          </div>
        </div>
      </div>

      <!-- Linha 10: Assinaturas e Conferentes -->
      <div class="termo-row" style="flex-direction: column;">
        <div style="display: flex; border-bottom: 1px solid #000; text-align: center; font-size: 9px; font-weight: bold; background: #fafafa;">
          <div style="width: 50%; padding: 2px; border-right: 2px solid #000;">CONFERENTES / TESTEMUNHAS</div>
          <div style="width: 25%; padding: 2px; border-right: 2px solid #000;">MATR&Iacute;CULAS</div>
          <div style="width: 25%; padding: 2px;">ASSINATURAS</div>
        </div>
        <div style="display: flex; border-bottom: 1px solid #000; text-align: center; font-size: 9px; font-weight: bold; background: #fafafa;">
          <div style="width: 50%; padding: 2px; border-right: 2px solid #000;">CHEFE DA UNIDADE</div>
          <div style="width: 25%; padding: 2px; border-right: 2px solid #000;">MATR&Iacute;CULA</div>
          <div style="width: 25%; padding: 2px;">ASSINATURA</div>
        </div>
        <div style="display: flex; text-align: center; font-size: 11px; padding: 4px 0; align-items: center;">
          <div style="width: 50%; border-right: 2px solid #000; font-weight: bold;">${escapeHtml(settings.chefeNome)}</div>
          <div style="width: 25%; border-right: 2px solid #000; font-weight: bold; font-family: monospace;">${escapeHtml(settings.chefeMatricula)}</div>
          <div style="width: 25%;"></div>
        </div>
      </div>

      <!-- Linha 11: Declaração Destinatário / Remetente -->
      <div class="termo-row">
        <div class="termo-col" style="width: 100%; padding: 6px 8px;">
          <span class="lbl" style="font-size: 10px; margin-bottom: 5px;">DECLARA&Ccedil;&Atilde;O DO DESTINAT&Aacute;RIO [ ] OU REMETENTE [ ] :</span>
          
          <div class="check-item">
            <span class="checkbox-box">${decl.tipo === 'aceite_sem_contestacao' ? 'X' : ''}</span>
            <span>Aceito o objeto sem contesta&ccedil;&atilde;o;</span>
          </div>
          <div class="check-item">
            <span class="checkbox-box">${decl.tipo === 'aceite_com_contestacao' ? 'X' : ''}</span>
            <span>Aceito o objeto com contesta&ccedil;&atilde;o, conforme ressalva &agrave; parte;</span>
          </div>
          <div class="check-item">
            <span class="checkbox-box">${decl.tipo === 'recusa' ? 'X' : ''}</span>
            <span>Recuso o objeto, face [ &nbsp; ];</span>
          </div>

          <div style="display: flex; justify-content: space-between; gap: 20px; margin-top: 24px; text-align: center; font-size: 9px;">
            <div style="flex: 1;">
              <div style="border-bottom: 1px solid #000; margin-bottom: 2px;"></div>
              <span>ASSINATURA</span>
            </div>
            <div style="flex: 1;">
              <div style="border-bottom: 1px solid #000; margin-bottom: 2px;"></div>
              <span>DOC. DE IDENTIFICA&Ccedil;&Atilde;O</span>
            </div>
            <div style="flex: 1;">
              <div style="border-bottom: 1px solid #000; margin-bottom: 2px;"></div>
              <span>DATA</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  `;
}
