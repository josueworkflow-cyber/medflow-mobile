# Plano de Implementação — Dac Hospitalar Mobile (Módulo de Estoque)
**Versão:** 1.2  
**Data:** Junho/2026  
**Responsável Técnico:** CTO  
**Projeto:** APK Android para operações de estoque do ERP Dac Hospitalar  

---

## 1. Visão Geral do Projeto

### Objetivo
Desenvolver um aplicativo Android nativo (APK via sideload) para operadores de estoque realizarem movimentações físicas em tempo real, integrado à API REST existente do ERP Dac Hospitalar (Next.js 15).

### Contexto
O ERP Dac Hospitalar já possui API REST estruturada com módulos de estoque e produto maduros. O app mobile será um **cliente consumidor dessa API**, sem lógica de negócio própria — toda regra de negócio permanece no backend.

### Dispositivo Alvo
- **Tipo:** Celular Android dedicado ao estoque (não pessoal)
- **Recomendação de hardware:** Motorola Moto G34 ou superior
- **Android mínimo:** Android 10 (API Level 29)
- **Requisito de câmera:** Câmera traseira com autofoco (leitura de EAN-13)
- **Conectividade:** Wi-Fi obrigatório (sem suporte offline no MVP)

---

## 2. Decisões Arquiteturais

### 2.1 Stack do App Mobile
| Camada | Tecnologia | Justificativa |
|---|---|---|
| Framework | React Native + Expo (SDK 51+) | Mesma linguagem do ERP (TypeScript/JS). Reaproveitamento de types e validações Zod. |
| Linguagem | TypeScript | Consistência com o backend |
| HTTP Client | Axios | Interceptors para injetar JWT automaticamente |
| Armazenamento local | AsyncStorage | Persistência do JWT e preferências |
| Navegação | React Navigation v6 (Native Stack) | Padrão consolidado, suporte nativo |
| UI Components | React Native Paper | Material Design 3, simples e funcional |
| Scanner | expo-camera + expo-barcode-scanner | Leitura de EAN-13, EAN-8, QR Code |
| Estado global | React Context + useReducer | Sem overhead de lib externa no MVP |
| Validação de forms | Zod (já usado no backend) | Reutilização de schemas |
| Build APK | EAS Build (Expo) | Gera APK assinado sem Android Studio |

### 2.2 Autenticação
- **Estratégia:** JWT Bearer Token via `Authorization: Bearer <token>`
- **Rota de login mobile:** `POST /api/mobile/auth/login` (a ser criada no backend)
- **Persistência:** Token salvo no `AsyncStorage` do dispositivo
- **Expiração:** 8 horas (usuário faz login no início do turno)
- **Renovação:** No MVP, ao expirar o app redireciona para login. Refresh token fica para v2.
- **Interceptor Axios:** Toda requisição injeta o header automaticamente

### 2.3 Comunicação com a API
- **URL Base:** Configurável via variável de ambiente no Expo (`.env`)
- **Ambiente de desenvolvimento:** `http://<IP_LOCAL>:3000` (máquina do dev na mesma rede Wi-Fi)
- **Ambiente de produção:** URL pública do ERP (a ser definida quando o ERP for ao ar)
- **Timeout padrão:** 15 segundos
- **Tratamento de erros:** Interceptor global captura 401 (redireciona ao login), 403 (exibe permissão negada), 5xx (exibe erro genérico com opção de retry)

---

## 3. Funcionalidades do MVP

### 3.1 Escopo Confirmado

| # | Funcionalidade | Endpoints Consumidos | Status Backend |
|---|---|---|---|
| F01 | Login do operador | `POST /api/mobile/auth/login` | ⚠️ Criar |
| F02 | Escanear produto e consultar saldo | `GET /api/produto` (busca por codigoBarras) + `GET /api/estoque/lotes` | ✅ Existe |
| F03 | Dar entrada de estoque (lote + quantidade) | `POST /api/estoque/lote/entrada` | ✅ Existe |
| F04 | Realizar contagem / ajuste de inventário | `POST /api/estoque/ajuste` | ⚠️ Criar |
| F05 | Bloquear / colocar lote em quarentena | `POST /api/estoque/lote/bloquear` | ✅ Existe |
| F06 | Ver alertas de vencimento e estoque crítico | `GET /api/estoque/alertas` | ✅ Existe |
| F07 | Transferir lote entre localizações | `POST /api/estoque/transferencia` | ⚠️ Criar |

