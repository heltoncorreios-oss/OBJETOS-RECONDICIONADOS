/**
 * Configurações de segurança e origem oficial da extensão piloto Manifest V3.
 *
 * IMPORTANTE:
 * - Somente a origem oficial de produção é autorizada.
 * - Não utilizar curingas (*.vercel.app) nem http://.
 * - No piloto, a ponte é feita via appBridge.ts; externally_connectable fica
 *   reservado apenas para futura distribuição com ID fixo em loja corporativa.
 */

export const OFFICIAL_APP_ORIGIN = 'https://recondicionamentodeobjetos.vercel.app';
export const OFFICIAL_APP_URL_PREFIX = `${OFFICIAL_APP_ORIGIN}/`;

export const SRO_INTRANET_ORIGIN = 'https://srointranet.correios.com.br';
export const SRO_INTRANET_BASE_URL = `${SRO_INTRANET_ORIGIN}/rastreamento`;

export const EXTENSION_VERSION = '1.0.0';
export const EXTENSION_QUERY_TIMEOUT_MS = 20000;
export const EXTENSION_TAB_LOAD_TIMEOUT_MS = 12000;

export const APP_CHANNEL_SOURCE = 'CORREIOS_RECONDICIONADOS_APP';
export const EXT_CHANNEL_SOURCE = 'CORREIOS_SRO_EXTENSION_V1';
