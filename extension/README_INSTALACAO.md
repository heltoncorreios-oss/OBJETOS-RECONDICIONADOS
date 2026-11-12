# Guia de Instalação e Teste Piloto – Extensão SRO (Chrome e Edge)

Esta é a versão **piloto** (Manifest V3) da extensão que integra o **SRO Intranet dos Correios** diretamente ao sistema oficial hospedado em:

`https://recondicionamentodeobjetos.vercel.app`

> **Importante:** Não exige instalação de `.exe`, Python ou Node.js no computador da unidade.

---

## 1. Como gerar a pasta compilada (`/dist-extension`)

Na raiz do projeto (em ambiente de desenvolvimento), execute:

```bash
npm run build:extension
```

Será criada a pasta `/dist-extension` contendo:
- `manifest.json`
- `background.js`
- `appBridge.js`
- `sroContentScript.js`
- `popup.html` e `popup.js`

Copie a pasta `dist-extension` inteira para o computador de teste (ou utilize-a diretamente na estação).

---

## 2. Instalação no Google Chrome (Estação Piloto)

1. Abra o **Google Chrome** na estação dos Correios.
2. Acesse na barra de endereços: `chrome://extensions`
3. No canto superior direito, ative a chave **Modo do desenvolvedor**.
4. Clique no botão **Carregar sem compactação**.
5. Selecione a pasta `dist-extension`.
6. Confirme que a extensão **"Correios SRO - Controle de Recondicionados (Piloto)"** aparece ativa sem erros.

---

## 3. Instalação no Microsoft Edge (Estação Piloto)

1. Abra o **Microsoft Edge** na estação dos Correios.
2. Acesse na barra de endereços: `edge://extensions`
3. No menu lateral esquerdo (ou parte superior), ative **Modo de desenvolvedor**.
4. Clique em **Carregar sem pacote** (ou **Carregar descompactada**).
5. Selecione a pasta `dist-extension`.
6. Confirme que a extensão aparece habilitada.

---

## 4. Como Usar na Rede Corporativa dos Correios

1. Em uma aba do mesmo navegador, acesse o **SRO Intranet** (`https://srointranet.correios.com.br/rastreamento`) e realize seu **login corporativo normal** (IdCorreios/SSO).
   - A extensão reutilizará essa única aba autenticada sempre que possível, evitando abrir várias abas.
2. Em outra aba do mesmo navegador, acesse o sistema oficial:
   `https://recondicionamentodeobjetos.vercel.app`
3. Entre na sua unidade (MCU) e abra **Novo Cadastro de Objeto Recondicionado**.
4. Bipe ou digite o **Código de Rastreamento (Número Objeto)**.
5. A extensão consultará o objeto no SRO, extrairá apenas o evento **Postagem (PO)**, o sistema consultará os CEPs de remetente e destinatário e preencherá os campos automaticamente — mantendo **Peso Real (Gs)** manual e preservando edições manuais.
6. Confira os dados e salve normalmente.

> **Contingência:** Caso a extensão não esteja instalada, esteja desabilitada ou a sessão do SRO esteja expirada, o sistema exibe o aviso correspondente e mantém disponíveis o leitor por colagem (`Ctrl+A → Ctrl+C → Ctrl+V`) e o preenchimento manual.

---

## 5. Checklist de Validação Obrigatória em Rede Real (Antes da Produção)

Testar com objetos reais no SRO Intranet:
- [ ] Objeto real com `VD = S` (convertido para `SIM`).
- [ ] Objeto real com `VD = N` (convertido para `NÃO`).
- [ ] Objeto com múltiplas movimentações posteriores (comprovando extração apenas da `Postagem (PO)`).
- [ ] Conversão de peso (`kg → g`) em `Peso Postal (Gs)` e `Peso Real (Gs)` mantido vazio/manual.
- [ ] CEPs e números dos logradouros de Remetente e Destinatário sem inversão.
- [ ] Sessão do SRO expirada (deve exibir erro de autenticação `AUTH_REQUIRED`).
- [ ] Objeto inexistente (não deve preencher dados nem manter valores de consulta anterior).
- [ ] Troca rápida de objetos preservando campos alterados manualmente.