### 3.2 Fora do Escopo do MVP (Backlog v2)
- Saída de estoque vinculada a pedido de venda
- Importação de XML de NF-e pelo app
- Histórico de movimentações com filtros avançados
- Notificações push de alertas
- Modo offline com sincronização
- Múltiplos idiomas

---

## 4. Telas do Aplicativo

```
App
├── LoginScreen               ← Email + senha → JWT
├── HomeScreen                ← Menu principal com atalhos
├── ScannerScreen             ← Câmera + leitura de código de barras
├── ProdutoDetalheScreen      ← Saldo, lotes, localização do produto escaneado
├── EntradaEstoqueScreen      ← Formulário de entrada (lote, qtd, validade, custo)
├── AjusteInventarioScreen    ← Contagem física → gera ajuste
├── BloqueioLoteScreen        ← Seleciona lote → define status + motivo
├── TransferenciaScreen       ← Seleciona lote → origem → destino
├── AlertasScreen             ← Lista de vencimentos e críticos
└── ConfiguracoesScreen       ← URL da API, logout, versão do app
```

### Fluxo Principal (Scanner → Ação)
```
ScannerScreen
    → lê código de barras
    → busca produto na API
    → ProdutoDetalheScreen (exibe saldo e lotes)
        → [Botão] Dar Entrada    → EntradaEstoqueScreen
        → [Botão] Ajustar        → AjusteInventarioScreen
        → [Botão] Bloquear Lote  → BloqueioLoteScreen
        → [Botão] Transferir     → TransferenciaScreen
```

---

## 5. Endpoints a Criar no Backend (Pré-requisitos)

### 5.1 `POST /api/mobile/auth/login`
**Descrição:** Autenticação exclusiva para clientes mobile. Retorna JWT no body.

**Body:**
```json
{ "email": "operador@dachospitalar.com", "password": "senha" }
```

**Resposta (200):**
```json
{
  "token": "<JWT assinado com AUTH_SECRET, exp 8h>",
  "usuario": { "id": 1, "nome": "João Silva", "perfil": "ESTOQUE" }
}
```

**Regras:**
- Validar credenciais com bcrypt (mesmo fluxo do NextAuth)
- Só permitir perfis `ESTOQUE` e `ADMINISTRADOR`
- Retornar 401 para credenciais inválidas
- Retornar 403 para perfil não autorizado

---

### 5.2 Ajuste no `middleware.ts` / `getAuthActor()`
**Descrição:** Aceitar `Authorization: Bearer <token>` além do cookie de sessão.

**Regra:**
- Se cookie presente → usa fluxo NextAuth atual (sem mudança)
- Se header `Authorization: Bearer` presente → valida JWT e injeta usuário
- Se nenhum → retorna 401
- **Não quebrar nenhuma rota existente do ERP web**

---

### 5.3 `POST /api/estoque/ajuste`
**Descrição:** Ajuste manual de quantidade de um lote (positivo ou negativo).

**Body:**
```json
{
  "produtoId": 1,
  "loteId": 3,
  "quantidadeNova": 13,
  "motivo": "Quebra identificada no inventário físico"
}
```

**Resposta (200):**
```json
{ "success": true, "movimentacao": { "id": 99, "tipo": "AJUSTE", "quantidade": -2 } }
```

**Regras:**
- Calcular diferença: `delta = quantidadeNova - quantidadeAtual`
- Se `delta == 0` → retornar erro (sem alteração necessária)
- Gravar `MovimentacaoEstoque` com `tipo: AJUSTE` e a diferença calculada
- Atualizar `EstoqueAtual.quantidadeDisponivel`
- Perfil exigido: `ESTOQUE` ou `ADMINISTRADOR`
- Campo `motivo` obrigatório

---

### 5.4 `POST /api/estoque/transferencia`
**Descrição:** Transferir quantidade de um lote entre duas localizações físicas.

**Body:**
```json
{
  "loteId": 3,
  "localizacaoOrigemId": 1,
  "localizacaoDestinoId": 2,
  "quantidade": 5,
  "motivo": "Reorganização de câmara fria"
}
```

