import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(express.json({ limit: '10mb' }));

// Pasta e arquivos de persistência do banco de dados local
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'banco_dados.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'configuracoes.json');

// Garantir que a pasta data exista
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

import { INITIAL_SAMPLE_RECORDS, DEFAULT_SETTINGS } from './src/services/storage';
import {
  formatCepDisplay,
  isValidTrackingCode,
  normalizeCepDigits,
  normalizeTrackingCode,
  parseSroContent,
} from './src/services/sroParser';

// Helper para gravação atômica segura contra corrupção
function atomicWriteJson(filePath: string, data: any) {
  const tempPath = `${filePath}.tmp.${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, filePath);
}

// Inicializar dados se os arquivos não existirem ou estiverem vazios
function readOrInitJson<T>(filePath: string, defaultData: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(defaultData) && Array.isArray(parsed) && parsed.length === 0) {
        atomicWriteJson(filePath, defaultData);
        return defaultData;
      }
      if (parsed) return parsed;
    }
  } catch (err) {
    console.error(`Erro ao ler arquivo ${filePath}:`, err);
  }
  atomicWriteJson(filePath, defaultData);
  return defaultData;
}

// Inicialização imediata ao subir o servidor
readOrInitJson(DB_FILE, INITIAL_SAMPLE_RECORDS);
readOrInitJson(SETTINGS_FILE, DEFAULT_SETTINGS);

// Obter os IPs da rede local da máquina servidora
function getLocalNetworkIps(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const item of iface) {
      if (item.family === 'IPv4' && !item.internal) {
        addresses.push(item.address);
      }
    }
  }
  return addresses;
}

// ==========================================
// ROTAS DE API DO BANCO DE DADOS LOCAL
// ==========================================

// Status e informações de conexão da rede local
app.get('/api/status', (req, res) => {
  const localIps = getLocalNetworkIps();
  res.json({
    status: 'online',
    versao: '3.0-multi-pc',
    unidade: 'CDD SÃO MANUEL',
    servidorLocalIps: localIps,
    port: PORT,
    urlsAcesso: localIps.map(ip => `http://${ip}:${PORT}`),
    armazenamento: 'Banco de Dados Local (JSON/Arquivo Atômico)',
    horarioServidor: new Date().toISOString(),
  });
});

// Listar todos os registros de objetos
app.get('/api/records', (req, res) => {
  try {
    const records = readOrInitJson<any[]>(DB_FILE, []);
    res.json(records);
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao carregar registros', details: err.message });
  }
});

// Criar ou atualizar registro
app.post('/api/records', (req, res) => {
  try {
    const newOrUpdated = req.body;
    if (!newOrUpdated || !newOrUpdated.id) {
      return res.status(400).json({ error: 'Registro inválido ou sem ID' });
    }

    const records = readOrInitJson<any[]>(DB_FILE, []);
    const index = records.findIndex(r => r.id === newOrUpdated.id);

    if (index >= 0) {
      records[index] = { ...records[index], ...newOrUpdated, atualizadoEm: new Date().toISOString() };
    } else {
      records.unshift({
        ...newOrUpdated,
        criadoEm: newOrUpdated.criadoEm || new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      });
    }

    atomicWriteJson(DB_FILE, records);
    res.json({ success: true, record: newOrUpdated });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao salvar registro', details: err.message });
  }
});

