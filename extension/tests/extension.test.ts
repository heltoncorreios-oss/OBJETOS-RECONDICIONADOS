/**
 * Testes automatizados do parser SRO, segurança de manifesto e ponte de comunicação da extensão piloto.
 * Executar com: npx tsx extension/tests/extension.test.ts
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatAddressFromCep,
  parseBuscaCepResult,
} from '../../src/services/cepService';
import { parseSroContent, parseWeightToGrams } from '../../src/services/sroParser';
import {
  OFFICIAL_APP_ORIGIN as SERVICE_APP_ORIGIN,
  validateExtensionSroResponse,
} from '../../src/services/sroService';
import { OFFICIAL_APP_ORIGIN } from '../src/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');

function testManifestAndOrigins() {
  assert.equal(OFFICIAL_APP_ORIGIN, 'https://recondicionamentodeobjetos.vercel.app');
  assert.equal(SERVICE_APP_ORIGIN, 'https://recondicionamentodeobjetos.vercel.app');

  const manifestPath = path.join(ROOT_DIR, 'dist-extension', 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'dist-extension/manifest.json deve existir após build:extension');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  assert.equal(manifest.manifest_version, 3);

  // Permissões estritamente necessárias
  assert.deepEqual(manifest.permissions, ['storage', 'tabs']);
  assert.ok(!manifest.permissions.includes('cookies'));
  assert.ok(!manifest.permissions.includes('scripting'));
  assert.ok(!manifest.permissions.includes('nativeMessaging'));

  // Host permissions e content_scripts sem curingas *.vercel.app
  assert.deepEqual(manifest.host_permissions, [
    'https://srointranet.correios.com.br/*',
    'https://buscacepintra.correios.com.br/*',
    'https://recondicionamentodeobjetos.vercel.app/*',
  ]);
  const serialized = JSON.stringify(manifest);
  assert.ok(!serialized.includes('*.vercel.app'), 'Não pode conter wildcard *.vercel.app');
  assert.ok(!serialized.includes('<all_urls>'), 'Não pode conter <all_urls>');

  assert.equal(manifest.content_scripts.length, 4);
  assert.deepEqual(manifest.content_scripts[0].matches, [
    'https://recondicionamentodeobjetos.vercel.app/*',
  ]);
  assert.equal(manifest.content_scripts[0].all_frames, false);
  assert.deepEqual(manifest.content_scripts[1].matches, [
    'https://srointranet.correios.com.br/*',
  ]);
  assert.equal(manifest.content_scripts[1].all_frames, false);
  assert.deepEqual(manifest.content_scripts[2].matches, [
    'https://srointranet.correios.com.br/*',
  ]);
  assert.equal(manifest.content_scripts[2].all_frames, false);
  assert.equal(manifest.content_scripts[2].world, 'MAIN');
  assert.deepEqual(manifest.content_scripts[3].matches, [
    'https://buscacepintra.correios.com.br/*',
  ]);
  assert.equal(manifest.content_scripts[3].all_frames, false);

  const zipPath = path.join(ROOT_DIR, 'public', 'extensao-sro-piloto.zip');
  assert.ok(fs.existsSync(zipPath), 'public/extensao-sro-piloto.zip deve existir após build:extension');
  const zipBuf = fs.readFileSync(zipPath);
  assert.equal(zipBuf.subarray(0, 4).toString('binary'), 'PK\x03\x04', 'ZIP deve iniciar com assinatura PKZIP');
  assert.ok(zipBuf.includes(Buffer.from('manifest.json')), 'ZIP deve conter manifest.json');
  assert.ok(zipBuf.includes(Buffer.from('buscaCepContentScript.js')), 'ZIP deve conter buscaCepContentScript.js');
  assert.ok(zipBuf.includes(Buffer.from('LEIA-ME.txt')), 'ZIP deve conter LEIA-ME.txt');
}

function testParserRules() {
  assert.equal(parseWeightToGrams('2,580 kg'), 2580);
  assert.equal(parseWeightToGrams('0,760 kg'), 760);

  const html = `
    <div>Objeto: AE047884658BR</div>
    <table>
      <tr><td>22/05/2026 14:10</td><td>Objeto entregue ao destinatário</td><td>Peso: 9,999 kg</td></tr>
      <tr><th colspan="2">Postagem (PO)</th></tr>
      <tr><th>Peso</th><td>2,580 kg</td></tr>
      <tr><th>VD</th><td>S</td></tr>
      <tr><th>Unidade</th><td>AGF SANTA CRUZ</td></tr>
      <tr><th>Remetente</th><td>REMETENTE OFICIAL</td></tr>
      <tr><th>CEP Remetente</th><td>04041-000</td></tr>
      <tr><th>Número Logradouro</th><td>134</td></tr>
      <tr><th>Destinatário</th><td>DESTINATARIO OFICIAL</td></tr>
      <tr><th>CEP Destinatário</th><td>18650-065</td></tr>
      <tr><th>Número Logradouro</th><td>792</td></tr>
    </table>
  `;

  const parsed = parseSroContent(html, 'AE047884658BR');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data?.pesoGramas, 2580);
  assert.equal(parsed.data?.valorDeclarado, 'SIM');
  assert.equal(parsed.data?.unidadePostagem, 'AGF SANTA CRUZ');
  assert.equal(parsed.data?.cepRemetente, '04041000');
  assert.equal(parsed.data?.numeroRemetente, '134');
  assert.equal(parsed.data?.cepDestinatario, '18650065');
  assert.equal(parsed.data?.numeroDestinatario, '792');

  const noPo = parseSroContent(
    'Objeto: AE047884658BR\n22/05/2026 10:00 Objeto encaminhado',
    'AE047884658BR'
  );
  assert.equal(noPo.ok, false);
  assert.equal(noPo.errorCode, 'PO_EVENT_NOT_FOUND');

  const authPage = parseSroContent('IdCorreios - Usuário e senha obrigatórios', 'AE047884658BR');
  assert.equal(authPage.ok, false);
  assert.equal(authPage.errorCode, 'AUTH_REQUIRED');

  const notFound = parseSroContent('Objeto não encontrado na base de dados.', 'AE047884658BR');
  assert.equal(notFound.ok, false);
  assert.equal(notFound.errorCode, 'OBJECT_NOT_FOUND');

  // Regressão: placeholder ou exemplo SS123456789BR na tela não pode ser confundido com objeto divergente
  const htmlWithPlaceholder = `
    <textarea placeholder="SS123456789BR"></textarea>
    <div>Exemplo: SS123456789BR</div>
    <div>Objeto: AE139312695BR</div>
    <table>
      <tr><th colspan="2">Postagem (PO)</th></tr>
      <tr><th>Peso</th><td>1,400 kg</td></tr>
      <tr><th>VD</th><td>N</td></tr>
      <tr><th>Unidade</th><td>AC SAO MANUEL</td></tr>
      <tr><th>Remetente</th><td>LOJA MODELO</td></tr>
      <tr><th>CEP Remetente</th><td>04041-000</td></tr>
      <tr><th>Número Logradouro</th><td>100</td></tr>
      <tr><th>Destinatário</th><td>CLIENTE FINAL</td></tr>
      <tr><th>CEP Destinatário</th><td>18650-065</td></tr>
      <tr><th>Número Logradouro</th><td>250</td></tr>
    </table>
  `;
  const parsedPlaceholder = parseSroContent(htmlWithPlaceholder, 'AE139312695BR');
  assert.equal(parsedPlaceholder.ok, true);
  assert.equal(parsedPlaceholder.data?.codigoRastreamento, 'AE139312695BR');
  assert.equal(parsedPlaceholder.data?.pesoGramas, 1400);
  assert.equal(parsedPlaceholder.data?.valorDeclarado, 'NÃO');

  // Regressão: tabela real do SRO Intranet (Det | Data Hora | Local | Situação | Nº evt) + bloco de detalhe da guia "Postado"
  const sroTablePlusPostadoDetail = `
    <div>AE139312695BR (SEDEX) 12/11/2026 17:23:14</div>
    <table>
      <tr><th>Det</th><th>Data Hora</th><th>Local</th><th>Situação</th><th>Nº evt</th></tr>
      <tr><td>Det</td><td>12/11/2026 11:51:16</td><td>AC SAO MANUEL - SAO MANUEL / SP</td><td>Aguardando retirada</td><td>1</td></tr>
      <tr><td>Det</td><td>11/11/2026 17:51:40</td><td>AGF SANTA CRUZ - SAO PAULO / SP</td><td>Postado</td><td>1</td></tr>
      <tr><td>Det</td><td>11/11/2026 12:14:48</td><td>Interface Pré-Postagem Nacional - / BR Aguardando postagem pelo remetente</td><td>Etiqueta emitida</td><td>1</td></tr>
    </table>
    <div>
      <h3>Postado</h3>
      <div>11/11/2026 17:51:40</div>
      <div>Unidade: AGF SANTA CRUZ - SAO PAULO / SP</div>
      <div>Peso: 2,580 kg</div>
      <div>VD: S</div>
      <div>Remetente: REMETENTE REAL</div>
      <div>CEP Remetente: 04041-000</div>
      <div>Número Logradouro: 134</div>
      <div>Destinatário: DESTINATARIO REAL</div>
      <div>CEP Destinatário: 18650-065</div>
      <div>Número Logradouro: 792</div>
    </div>
  `;
  const parsedPostadoDet = parseSroContent(sroTablePlusPostadoDetail, 'AE139312695BR');
  assert.equal(parsedPostadoDet.ok, true);
  assert.equal(parsedPostadoDet.data?.pesoGramas, 2580);
  assert.equal(parsedPostadoDet.data?.valorDeclarado, 'SIM');
  assert.equal(parsedPostadoDet.data?.unidadePostagem, 'AGF SANTA CRUZ - SAO PAULO / SP');
  assert.equal(parsedPostadoDet.data?.cepRemetente, '04041000');
  assert.equal(parsedPostadoDet.data?.numeroRemetente, '134');
  assert.equal(parsedPostadoDet.data?.cepDestinatario, '18650065');
  assert.equal(parsedPostadoDet.data?.numeroDestinatario, '792');

  // Regressão: tabela resumida apenas com a linha "Postado" sem detalhes de PO NÃO pode retornar ok:true vazio
  const summaryOnlyHtml = `
    <div>AE139312695BR (SEDEX) 12/11/2026 17:23:14</div>
    <table>
      <tr><th>Det</th><th>Data Hora</th><th>Local</th><th>Situação</th><th>Nº evt</th></tr>
      <tr><td>Det</td><td>11/11/2026 17:51:40</td><td>AGF SANTA CRUZ - SAO PAULO / SP</td><td>Postado</td><td>1</td></tr>
    </table>
  `;
  const parsedSummaryOnly = parseSroContent(summaryOnlyHtml, 'AE139312695BR');
  assert.equal(parsedSummaryOnly.ok, false);
  assert.equal(parsedSummaryOnly.errorCode, 'PO_EVENT_NOT_FOUND');

  // Regressão: HTML com <td>Peso:</td><td>...</td> e seção Remetente/Destinatário com "Nome:"
  const colonInTdHtml = `
    <div>Objeto: AE139312695BR</div>
    <table>
      <tr><th colspan="2">Situação: Postado</th></tr>
      <tr><td><b>Peso:</b></td><td>2,580 kg</td></tr>
      <tr><td><b>VD:</b></td><td>S</td></tr>
      <tr><td><b>Unidade:</b></td><td>AGF SANTA CRUZ</td></tr>
      <tr><td colspan="2"><b>Remetente</b></td></tr>
      <tr><td>Nome:</td><td>EMPRESA REMETENTE</td></tr>
      <tr><td>CEP:</td><td>04041-000</td></tr>
      <tr><td>Número:</td><td>134</td></tr>
      <tr><td colspan="2"><b>Destinatário</b></td></tr>
      <tr><td>Nome:</td><td>PESSOA DESTINATARIA</td></tr>
      <tr><td>CEP:</td><td>18650-065</td></tr>
      <tr><td>Número:</td><td>792</td></tr>
    </table>
  `;
  const parsedColonTd = parseSroContent(colonInTdHtml, 'AE139312695BR');
  assert.equal(parsedColonTd.ok, true);
  assert.equal(parsedColonTd.data?.pesoGramas, 2580);
  assert.equal(parsedColonTd.data?.valorDeclarado, 'SIM');
  assert.equal(parsedColonTd.data?.unidadePostagem, 'AGF SANTA CRUZ');
  assert.equal(parsedColonTd.data?.remetenteNome, 'EMPRESA REMETENTE');
  assert.equal(parsedColonTd.data?.cepRemetente, '04041000');
  assert.equal(parsedColonTd.data?.numeroRemetente, '134');
  assert.equal(parsedColonTd.data?.destinatarioNome, 'PESSOA DESTINATARIA');
  assert.equal(parsedColonTd.data?.cepDestinatario, '18650065');
  assert.equal(parsedColonTd.data?.numeroDestinatario, '792');

  // Regressão: layout exato da tela real "AE139312695BR - Postagem (PO)" do SRO Intranet
  const realSroPoHtml = `
    <table>
      <tr><th colspan="2">AE139312695BR - Postagem (PO)</th></tr>
      <tr><td>Usuário / Estação:</td><td>00000299 / 299</td></tr>
      <tr><td>Transmitido por:</td><td>70707096 / Interface Correios Atende</td></tr>
      <tr><td>Unidade:</td><td>04035971 / AGF SANTA CRUZ</td></tr>
      <tr><td>Município:</td><td>SAO PAULO / SP</td></tr>
      <tr><td>Criado em:</td><td>11/11/2026 17:51:40</td></tr>
      <tr><td>CEP Destinatário:</td><td>18652442 &nbsp; Destinatário: MARINALVA CRISTINA CRESPILHO TARZONI</td></tr>
      <tr><td>Número Logradouro:</td><td>100</td></tr>
      <tr><td>CEP Remetente:</td><td>04041000 &nbsp; Remetente: PHARMACOM SOLUCOES PHARMACEUTICAS</td></tr>
      <tr><td>Número Logradouro:</td><td>134</td></tr>
      <tr><td>AR:</td><td>N &nbsp; TIPO: Sem AR &nbsp; MP: N &nbsp; VD: S &nbsp; EE: N &nbsp; EV: N</td></tr>
      <tr><td>Código de Serviço:</td><td>03220 - SEDEX CONTRATO AG &nbsp; Peso: 2,580 kg</td></tr>
    </table>
  `;
  const parsedRealPo = parseSroContent(realSroPoHtml, 'AE139312695BR');
  assert.equal(parsedRealPo.ok, true);
  assert.equal(parsedRealPo.data?.unidadePostagem, '04035971 / AGF SANTA CRUZ');
  assert.equal(parsedRealPo.data?.cepDestinatario, '18652442');
  assert.equal(parsedRealPo.data?.destinatarioNome, 'MARINALVA CRISTINA CRESPILHO TARZONI');
  assert.equal(parsedRealPo.data?.numeroDestinatario, '100');
  assert.equal(parsedRealPo.data?.cepRemetente, '04041000');
  assert.equal(parsedRealPo.data?.remetenteNome, 'PHARMACOM SOLUCOES PHARMACEUTICAS');
  assert.equal(parsedRealPo.data?.numeroRemetente, '134');
  assert.equal(parsedRealPo.data?.valorDeclarado, 'SIM');
  assert.equal(parsedRealPo.data?.pesoGramas, 2580);

  // Regressão crítica: HTML identado com quebras de linha (\n) entre <td>Rótulo:</td>\n<td>Valor</td>
  const multilineRealPoHtml = `
    <table>
      <tr>
        <th colspan="2">AE139312695BR - Postagem (PO)</th>
      </tr>
      <tr>
        <td>Unidade:</td>
        <td>04035971 / AGF SANTA CRUZ</td>
      </tr>
      <tr>
        <td>CEP Destinatário:</td>
        <td>18652442 &nbsp; Destinatário: MARINALVA CRISTINA CRESPILHO TARZONI</td>
      </tr>
      <tr>
        <td>Número Logradouro:</td>
        <td>100</td>
      </tr>
      <tr>
        <td>CEP Remetente:</td>
        <td>04041000 &nbsp; Remetente: PHARMACOM SOLUCOES PHARMACEUTICAS</td>
      </tr>
      <tr>
        <td>Número Logradouro:</td>
        <td>134</td>
      </tr>
      <tr>
        <td>AR:</td>
        <td>N &nbsp; VD: S</td>
      </tr>
      <tr>
        <td>Código de Serviço:</td>
        <td>03220 - SEDEX CONTRATO AG &nbsp; Peso: 2,580 kg</td>
      </tr>
    </table>
  `;
  const parsedMultiline = parseSroContent(multilineRealPoHtml, 'AE139312695BR');
  assert.equal(parsedMultiline.ok, true);
  assert.equal(parsedMultiline.data?.unidadePostagem, '04035971 / AGF SANTA CRUZ');
  assert.equal(parsedMultiline.data?.cepDestinatario, '18652442');
  assert.equal(parsedMultiline.data?.destinatarioNome, 'MARINALVA CRISTINA CRESPILHO TARZONI');
  assert.equal(parsedMultiline.data?.numeroDestinatario, '100');
  assert.equal(parsedMultiline.data?.cepRemetente, '04041000');
  assert.equal(parsedMultiline.data?.remetenteNome, 'PHARMACOM SOLUCOES PHARMACEUTICAS');
  assert.equal(parsedMultiline.data?.numeroRemetente, '134');
  assert.equal(parsedMultiline.data?.valorDeclarado, 'SIM');
  assert.equal(parsedMultiline.data?.pesoGramas, 2580);
}

function testBuscaCepIntranetParser() {
  const tabelaBuscaCep = `
    <table id="resultado-DNEC">
      <thead>
        <tr>
          <th>Logradouro/Nome</th>
          <th>Bairro/Distrito</th>
          <th>Localidade/UF</th>
          <th>CEP</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td data-th="Logradouro/Nome">Rua Afonso Celso - até 500 - lado par</td>
          <td data-th="Bairro/Distrito">Vila Mariana</td>
          <td data-th="Localidade/UF">São Paulo/SP</td>
          <td data-th="CEP">04041-000</td>
        </tr>
      </tbody>
    </table>
  `;

  const okRes = parseBuscaCepResult(tabelaBuscaCep, '04041000');
  assert.equal(okRes.ok, true);
  assert.equal(okRes.data?.logradouro, 'RUA AFONSO CELSO');
  assert.equal(okRes.data?.bairro, 'VILA MARIANA');
  assert.equal(okRes.data?.localidade, 'SÃO PAULO');
  assert.equal(okRes.data?.uf, 'SP');
  assert.equal(okRes.data?.cepFormatado, '04041-000');
  assert.equal(
    formatAddressFromCep(okRes.data, '134'),
    'RUA AFONSO CELSO, 134 - VILA MARIANA, SÃO PAULO/SP'
  );

  // Não pode aceitar CEP divergente
  const mismatchRes = parseBuscaCepResult(tabelaBuscaCep, '18652442');
  assert.equal(mismatchRes.ok, false);

  const notFoundRes = parseBuscaCepResult('<div>Dados não encontrados</div>', '99999999');
  assert.equal(notFoundRes.ok, false);
  assert.equal(notFoundRes.notFound, true);
}

function testExtensionCommunicationValidation() {
  // 1. Retorno válido e correlacionado
  const okRes = validateExtensionSroResponse(
    {
      ok: true,
      requestId: 'req_12345678',
      extensionVersion: '1.0.0',
      data: {
        codigoRastreamento: 'AE047884658BR',
        eventoEncontrado: true,
        pesoGramas: 2580,
        valorDeclarado: 'NÃO',
        unidadePostagem: 'AGF SANTA CRUZ',
        remetenteNome: 'REMETENTE A',
        cepRemetente: '04041000',
        numeroRemetente: '134',
        destinatarioNome: 'DESTINATARIO B',
        cepDestinatario: '18650065',
        numeroDestinatario: '792',
      },
    },
    'req_12345678',
    'AE047884658BR'
  );
  assert.equal(okRes.valid, true);
  if (okRes.valid) {
    assert.equal(okRes.data.pesoGramas, 2580);
    assert.equal(okRes.data.valorDeclarado, 'NÃO');
  }

  // 2. Descarta resposta de requestId antigo/divergente
  const wrongReq = validateExtensionSroResponse(
    { ok: true, requestId: 'req_antigo_000', data: { codigoRastreamento: 'AE047884658BR', eventoEncontrado: true } },
    'req_12345678',
    'AE047884658BR'
  );
  assert.equal(wrongReq.valid, false);
  if (wrongReq.valid === false) {
    assert.equal(wrongReq.errorCode, 'OBJECT_NOT_FOUND');
  }

  // 3. Descarta resposta pertencente a outro objeto (proteção anti-mistura)
  const wrongObj = validateExtensionSroResponse(
    {
      ok: true,
      requestId: 'req_12345678',
      data: { codigoRastreamento: 'XX999999999BR', eventoEncontrado: true },
    },
    'req_12345678',
    'AE047884658BR'
  );
  assert.equal(wrongObj.valid, false);
  if (wrongObj.valid === false) {
    assert.equal(wrongObj.errorCode, 'OBJECT_NOT_FOUND');
  }

  // 4. Propaga erro de sessão expirada
  const authErr = validateExtensionSroResponse(
    {
      ok: false,
      requestId: 'req_12345678',
      errorCode: 'AUTH_REQUIRED',
      message: 'Sessão expirada.',
    },
    'req_12345678',
    'AE047884658BR'
  );
  assert.equal(authErr.valid, false);
  if (authErr.valid === false) {
    assert.equal(authErr.errorCode, 'AUTH_REQUIRED');
  }
}

async function testBackgroundOriginAndSingleTabReuse() {
  const listeners: any[] = [];
  const createdTabs: any[] = [];
  const updatedTabs: any[] = [];
  const existingTab = {
    id: 42,
    url: 'https://srointranet.correios.com.br/rastreamento',
    status: 'complete',
  };

  let mockDomRes: any = {
    ok: true,
    authRequired: false,
    hasTrackingMatch: true,
    notFound: false,
    text: `
      Objeto: AE047884658BR
      Postagem (PO)
      Peso: 1,250 kg
      VD: S
      Unidade: AGF TESTE
      Remetente: REM A
      CEP Remetente: 04041-000
      Número Logradouro: 10
      Destinatário: DEST B
      CEP Destinatário: 18650-065
      Número Logradouro: 20
    `,
  };

  (globalThis as any).chrome = {
    runtime: {
      onMessage: {
        addListener: (fn: any) => listeners.push(fn),
      },
    },
    tabs: {
      onRemoved: { addListener: () => {} },
      onUpdated: { addListener: () => {}, removeListener: () => {} },
      query: async () => [existingTab],
      get: async (id: number) => (id === 42 ? existingTab : null),
      update: async (id: number, props: any) => {
        updatedTabs.push({ id, ...props });
        return { ...existingTab, ...props };
      },
      create: async (props: any) => {
        createdTabs.push(props);
        return { id: 99, ...props };
      },
      sendMessage: async () => mockDomRes,
    },
    storage: {
      local: { get: async () => ({}), set: async () => {} },
      session: { get: async () => ({}), set: async () => {} },
    },
  };

  await import('../src/background');
  assert.equal(listeners.length, 1);
  const handler = listeners[0];

  // Origem não autorizada deve ser bloqueada
  let unauthorizedResponse: any = null;
  handler(
    { type: 'SRO_QUERY_REQUEST', requestId: 'req_12345678', trackingCode: 'AE047884658BR' },
    { origin: 'https://evil-app.vercel.app', frameId: 0, tab: { url: 'https://evil-app.vercel.app/' } },
    (res: any) => {
      unauthorizedResponse = res;
    }
  );
  assert.equal(unauthorizedResponse?.ok, false);
  assert.equal(unauthorizedResponse?.errorCode, 'UNAUTHORIZED_ORIGIN');

  // Origem oficial deve reutilizar aba 42 sem abrir nova aba
  const validResponse: any = await new Promise((resolve) => {
    handler(
      { type: 'SRO_QUERY_REQUEST', requestId: 'req_12345678', trackingCode: 'AE047884658BR' },
      {
        origin: 'https://recondicionamentodeobjetos.vercel.app',
        frameId: 0,
        tab: { url: 'https://recondicionamentodeobjetos.vercel.app/' },
      },
      resolve
    );
  });

  assert.equal(validResponse.ok, true);
  assert.equal(validResponse.data.pesoGramas, 1250);
  assert.equal(validResponse.data.valorDeclarado, 'SIM');
  assert.equal(updatedTabs.length, 1);
  assert.equal(updatedTabs[0].id, 42);
  assert.equal(createdTabs.length, 0, 'Deve reutilizar a aba existente do SRO sem criar nova aba');

  let sendMessageOverride: (() => Promise<any>) | null = null;
  (globalThis as any).chrome.tabs.sendMessage = async () => {
    if (sendMessageOverride) return sendMessageOverride();
    return mockDomRes;
  };

  // Tela inicial do SRO ainda sem resultado para o objeto consultado não deve acusar OBJECT_NOT_FOUND de placeholder
  mockDomRes = {
    ok: true,
    authRequired: false,
    hasTrackingMatch: false,
    notFound: false,
    inputFound: false,
    searchTriggered: false,
    html: '<textarea placeholder="SS123456789BR"></textarea><div>Informe o código do objeto</div>',
    text: 'Informe o código do objeto SS123456789BR',
  };
  const unloadedScreenResponse: any = await new Promise((resolve) => {
    handler(
      { type: 'SRO_QUERY_REQUEST', requestId: 'req_99999999', trackingCode: 'AE139312695BR' },
      {
        origin: 'https://recondicionamentodeobjetos.vercel.app',
        frameId: 0,
        tab: { url: 'https://recondicionamentodeobjetos.vercel.app/' },
      },
      resolve
    );
  });
  assert.equal(unloadedScreenResponse.ok, false);
  assert.equal(unloadedScreenResponse.errorCode, 'INTRANET_UNREACHABLE');
  assert.ok(unloadedScreenResponse.message.includes('campo de pesquisa'));

  // Recuperação quando o clique de pesquisa do SRO recarrega a página (message channel closed)
  let navAttempts = 0;
  sendMessageOverride = async () => {
    navAttempts += 1;
    if (navAttempts === 1) {
      throw new Error('The message channel closed before a response was received.');
    }
    return {
      ok: true,
      authRequired: false,
      hasTrackingMatch: true,
      notFound: false,
      text: `
        Objeto: OY932426593BR
        Postagem (PO)
        Peso: 0,850 kg
        VD: N
        Unidade: AC SAO MANUEL
        Remetente: REM C
        CEP Remetente: 04041-000
        Número Logradouro: 50
        Destinatário: DEST D
        CEP Destinatário: 18650-065
        Número Logradouro: 80
      `,
    };
  };

  const recoveredResponse: any = await new Promise((resolve) => {
    handler(
      { type: 'SRO_QUERY_REQUEST', requestId: 'req_nav_recover1', trackingCode: 'OY932426593BR' },
      {
        origin: 'https://recondicionamentodeobjetos.vercel.app',
        frameId: 0,
        tab: { url: 'https://recondicionamentodeobjetos.vercel.app/' },
      },
      resolve
    );
  });
  assert.equal(recoveredResponse.ok, true);
  assert.equal(recoveredResponse.data.codigoRastreamento, 'OY932426593BR');
  assert.equal(recoveredResponse.data.pesoGramas, 850);
  assert.equal(navAttempts, 2);

  // Consultas concorrentes ao Busca CEP Intranet devem ser serializadas em uma única aba sem colisão
  const buscaCepTab = {
    id: 77,
    url: 'https://buscacepintra.correios.com.br/app/endereco/index.php',
    status: 'complete',
  };
  (globalThis as any).chrome.tabs.query = async (q: any) => {
    if (String(q?.url || '').includes('buscacepintra')) return [buscaCepTab];
    return [existingTab];
  };
  (globalThis as any).chrome.tabs.get = async (id: number) => {
    if (id === 77) return buscaCepTab;
    return id === 42 ? existingTab : null;
  };
  sendMessageOverride = null;
  (globalThis as any).chrome.tabs.sendMessage = async (_tabId: number, msg: any) => {
    if (msg.type === 'BUSCA_CEP_EXTRACT_DOM') {
      await new Promise((r) => setTimeout(r, 20));
      if (msg.cep === '04041000') {
        return {
          ok: true,
          html: `
            <table id="resultado-DNEC">
              <tr><th>Logradouro/Nome</th><th>Bairro/Distrito</th><th>Localidade/UF</th><th>CEP</th></tr>
              <tr><td>Rua Domingos de Morais</td><td>Vila Mariana</td><td>São Paulo/SP</td><td>04041-000</td></tr>
            </table>
          `,
          text: '',
        };
      }
      return {
        ok: true,
        html: `
          <table id="resultado-DNEC">
            <tr><th>Logradouro/Nome</th><th>Bairro/Distrito</th><th>Localidade/UF</th><th>CEP</th></tr>
            <tr><td>Rua José Vicente da Costa</td><td>Cohab III</td><td>São Manuel/SP</td><td>18652-442</td></tr>
          </table>
        `,
        text: '',
      };
    }
    return mockDomRes;
  };

  const [remCepRes, destCepRes] = await Promise.all([
    new Promise<any>((resolve) =>
      handler(
        { type: 'BUSCA_CEP_REQUEST', requestId: 'cep_req_1111', cep: '04041000' },
        {
          origin: 'https://recondicionamentodeobjetos.vercel.app',
          frameId: 0,
          tab: { url: 'https://recondicionamentodeobjetos.vercel.app/' },
        },
        resolve
      )
    ),
    new Promise<any>((resolve) =>
      handler(
        { type: 'BUSCA_CEP_REQUEST', requestId: 'cep_req_2222', cep: '18652442' },
        {
          origin: 'https://recondicionamentodeobjetos.vercel.app',
          frameId: 0,
          tab: { url: 'https://recondicionamentodeobjetos.vercel.app/' },
        },
        resolve
      )
    ),
  ]);

  assert.equal(remCepRes.ok, true);
  assert.equal(remCepRes.requestId, 'cep_req_1111');
  assert.equal(remCepRes.data.logradouro, 'RUA DOMINGOS DE MORAIS');
  assert.equal(destCepRes.ok, true);
  assert.equal(destCepRes.requestId, 'cep_req_2222');
  assert.equal(destCepRes.data.localidade, 'SÃO MANUEL');
  assert.equal(createdTabs.length, 0, 'Busca CEP Intranet também deve reutilizar uma única aba');

  delete (globalThis as any).chrome;
}

async function main() {
  testManifestAndOrigins();
  testParserRules();
  testBuscaCepIntranetParser();
  testExtensionCommunicationValidation();
  await testBackgroundOriginAndSingleTabReuse();
  console.log('Todos os testes da extensão piloto e do parser passaram com sucesso!');
}

main().catch((err) => {
  console.error('Erro nos testes da extensão:', err);
  process.exit(1);
});