**Resposta (200):**
```json
{ "success": true }
```

**Regras:**
- Validar que `quantidade <= quantidadeDisponivel` na origem
- Deduzir da `EstoqueAtual` da origem
- Adicionar na `EstoqueAtual` do destino (criar registro se não existir)
- Gravar duas `MovimentacaoEstoque`: uma `SAIDA` da origem, uma `ENTRADA` no destino, ambas com `tipo: TRANSFERENCIA`
- Perfil exigido: `ESTOQUE` ou `ADMINISTRADOR`

---

## 6. Organização de Repositórios e Código

### 6.1 Estratégia de Repositórios

**Decisão: 2 repositórios separados no GitHub.**

Monorepo foi descartado — o build do Expo não tem dependência do Next.js, deploys são independentes e o histórico de commits fica mais limpo por projeto.

```
GitHub (organização ou conta pessoal)
├── dac-hospitalar-erp          ← Next.js 15 (ERP Web + API REST) — já existe
└── dac-hospitalar-mobile       ← React Native + Expo (APK Android) — a criar
```

### 6.2 Convenção de Branches

Ambos os repositórios seguem o mesmo padrão:

| Branch | Propósito |
|---|---|
| `main` | Código estável, testado e aprovado pelo CTO |
| `develop` | Integração das features em andamento |
| `feature/<nome>` | Desenvolvimento de uma funcionalidade específica |
| `fix/<nome>` | Correção de bug |

**Fluxo:** Dev Júnior trabalha em `feature/*` → abre Pull Request para `develop` → CTO revisa → merge. Nunca commitar direto na `main`.

**Exemplos de nomes de branch:**
```
feature/s0-mobile-auth-login
feature/s0-ajuste-estoque-endpoint
feature/s1-login-screen
feature/s2-scanner-produto
```

### 6.3 Padrão de Commits

Usar **Conventional Commits** para histórico legível:

```
feat: adiciona endpoint POST /api/mobile/auth/login
feat: cria LoginScreen com validação e persistência JWT
fix: corrige permissão de câmera no Android 13
refactor: extrai lógica de autenticação para useAuth hook
chore: instala dependências iniciais do projeto Expo
```

### 6.4 Conexão APK ↔ Sistema

**A única forma de comunicação entre o app mobile e o ERP é via API REST.** Sem acesso direto ao banco de dados, sem sockets, sem leitura de arquivos compartilhados.

```
[App Mobile Android]
        │
        │  HTTPS (JWT Bearer Token)
        │  POST /api/estoque/lote/entrada
        │  GET  /api/produto?search=7891234567890
        │  ...
        ▼
[ERP Dac Hospitalar — Next.js API]
        │
        │  Prisma ORM
        ▼
[PostgreSQL — Banco Remoto]
```

Toda regra de negócio, validação de permissão e auditoria fica exclusivamente no backend. O app é apenas um cliente que exibe dados e dispara ações.

### 6.5 Sincronização de Types entre Projetos

**Estratégia do MVP: espelhamento manual com disciplina de processo.**

O repositório `dac-hospitalar-mobile` terá uma pasta `src/types/` com os types TypeScript espelhando os models relevantes do Prisma:

```
dac-hospitalar-mobile/src/types/
├── produto.ts       ← Espelho de model Produto
├── estoque.ts       ← Espelho de Lote, EstoqueAtual, MovimentacaoEstoque
└── auth.ts          ← Type Usuario, AuthState
```

**Regra de processo obrigatória:** qualquer alteração de schema no `dac-hospitalar-erp` (Prisma migration) que afete os models de Produto, Lote, EstoqueAtual ou MovimentacaoEstoque deve obrigatoriamente incluir a atualização dos types correspondentes no `dac-hospitalar-mobile` na **mesma PR ou na PR imediatamente seguinte**.

> Para v2: avaliar extração dos types para pacote npm privado (`medflow-shared`) publicado via GitHub Packages, eliminando o risco de desincronização.

### 6.6 Variáveis de Ambiente por Repositório

**dac-hospitalar-erp** (já existente, verificar se possui):
```env
AUTH_SECRET=<segredo para assinar JWT>
DATABASE_URL=postgresql://...
NEXTAUTH_URL=http://localhost:3000
```

