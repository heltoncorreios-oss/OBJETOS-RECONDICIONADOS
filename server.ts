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
