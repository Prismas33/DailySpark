# 📋 DAILYSPARK - SETUP & CONTINUATION GUIDE

## 🎯 **O QUE ESTAMOS A FAZER:**

Criámos o **DailySpark** - um **Social Media Manager white-label** baseado no código do GateX, mas limpo e focado apenas em agendamento de posts sociais.

## 📂 **ESTADO ATUAL:**

### ✅ **O que já foi feito:**
1. **Copiado projeto base** do GateX para `E:\projetos-vs\DailySpark`
2. **Estrutura criada** com robocopy (files .ts, .js, .json, .md)
3. **Git inicializado** no DailySpark
4. **VS Code aberto** no projeto DailySpark

### 📁 **Arquivos copiados importantes:**
- `functions/src/socialMediaQueueScheduler.ts` ✅
- `functions/src/socialMediaPromotionScheduler.ts` ✅  
- `functions/src/manualSocialMediaPromotion.ts` ✅
- `app/api/social-media-queue/` ✅
- `app/api/socialMediaManualPost/` ✅
- `hooks/` ✅
- `components/` ✅
- Configurações (Next.js, TypeScript, Tailwind, Firebase) ✅

---

## 🧹 **PRÓXIMOS PASSOS - LIMPEZA:**

### 1. **Atualizar Branding (package.json)**
```json
{
  "name": "daily-spark",
  "description": "Social Media Management Platform",
  "author": "DailySpark Team",
  "keywords": ["social-media", "scheduler", "oauth", "automation"]
}
```

### 2. **Remover arquivos GateX específicos:**
```bash
# Remover:
- services/ (smart contracts, crypto)
- app/api/tokens/ (token distribution)
- app/api/admin/ (complex admin system)
- config/paymentConfig.ts
- config/tokenConfig.ts
- contracts/ (solidity)
- monitoring-service/ (blockchain monitoring)
```

### 3. **Manter apenas Social Media core:**
```bash
# Manter:
- functions/src/socialMedia*.ts ✅
- app/api/social-media-queue/ ✅
- app/api/socialMediaManualPost/ ✅
- hooks/ (limpar os não relacionados)
- components/ (limpar os não relacionados)
```

---

## 🏗️ **ARQUITETURA ALVO - DAILYSPARK:**

### **Core Features a implementar:**

#### 1. **🔐 OAuth Social Login**
- NextAuth com LinkedIn, Twitter, Facebook, Instagram
- Cada user conecta suas próprias contas
- Posts publicados em nome do próprio user

#### 2. **📝 Post Composer**
- Rich text editor
- Upload de imagens/vídeos
- Preview por plataforma
- Templates salvos

#### 3. **⏰ Scheduler System**
- Agendamento individual/em lote
- Fila inteligente (FIFO)
- Retry automático
- Status tracking

#### 4. **📊 Dashboard**
- Lista de posts agendados
- Histórico de publicações
- Status das contas conectadas
- Analytics básico

---

## 🎨 **INTERFACE ALVO:**

### **Páginas principais:**
1. **Login/Register** - Simples, sem complexidade admin
2. **Dashboard** - Overview de posts e contas
3. **Compose** - Editor de posts
4. **Schedule** - Calendário de agendamentos
5. **Accounts** - Gerenciar contas sociais conectadas
6. **History** - Histórico de posts

### **Não incluir:**
- Admin dashboard complexo
- Token/crypto features
- NFT management
- Job posting
- Employer/seeker system

---

## 🔧 **IMPLEMENTAÇÃO PRIORITÁRIA:**

### **Fase 1 - Setup Básico:**
1. Limpar package.json e dependências
2. Remover arquivos desnecessários
3. Configurar ambiente base
4. Testar build/dev

### **Fase 2 - OAuth Integration:**
1. Setup NextAuth
2. Providers: LinkedIn, Twitter, Facebook, Instagram
3. Database schema para userSocialAccounts
4. Interface de conexão de contas

### **Fase 3 - Post System:**
1. Interface de criação de posts
2. Sistema de agendamento
3. Processador de fila (Firebase Functions)
4. Handlers por plataforma