**dac-hospitalar-mobile** (novo arquivo `.env` na raiz):
```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.X.X:3000
```

> ⚠️ Nenhum `.env` deve ser commitado no Git. Ambos os repositórios devem ter `.env` no `.gitignore` e um arquivo `.env.example` com as chaves (sem valores) como referência.

---

## 7. Estrutura de Pastas do App Mobile

```
Dac HospitalarMobile/
├── app.json                  ← Configurações Expo (nome, ícone, permissões)
├── .env                      ← API_BASE_URL
├── src/
│   ├── api/
│   │   ├── client.ts         ← Instância Axios + interceptors (JWT, erros)
│   │   ├── auth.ts           ← login(), logout()
│   │   ├── produtos.ts       ← getProdutoPorCodigoBarras(), getProduto()
│   │   └── estoque.ts        ← entrada(), ajuste(), bloquear(), transferir(), alertas()
│   ├── screens/
│   │   ├── LoginScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── ScannerScreen.tsx
│   │   ├── ProdutoDetalheScreen.tsx
│   │   ├── EntradaEstoqueScreen.tsx
│   │   ├── AjusteInventarioScreen.tsx
│   │   ├── BloqueioLoteScreen.tsx
│   │   ├── TransferenciaScreen.tsx
│   │   ├── AlertasScreen.tsx
│   │   └── ConfiguracoesScreen.tsx
│   ├── components/
│   │   ├── Scanner.tsx       ← Componente de câmera reutilizável
│   │   ├── LoteCard.tsx      ← Card de exibição de lote
│   │   ├── AlertaBadge.tsx   ← Badge de alerta (vencendo, crítico)
│   │   └── LoadingOverlay.tsx
│   ├── hooks/
│   │   ├── useAuth.ts        ← Contexto de autenticação
│   │   ├── useScanner.ts     ← Lógica de leitura de câmera
│   │   └── useEstoque.ts     ← Operações de estoque com loading/error
│   ├── store/
│   │   └── AuthContext.tsx   ← Context + Provider + useReducer
│   ├── types/
│   │   ├── produto.ts        ← Type Produto (espelho do Prisma)
│   │   ├── estoque.ts        ← Types Lote, EstoqueAtual, Movimentacao
│   │   └── auth.ts           ← Type Usuario, AuthState
│   └── utils/
│       ├── storage.ts        ← Wrappers AsyncStorage (getToken, setToken)
│       └── formatters.ts     ← Formatação de datas, quantidades, moeda
```

---

## 7. Permissões Android Necessárias

Declarar no `app.json` (Expo) e no `AndroidManifest.xml`:

```json
"android": {
  "permissions": [
    "CAMERA",
    "INTERNET",
    "ACCESS_NETWORK_STATE"
  ]
}
```

---

## 8. Sprints de Desenvolvimento

### Sprint 0 — Backend Prep (Estimativa: 3–4 dias)
> **Responsável:** Dev Júnior | **Validação:** CTO

| Tarefa | Descrição |
|---|---|
| S0-01 | Criar `POST /api/mobile/auth/login` |
| S0-02 | Ajustar `getAuthActor()` para aceitar Bearer Token |
| S0-03 | Criar `POST /api/estoque/ajuste` |
| S0-04 | Criar `POST /api/estoque/transferencia` |
| S0-05 | Testar todos os endpoints com Postman/Insomnia antes de liberar |

**Critério de aceite:** Todos os endpoints retornam respostas corretas via Postman com token JWT no header. CTO valida antes de avançar.

---

### Sprint 1 — Setup + Autenticação Mobile (Estimativa: 2–3 dias)
> **Responsável:** Dev Júnior | **Validação:** CTO

| Tarefa | Descrição |
|---|---|
| S1-01 | Criar projeto Expo com template TypeScript |
| S1-02 | Instalar e configurar dependências (ver seção 2.1) |
| S1-03 | Criar estrutura de pastas completa |
| S1-04 | Configurar Axios client com interceptors (JWT + erros) |
| S1-05 | Implementar AuthContext (login, logout, persistência JWT) |
| S1-06 | Criar `LoginScreen` funcional (campos + chamada API + redirect) |
| S1-07 | Criar `HomeScreen` placeholder com botões de navegação |
| S1-08 | Testar login no emulador Android apontando para API local |