// Excluir registro
app.delete('/api/records/:id', (req, res) => {
  try {
    const { id } = req.params;
    const records = readOrInitJson<any[]>(DB_FILE, []);
    const filtered = records.filter(r => r.id !== id);

    if (records.length === filtered.length) {
      return res.status(404).json({ error: 'Registro não encontrado' });
    }

    atomicWriteJson(DB_FILE, filtered);
    res.json({ success: true, message: `Registro ${id} excluído com sucesso.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao excluir registro', details: err.message });
  }
});

// Sincronizar em lote (útil para migração inicial da máquina)
app.post('/api/records/bulk', (req, res) => {
  try {
    const incomingRecords = req.body.records;
    if (!Array.isArray(incomingRecords)) {
      return res.status(400).json({ error: 'Formato inválido. Esperado array de records.' });
    }

    const currentRecords = readOrInitJson<any[]>(DB_FILE, []);
    const recordMap = new Map<string, any>();
    
    // Manter existentes
    currentRecords.forEach(r => recordMap.set(r.id, r));
    // Mesclar novos/atualizados
    incomingRecords.forEach(r => {
      if (r.id) {
        recordMap.set(r.id, r);
      }
    });

    const merged = Array.from(recordMap.values()).sort(
      (a, b) => new Date(b.dataConstatacao || 0).getTime() - new Date(a.dataConstatacao || 0).getTime()
    );

    atomicWriteJson(DB_FILE, merged);
    res.json({ success: true, total: merged.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao sincronizar em lote', details: err.message });
  }
});

// Carregar configurações da unidade
app.get('/api/settings', (req, res) => {
  try {
    const settings = readOrInitJson<any>(SETTINGS_FILE, null);
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao carregar configurações', details: err.message });
  }
});

// Salvar configurações da unidade
app.post('/api/settings', (req, res) => {
  try {
    const newSettings = req.body;
    atomicWriteJson(SETTINGS_FILE, newSettings);
    res.json({ success: true, settings: newSettings });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao salvar configurações', details: err.message });
  }
});

// Backup completo do banco de dados (download direto em JSON)
app.get('/api/backup', (req, res) => {
  try {
    const records = readOrInitJson<any[]>(DB_FILE, []);
    const settings = readOrInitJson<any>(SETTINGS_FILE, {});
    const backup = {
      geradoEm: new Date().toISOString(),
      versao: '3.0',
      totalRegistros: records.length,
      settings,
      records,
    };
    res.setHeader('Content-Disposition', `attachment; filename="backup_cdd_saomanuel_${Date.now()}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(backup, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao gerar backup', details: err.message });
  }
});

// ==========================================
// ROTAS DE CONSULTA REAL AO BUSCA CEP E SRO
// ==========================================

function applySroCorsHeaders(req: express.Request, res: express.Response, next: express.NextFunction) {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.headers['access-control-request-private-network'] === 'true') {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
}

app.use(['/api/sro', '/api/cep'], applySroCorsHeaders);

// Proxy real de consulta de CEP (ViaCEP / BrasilAPI - base DNE Correios)
app.get('/api/cep/:cep', async (req, res) => {
  const cep = normalizeCepDigits(req.params.cep);
  if (!cep) {
    return res.status(400).json({ ok: false, error: 'CEP inválido. Informe 8 dígitos.' });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const viaRes = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (viaRes.ok) {
      const viaData: any = await viaRes.json();
      if (viaData?.erro) {
        return res.status(404).json({
          ok: false,
          cep,
          error: `CEP ${formatCepDisplay(cep)} não encontrado no Busca CEP.`,
        });
      }
      return res.json({
        ok: true,
        cep,
        data: {
          cep,
          cepFormatado: formatCepDisplay(cep),
          logradouro: (viaData.logradouro || '').trim().toUpperCase(),
          bairro: (viaData.bairro || '').trim().toUpperCase(),
          localidade: (viaData.localidade || '').trim().toUpperCase(),
          uf: (viaData.uf || '').trim().toUpperCase(),
        },
      });
    }
  } catch {
    // Segue para fallback BrasilAPI
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const brRes = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (brRes.ok) {
      const brData: any = await brRes.json();
      return res.json({
        ok: true,
        cep,
        data: {
          cep,
          cepFormatado: formatCepDisplay(cep),
          logradouro: (brData.street || '').trim().toUpperCase(),
          bairro: (brData.neighborhood || '').trim().toUpperCase(),
          localidade: (brData.city || '').trim().toUpperCase(),
          uf: (brData.state || '').trim().toUpperCase(),
        },
      });
    }
    if (brRes.status === 404) {
      return res.status(404).json({
        ok: false,
        cep,
        error: `CEP ${formatCepDisplay(cep)} não encontrado no Busca CEP.`,
      });
    }
  } catch {
    // Falha de rede
  }

  return res.status(502).json({
    ok: false,
    cep,
    error: `Não foi possível consultar o serviço Busca CEP para ${formatCepDisplay(cep)}.`,
  });
});

// Consulta real ao SRO Intranet (funciona quando este servidor roda dentro da rede corporativa dos Correios)
app.get('/api/sro/consulta/:codigo', async (req, res) => {
  const codigo = normalizeTrackingCode(req.params.codigo);
  if (!isValidTrackingCode(codigo)) {
    return res.status(400).json({
      ok: false,
      errorCode: 'INVALID_CODE',
      message: 'Código de rastreamento inválido (formato esperado: AA123456789BR).',
    });
  }

  const targetUrl = `https://srointranet.correios.com.br/rastreamento?objeto=${encodeURIComponent(codigo)}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const sroRes = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        Accept: 'text/html,application/json,text/plain,*/*',
        'User-Agent': 'Correios-Controle-Recondicionados/1.0',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (
      sroRes.status === 401 ||
      sroRes.status === 403 ||
      (sroRes.status >= 300 && sroRes.status < 400)
    ) {
      return res.status(401).json({
        ok: false,
        errorCode: 'AUTH_REQUIRED',
        message: 'O SRO Intranet exigiu autenticação corporativa nesta estação.',
        technicalDetail:
          'Sem credenciais armazenadas no servidor: acesse o SRO Intranet com sua sessão autenticada no navegador e cole os dados do objeto na tela de cadastro.',
      });
    }

    if (!sroRes.ok) {
      return res.status(502).json({
        ok: false,
        errorCode: 'INTRANET_UNREACHABLE',
        message: `O SRO Intranet respondeu com HTTP ${sroRes.status}.`,
      });
    }

    const bodyText = await sroRes.text();
    const parsed = parseSroContent(bodyText, codigo);
    if (!parsed.ok) {
      return res.status(parsed.errorCode === 'AUTH_REQUIRED' ? 401 : 404).json(parsed);
    }

    return res.json(parsed);
  } catch (err: any) {
    const detail = err?.cause?.code || err?.message || 'Host inacessível';
    return res.status(503).json({
      ok: false,
      errorCode: 'INTRANET_UNREACHABLE',
      message: 'SRO Intranet inacessível a partir deste servidor.',
      technicalDetail: `Este servidor não tem acesso direto à rede interna dos Correios (${detail}). Utilize a aba autenticada do SRO no navegador da unidade.`,
    });
  }
});

// Parser para conteúdo real copiado/enviado da aba autenticada do SRO Intranet
app.post('/api/sro/parse', (req, res) => {
  const { codigo, conteudo } = req.body || {};
  const result = parseSroContent(conteudo, codigo);
  if (!result.ok) {
    return res.status(422).json(result);
  }
  return res.json(result);
});

// ==========================================
// VITE DEV MIDDLEWARE OU ARQUIVOS ESTÁTICOS
// ==========================================
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`====================================================`);
    console.log(`  CORREIOS - SISTEMA DE CONTROLE E TERMOS DE RECOND. `);
    console.log(`====================================================`);
    console.log(`✓ Servidor Local rodando na porta ${PORT}`);
    console.log(`✓ Acesso neste computador:   http://localhost:${PORT}`);
    
    const ips = getLocalNetworkIps();
    if (ips.length > 0) {
      console.log(`✓ Acesso de outros computadores da unidade:`);
      ips.forEach(ip => console.log(`    -> http://${ip}:${PORT}`));
    }
    console.log(`✓ Banco de dados local: ${DB_FILE}`);
    console.log(`====================================================`);
  });
}

startServer().catch(err => {
  console.error('Falha crítica ao iniciar servidor:', err);
});