### **Fase 4 - Dashboard:**
1. Interface principal
2. Visualização de posts
3. Gestão de agendamentos
4. Analytics básico

---

## 🔑 **VARIÁVEIS DE AMBIENTE NECESSÁRIAS:**

```env
# OAuth Credentials (a configurar)
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
INSTAGRAM_CLIENT_ID=
INSTAGRAM_CLIENT_SECRET=

# NextAuth
NEXTAUTH_URL=https://dailyspark.com
NEXTAUTH_SECRET=

# Firebase (novo projeto)
FIREBASE_PROJECT_ID=dailyspark-xxxxx
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
```

---

## 📋 **CHECKLIST IMEDIATO:**

### **Quando retomar o trabalho:**

- [ ] Abrir VS Code em `E:\projetos-vs\DailySpark`
- [ ] Verificar estrutura de arquivos copiados
- [ ] Atualizar package.json com branding DailySpark
- [ ] Remover pastas desnecessárias (services/, contracts/, monitoring-service/)
- [ ] Limpar app/api/ mantendo só social media endpoints
- [ ] Configurar novo projeto Firebase
- [ ] Setup OAuth apps (LinkedIn, Twitter, Facebook, Instagram)
- [ ] Criar interface de login simples
- [ ] Testar sistema base

---

## 🎯 **OBJETIVO FINAL:**

**Sistema white-label** de social media management onde:
1. Users fazem OAuth login com suas contas sociais
2. Criam posts no editor
3. Agendam para publicação automática  
4. Sistema publica **em nome deles** nas suas contas
5. Interface limpa, focada, sem complexidade do GateX

---

## 📞 **CONTEXTO TÉCNICO:**

- **Base**: Next.js + TypeScript + Tailwind + Firebase
- **Auth**: NextAuth com OAuth social
- **Database**: Firestore
- **Functions**: Firebase Functions para scheduling
- **Deploy**: Vercel + Firebase Functions

**READY TO CONTINUE! 🚀**
# 📋 DAILYSPARK - SETUP & CONTINUATION GUIDE

## 🎯 **O QUE ESTAMOS A FAZER:**

Criámos o **DailySpark** - um **Social Media Manager white-label** baseado no código do GateX, mas limpo e focado apenas em agendamento de posts sociais.

## 📂 **ESTADO ATUAL:**

### ✅ **O que já foi feito:**
1. **Copiado projeto base** do GateX para `E:\projetos-vs\DailySpark`
2. **Estrutura criada** com robocopy (files .ts, .js, .json, .md)
3. **Git inicializado** no DailySpark
4. **VS Code aberto** no projeto DailySpark

### 📁 **Arquivos copiados importantes:**
- `functions/src/socialMediaQueueScheduler.ts` ✅
- `functions/src/socialMediaPromotionScheduler.ts` ✅  
- `functions/src/manualSocialMediaPromotion.ts` ✅
- `app/api/social-media-queue/` ✅
- `app/api/socialMediaManualPost/` ✅
- `hooks/` ✅
- `components/` ✅
- Configurações (Next.js, TypeScript, Tailwind, Firebase) ✅

---

## 🧹 **PRÓXIMOS PASSOS - LIMPEZA:**

### 1. **Atualizar Branding (package.json)**
```json
{
  "name": "daily-spark",
  "description": "Social Media Management Platform",
  "author": "DailySpark Team",
  "keywords": ["social-media", "scheduler", "oauth", "automation"]
}
```

### 2. **Remover arquivos GateX específicos:**
```bash
# Remover:
- services/ (smart contracts, crypto)
- app/api/tokens/ (token distribution)
- app/api/admin/ (complex admin system)
- config/paymentConfig.ts
- config/tokenConfig.ts
- contracts/ (solidity)
- monitoring-service/ (blockchain monitoring)
```

### 3. **Manter apenas Social Media core:**
```bash
# Manter:
- functions/src/socialMedia*.ts ✅
- app/api/social-media-queue/ ✅
- app/api/socialMediaManualPost/ ✅
- hooks/ (limpar os não relacionados)
- components/ (limpar os não relacionados)
```