**Critério de aceite:** Operador consegue logar com email/senha e ver a HomeScreen. Token persiste ao fechar e reabrir o app.

---

### Sprint 2 — Scanner + Consulta de Produto (Estimativa: 3–4 dias)
> **Responsável:** Dev Júnior | **Validação:** CTO

| Tarefa | Descrição |
|---|---|
| S2-01 | Implementar `ScannerScreen` com câmera e leitura de código de barras |
| S2-02 | Ao ler código → chamar `GET /api/produto?search=<codigoBarras>` |
| S2-03 | Criar `ProdutoDetalheScreen` com saldo, lotes e localização |
| S2-04 | Tratar produto não encontrado (exibir mensagem + opção de busca manual) |
| S2-05 | Implementar busca manual por nome/código como fallback do scanner |

**Critério de aceite:** Escanear EAN-13 de um produto cadastrado exibe saldo e lotes corretamente.

---

### Sprint 3 — Operações de Estoque (Estimativa: 4–5 dias)
> **Responsável:** Dev Júnior | **Validação:** CTO

| Tarefa | Descrição |
|---|---|
| S3-01 | Criar `EntradaEstoqueScreen` (formulário + validação Zod + POST) |
| S3-02 | Criar `AjusteInventarioScreen` (exibe saldo atual → campo quantidade nova) |
| S3-03 | Criar `BloqueioLoteScreen` (seleciona lote → status + motivo) |
| S3-04 | Criar `TransferenciaScreen` (seleciona lote → origem → destino → quantidade) |
| S3-05 | Feedback visual em todas as operações (loading, sucesso, erro) |

**Critério de aceite:** Todas as operações refletem imediatamente no ERP web após execução no app.

---

### Sprint 4 — Alertas + Polimento + APK (Estimativa: 2–3 dias)
> **Responsável:** Dev Júnior | **Validação:** CTO

| Tarefa | Descrição |
|---|---|
| S4-01 | Criar `AlertasScreen` com lista de vencimentos e estoques críticos |
| S4-02 | Badge de alertas na HomeScreen (quantidade de alertas ativos) |
| S4-03 | Criar `ConfiguracoesScreen` (URL da API configurável + logout + versão) |
| S4-04 | Configurar ícone e nome do app no `app.json` |
| S4-05 | Gerar APK de produção via `eas build --platform android --profile preview` |
| S4-06 | Testar APK instalado via sideload em dispositivo físico real |

**Critério de aceite:** APK instalado no celular dedicado com todas as funcionalidades operando em rede Wi-Fi local.

---

## 9. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| API sem URL pública em produção | Alta | Alto | Configurar URL via tela de Configurações no app. Operador ajusta ao trocar de ambiente. |
| Câmera não lê código de barras com qualidade | Média | Alto | Testar no dispositivo físico real na Sprint 2. Implementar busca manual como fallback. |
| Cookie do NextAuth conflitando com Bearer Token | Média | Médio | Isolar a lógica no `getAuthActor()` sem tocar no fluxo de cookie. Testar ambos os fluxos. |
| Produto sem `codigoBarras` cadastrado | Alta | Médio | Busca manual por nome/código interno como fallback obrigatório. |
| Expo depreciando `expo-barcode-scanner` | Baixa | Médio | Usar `expo-camera` com `BarcodeScanner` embutido (já é o caminho recomendado no SDK 50+). |

---

## 10. Definição de Pronto (Definition of Done)

Uma tarefa só é considerada concluída quando:
- [ ] Código commitado no repositório com mensagem descritiva
- [ ] Testado no emulador Android (desenvolvimento)
- [ ] Testado em dispositivo físico (a partir da Sprint 2)
- [ ] Sem erros de TypeScript (`tsc --noEmit` passa)
- [ ] CTO revisou e aprovou antes de marcar como feito
- [ ] Endpoints novos documentados no Postman da equipe

---

## 11. Configuração de Ambiente do Dev Júnior

