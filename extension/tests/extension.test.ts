/**
 * Testes automatizados do parser SRO, segurança de manifesto e ponte de comunicação da extensão piloto.
 * Executar com: npx tsx extension/tests/extension.test.ts
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
    'https://recondicionamentodeobjetos.vercel.app/*',
  ]);
  const serialized = JSON.stringify(manifest);
  assert.ok(!serialized.includes('*.vercel.app'), 'Não pode conter wildcard *.vercel.app');
  assert.ok(!serialized.includes('<all_urls>'), 'Não pode conter <all_urls>');

  assert.equal(manifest.content_scripts.length, 2);
  assert.deepEqual(manifest.content_scripts[0].matches, [
    'https://recondicionamentodeobjetos.vercel.app/*',
  ]);
  assert.equal(manifest.content_scripts[0].all_frames, false);
  assert.deepEqual(manifest.content_scripts[1].matches, [
    'https://srointranet.correios.com.br/*',
  ]);
  assert.equal(manifest.content_scripts[1].all_frames, false);
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
      sendMessage: async () => ({
        ok: true,
        authRequired: false,
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
      }),
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

  delete (globalThis as any).chrome;
}

async function main() {
  testManifestAndOrigins();
  testParserRules();
  testExtensionCommunicationValidation();
  await testBackgroundOriginAndSingleTabReuse();
  console.log('Todos os testes da extensão piloto e do parser passaram com sucesso!');
}

main().catch((err) => {
  console.error('Erro nos testes da extensão:', err);
  process.exit(1);
});