---

## 🏗️ **ARQUITETURA ALVO - DAILYSPARK:**

### **Core Features a implementar:**

#### 1. **🔐 OAuth Social Login**
- NextAuth com LinkedIn, Twitter, Facebook, Instagram
- Cada user conecta suas próprias contas
- Posts publicados em nome do próprio user

#### 2. **📝 Post Composer**
- Rich text editor
- Upload de imagens/vídeos
- Preview por plataforma
- Templates salvos

#### 3. **⏰ Scheduler System**
- Agendamento individual/em lote
- Fila inteligente (FIFO)
- Retry automático
- Status tracking

#### 4. **📊 Dashboard**
- Lista de posts agendados
- Histórico de publicações
- Status das contas conectadas
- Analytics básico

---

## 🎨 **INTERFACE ALVO:**

### **Páginas principais:**
1. **Login/Register** - Simples, sem complexidade admin
2. **Dashboard** - Overview de posts e contas
3. **Compose** - Editor de posts
4. **Schedule** - Calendário de agendamentos
5. **Accounts** - Gerenciar contas sociais conectadas
6. **History** - Histórico de posts

### **Não incluir:**
- Admin dashboard complexo
- Token/crypto features
- NFT management
- Job posting
- Employer/seeker system

---

## 🔧 **IMPLEMENTAÇÃO PRIORITÁRIA:**

### **Fase 1 - Setup Básico:**
1. Limpar package.json e dependências
2. Remover arquivos desnecessários
3. Configurar ambiente base
4. Testar build/dev

### **Fase 2 - OAuth Integration:**
1. Setup NextAuth
2. Providers: LinkedIn, Twitter, Facebook, Instagram
3. Database schema para userSocialAccounts
4. Interface de conexão de contas

### **Fase 3 - Post System:**
1. Interface de criação de posts
2. Sistema de agendamento
3. Processador de fila (Firebase Functions)
4. Handlers por plataforma

### **Fase 4 - Dashboard:**
1. Interface principal
2. Visualização de posts
3. Gestão de agendamentos
4. Analytics básico

---

## 🔑 **VARIÁVEIS DE AMBIENTE NECESSÁRIAS:**

```env
# OAuth Credentials (a configurar)
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
INSTAGRAM_CLIENT_ID=
INSTAGRAM_CLIENT_SECRET=

# NextAuth
NEXTAUTH_URL=https://dailyspark.com
NEXTAUTH_SECRET=

# Firebase (novo projeto)
FIREBASE_PROJECT_ID=dailyspark-xxxxx
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
```

---

## 📋 **CHECKLIST IMEDIATO:**

### **Quando retomar o trabalho:**

- [ ] Abrir VS Code em `E:\projetos-vs\DailySpark`
- [ ] Verificar estrutura de arquivos copiados
- [ ] Atualizar package.json com branding DailySpark
- [ ] Remover pastas desnecessárias (services/, contracts/, monitoring-service/)
- [ ] Limpar app/api/ mantendo só social media endpoints
- [ ] Configurar novo projeto Firebase
- [ ] Setup OAuth apps (LinkedIn, Twitter, Facebook, Instagram)
- [ ] Criar interface de login simples
- [ ] Testar sistema base

---

## 🎯 **OBJETIVO FINAL:**

**Sistema white-label** de social media management onde:
1. Users fazem OAuth login com suas contas sociais
2. Criam posts no editor
3. Agendam para publicação automática  
4. Sistema publica **em nome deles** nas suas contas
5. Interface limpa, focada, sem complexidade do GateX

---

## 📞 **CONTEXTO TÉCNICO:**

- **Base**: Next.js + TypeScript + Tailwind + Firebase
- **Auth**: NextAuth com OAuth social
- **Database**: Firestore
- **Functions**: Firebase Functions para scheduling
- **Deploy**: Vercel + Firebase Functions

**READY TO CONTINUE! 🚀**