### Pré-requisitos para instalar na máquina:
```bash
# Node.js 20+ e npm
node -v  # deve ser >= 20

# Expo CLI
npm install -g expo-cli eas-cli

# Android Studio (para emulador)
# Baixar em: https://developer.android.com/studio

# Configurar variável ANDROID_HOME e adicionar ao PATH:
# export ANDROID_HOME=$HOME/Android/Sdk
# export PATH=$PATH:$ANDROID_HOME/emulator
# export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### Criar e rodar o projeto:
```bash
npx create-expo-app Dac HospitalarMobile --template blank-typescript
cd Dac HospitalarMobile
npx expo start
# Pressionar 'a' para abrir no emulador Android
```

### Variáveis de ambiente (`.env` na raiz do projeto mobile):
```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.X.X:3000
```
> ⚠️ Substituir pelo IP local da máquina onde o ERP Next.js está rodando. Usar `http://10.0.2.2:3000` apenas no emulador oficial do Android Studio.

---

## 12. Histórico de Versões do Plano

| Versão | Data | Alteração |
|---|---|---|
| 1.0 | Jun/2026 | Versão inicial — escopo MVP definido |
| 1.1 | Jun/2026 | Adicionada seção 6 — organização de repositórios, branches, commits e estratégia de types |
| 1.2 | Jun/2026 | Adicionadas seções 13 e 14 contendo histórico de execução da Sprint 0 e Sprint 1 e orientações para Windows |

---

## 13. Histórico de Execução

Esta seção documenta o andamento real e as decisões de implementação tomadas durante a execução do projeto.

### 13.1 Sprint 0: Backend Prep
- **O que foi feito:**
  - Implementação do endpoint de autenticação móvel `POST /api/mobile/auth/login` utilizando a biblioteca `jose` para assinar o token JWT e `bcryptjs` para verificação de hash de senha.
  - Ajuste do `middleware.ts` para permitir o acesso público às rotas `/api/mobile/auth` sem a necessidade de cookies de sessão.
  - Modificação do utilitário `getAuthActor(request?: Request | NextRequest)` em `lib/authz.ts` para que ele extraia e valide o Bearer Token do cabeçalho `Authorization` via `jwtVerify` da biblioteca `jose`.
  - O `middleware.ts` foi estendido para também validar o Bearer Token diretamente e garantir o controle de acesso de rotas do Next.js.
  - Implementação da rota de ajuste de saldo `POST /api/estoque/ajuste` com execução de alteração e histórico unificados sob `prisma.$transaction`.
  - Implementação da rota de transferência de estoque `POST /api/estoque/transferencia` integrada ao novo método `transferirLote` da classe `EstoqueService`.
- **Decisões tomadas e evolução técnica:**
  - Optou-se por assinar o token com `process.env.AUTH_SECRET` e manter compatibilidade total com o fluxo de cookies do NextAuth.
  - Optou-se por retornar uma mensagem técnica genérica (`"Erro interno no servidor ao processar transferência."`) sob status `500` no endpoint de transferência, evitando vazamentos de informações e credenciais do banco remoto PostgreSQL (`76.13.231.163`) ao aplicativo mobile.
- **Problemas encontrados e resoluções:**
  - *Instabilidade do banco PostgreSQL remoto:* Durante os testes manuais e de inicialização da rota, a conexão com o banco de dados remota caía intermitentemente. Resolvido com tratamento de erros robusto.
  - *headers() do Next.js:* Foi introduzido um fallback `headers()` em `getAuthActor()` quando a requisição não é informada. Isto é um código morto/desnecessário de baixo risco a ser removido em manutenções futuras.
- **Status das Tarefas:**
  - `S0-01` (Login Route) — ✅ Concluída
  - `S0-02` (Bearer Token no Middleware) — ✅ Concluída
  - `S0-03` (Ajuste Route) — ✅ Concluída
  - `S0-04` (Transferência Route) — ✅ Concluída
  - `S0-05` (Testes Manuais) — ✅ Concluída
- **Merge:** PR #2 mergeada e integrada na branch `main` do repositório `dac-hospitalar-erp`.

### 13.2 Sprint 1: Setup + Autenticação Mobile
- **O que foi feito:**
  - Clonado o repositório inicialmente vazio no GitHub em `/Users/josuetecla/Documents/dac-hospitalar-mobile`.
  - Inicialização da estrutura de arquivos utilizando o template em branco TypeScript do Expo (SDK 52/56).
  - Instalação e configuração de dependências necessárias: `axios`, `@react-native-async-storage/async-storage`, `expo-camera`, `@react-navigation/native`, `@react-navigation/native-stack`, `react-native-screens`, `react-native-safe-area-context`, `react-native-paper` e `react-native-vector-icons`.
  - Estruturação do fluxo global de autenticação com os arquivos: `storage.ts`, `client.ts`, `auth.ts`, `AuthContext.tsx`, `useAuth.ts`, `LoginScreen.tsx`, `HomeScreen.tsx` e o arquivo de inicialização de rotas `App.tsx`.
- **Decisões tomadas e evolução técnica:**
  - Configuração do Material Design 3 via componentes do `react-native-paper` para garantir uma interface moderna e limpa.
  - Uso de Async Storage para salvar o token JWT com ciclo de vida atrelado ao estado global.
- **Problemas encontrados e resoluções:**
  - *Bloqueio de rede no npm/npx:* Ocorreu erro `ECONNRESET` durante a conexão com o repositório público do npm. Resolvido configurando o registro alternativo do Yarn (`--registry=https://registry.yarnpkg.com`) nas instalações e fazendo a extração local direta do tarball do template.
  - *Erro de importação de useAuth:* No primeiro desenho do `App.tsx`, o import do hook `useAuth` vinha de `AuthContext.tsx` em vez de `hooks/useAuth.ts`. Corrigido.
  - *Vazamento de interceptores no React:* O `setupResponseInterceptors` original registrava interceptores Axios adicionais sem limpá-los no cleanup do `useEffect`. Ajustado para retornar o identificador (interceptor ID) e chamar `api.interceptors.response.eject(interceptorId)` ao desmontar.
- **Status das Tarefas:**
  - `S1-01` (Criar Projeto Expo) — ✅ Concluída
  - `S1-02` (Instalar Dependências) — ✅ Concluída
  - `S1-03` (Estrutura de Pastas) — ✅ Concluída
  - `S1-04` (Cliente Axios com Interceptors) — ✅ Concluída
  - `S1-05` (AuthProvider e Storage) — ✅ Concluída
  - `S1-06` (LoginScreen funcional) — ✅ Concluída
  - `S1-07` (HomeScreen placeholder) — ✅ Concluída
  - `S1-08` (Testes de compilação com `tsc`) — ✅ Concluída com zero erros.
- **Push:** Subido e integrado na branch `develop` do repositório `dac-hospitalar-mobile`.

---

## 14. Estado Atual e Próximos Passos

### 14.1 Estado dos Repositórios
1. **ERP Dac Hospitalar (Backend):**
   - Repositório: `dac-hospitalar-erp` (Next.js)
   - Branch com as alterações: `main` (Mergeado e atualizado via pull remoto).
2. **Coletor Dac Hospitalar (Mobile):**
   - Repositório: `dac-hospitalar-mobile` (Expo/React Native)
   - Branch com as alterações: `develop` (Criada, commitada e enviada via push).

### 14.2 Próxima Etapa: Sprint 2
- **Escopo:** Leitura de câmera com `expo-camera` para scanner de EAN-13, integração com API REST de busca de produto (`GET /api/produto?search=<codigoBarras>`) e exibição de detalhes e lotes do estoque na tela `ProdutoDetalheScreen`.

### 14.3 Contexto de Ambiente e Migração (Windows)
- **Migração:** O projeto está migrando do ambiente de desenvolvimento macOS para Windows. A nova IA que assumir o projeto deve se atentar aos seguintes pontos:
  - Usar barras invertidas (`\`) ou caminhos compatíveis no Windows.
  - Usar comandos compatíveis com o terminal do Windows (PowerShell ou CMD). Exemplo: `npx expo start` ou execução de scripts.
  - **Variável de Ambiente Local:** O arquivo `.env` na raiz do repositório mobile deve ser criado com a chave `EXPO_PUBLIC_API_BASE_URL` configurada com o endereço de IP da máquina Windows local na rede Wi-Fi comum (exemplo: `http://192.168.1.50:3000`), para que o celular ou emulador Android consiga se conectar à API Next.js rodando localmente.
