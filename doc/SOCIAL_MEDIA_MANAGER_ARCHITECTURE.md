# 🚀 Social Media Manager - Arquitetura Completa

## 📋 Visão Geral

Este documento descreve a arquitetura completa do sistema de gerenciamento de redes sociais que permite aos usuários conectarem suas contas pessoais e agendarem posts automáticos.

## 🎯 Conceito Principal

**OAuth Social Login**: Cada usuário conecta suas próprias contas sociais (LinkedIn, Twitter/X, Facebook, Instagram) e o sistema publica **em nome deles**, como se eles próprios tivessem postado.

---

## 🏗️ Arquitetura do Sistema

🎨 Paletas de Cores para a App
2. Criativa & Vibrante
Roxo neon #8E44AD

Coral #FF6F61

Azul claro #3498DB

Amarelo suave #F9E79F

Perfeita para apps voltadas a criadores e influenciadores.


### 1. **Frontend Components**

#### 📱 Interface do Usuário
```
components/
├── SocialMediaManager/
│   ├── ConnectAccounts.tsx        # OAuth login para redes sociais
│   ├── PostComposer.tsx           # Editor de posts
│   ├── ScheduleManager.tsx        # Agendamento de posts
│   ├── QueueViewer.tsx            # Visualizar fila de posts
│   └── AccountStatus.tsx          # Status das contas conectadas
```

#### 🔐 Sistema de Autenticação
```
hooks/
├── useOAuthSocial.ts              # Hook para OAuth social
├── useSocialAccounts.ts           # Gerenciar contas conectadas
└── usePostScheduler.ts            # Hook para agendamento
```

### 2. **Backend API Endpoints**

#### 🔗 OAuth Management
```
app/api/
├── auth/
│   ├── linkedin/callback/         # Callback OAuth LinkedIn
│   ├── twitter/callback/          # Callback OAuth Twitter/X
│   ├── facebook/callback/         # Callback OAuth Facebook
│   └── instagram/callback/        # Callback OAuth Instagram
├── social-accounts/
│   ├── connect/                   # Conectar nova conta
│   ├── disconnect/                # Desconectar conta
│   ├── list/                      # Listar contas do usuário
│   └── refresh-tokens/            # Refresh de tokens
```

#### 📝 Post Management
```
app/api/
├── posts/
│   ├── create/                    # Criar novo post
│   ├── schedule/                  # Agendar post
│   ├── queue/                     # Gerenciar fila
│   └── history/                   # Histórico de posts
└── social-media-queue/
    ├── add/                       # Adicionar à fila
    ├── next/                      # Próximo da fila
    └── status/                    # Status da fila
```

### 3. **Firebase Functions (Scheduler)**

```
functions/src/
├── socialMediaScheduler.ts        # Processador principal
├── oauthTokenRefresh.ts          # Refresh automático de tokens
├── postProcessor.ts              # Processar posts da fila
└── platformHandlers/
    ├── linkedinHandler.ts        # Handler LinkedIn
    ├── twitterHandler.ts         # Handler Twitter/X
    ├── facebookHandler.ts        # Handler Facebook
    └── instagramHandler.ts       # Handler Instagram
```

---

## 🔧 Implementação Técnica

### 1. **OAuth Flow Completo**

#### Setup Inicial
```typescript
// next-auth.config.ts
import NextAuth from "next-auth"
import LinkedInProvider from "next-auth/providers/linkedin"
import TwitterProvider from "next-auth/providers/twitter"
import FacebookProvider from "next-auth/providers/facebook"

export default NextAuth({
  providers: [
    LinkedInProvider({
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
      scope: "r_liteprofile r_emailaddress w_member_social"
    }),
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      version: "2.0",
      scope: "tweet.read tweet.write users.read"
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
      scope: "pages_manage_posts instagram_basic instagram_content_publish"
    })
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        // Salvar tokens OAuth no token JWT
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.provider = account.provider
      }
      return token
    },
    async session({ session, token }) {
      // Salvar tokens na sessão
      session.accessToken = token.accessToken
      session.refreshToken = token.refreshToken
      session.provider = token.provider
      return session
    }
  }
})
```

#### Component de Conexão
```tsx
// components/SocialMediaManager/ConnectAccounts.tsx
import { signIn, useSession } from "next-auth/react"

export default function ConnectAccounts() {
  const { data: session } = useSession()
  
  const connectPlatform = async (provider: string) => {
    const result = await signIn(provider, { 
      callbackUrl: `/dashboard/social-media?connected=${provider}` 
    })
    
    if (result?.ok) {
      // Salvar tokens na base de dados
      await saveSocialAccount(provider, result.accessToken)
    }
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <button 
        onClick={() => connectPlatform('linkedin')}
        className="bg-blue-600 text-white p-4 rounded"
      >
        🔗 Connect LinkedIn
      </button>
      <button 
        onClick={() => connectPlatform('twitter')}
        className="bg-sky-500 text-white p-4 rounded"
      >
        🐦 Connect Twitter/X
      </button>
      <button 
        onClick={() => connectPlatform('facebook')}
        className="bg-blue-800 text-white p-4 rounded"
      >
        📘 Connect Facebook
      </button>
      <button 
        onClick={() => connectPlatform('instagram')}
        className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded"
      >
        📸 Connect Instagram
      </button>
    </div>
  )
}
```

### 2. **Database Schema (Firestore)**

#### Estrutura das Collections
```typescript
// Collection: userSocialAccounts
interface UserSocialAccount {
  userId: string;                   // ID do usuário
  platform: 'linkedin' | 'twitter' | 'facebook' | 'instagram';
  accessToken: string;              // Token OAuth do usuário
  refreshToken?: string;            // Token para refresh
  expiresAt: Timestamp;             // Quando expira
  platformUserId: string;           // ID do usuário na plataforma
  platformUsername: string;         // Username na plataforma
  isActive: boolean;                // Se a conta está ativa
  connectedAt: Timestamp;           // Quando foi conectada
  lastUsed?: Timestamp;             // Último uso
}

// Collection: scheduledPosts
interface ScheduledPost {
  id: string;
  userId: string;                   // Quem criou o post
  content: string;                  // Texto do post
  mediaUrls?: string[];             // Imagens/vídeos
  platforms: string[];              // Onde publicar
  scheduledFor: Timestamp;          // Quando publicar
  status: 'pending' | 'published' | 'failed';
  createdAt: Timestamp;
  publishedAt?: Timestamp;
  results?: {
    [platform: string]: {
      success: boolean;
      postId?: string;
      error?: string;
    }
  }
}

// Collection: socialMediaQueue
interface QueuedPost {
  id: string;
  userId: string;
  postId: string;                   // Referência ao scheduledPost
  platform: string;                // Platform específica
  priority: number;                 // Prioridade na fila
  status: 'pending' | 'processing' | 'completed' | 'failed';
  queuePosition: number;            // Posição na fila
  scheduledFor: Timestamp;
  attempts: number;                 // Tentativas de publicação
  lastError?: string;
}
```

### 3. **Handlers de Plataforma**

#### LinkedIn Handler
```typescript
// functions/src/platformHandlers/linkedinHandler.ts
export async function publishToLinkedIn(
  userToken: string, 
  content: string, 
  mediaUrls?: string[]
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    // 1. Get user profile
    const profileResponse = await fetch('https://api.linkedin.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const profile = await profileResponse.json();
    const personUrn = `urn:li:person:${profile.id}`;

    // 2. Upload media if exists
    let mediaAssets = [];
    if (mediaUrls?.length) {
      for (const mediaUrl of mediaUrls) {
        const asset = await uploadLinkedInMedia(userToken, mediaUrl);
        mediaAssets.push(asset);
      }
    }

    // 3. Create post
    const postData = {
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: content
          },
          shareMediaCategory: mediaAssets.length > 0 ? 'IMAGE' : 'NONE',
          media: mediaAssets.map(asset => ({
            status: 'READY',
            media: asset.asset
          }))
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };

    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postData)
    });

    if (response.ok) {
      const result = await response.json();
      return { 
        success: true, 
        postId: result.id 
      };
    } else {
      const error = await response.text();
      return { 
        success: false, 
        error: `LinkedIn API error: ${error}` 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
```

#### Twitter/X Handler
```typescript
// functions/src/platformHandlers/twitterHandler.ts
export async function publishToTwitter(
  userToken: string, 
  content: string, 
  mediaUrls?: string[]
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    // 1. Upload media if exists
    let mediaIds = [];
    if (mediaUrls?.length) {
      for (const mediaUrl of mediaUrls) {
        const mediaId = await uploadTwitterMedia(userToken, mediaUrl);
        mediaIds.push(mediaId);
      }
    }

    // 2. Create tweet
    const tweetData: any = {
      text: content
    };

    if (mediaIds.length > 0) {
      tweetData.media = {
        media_ids: mediaIds
      };
    }

    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tweetData)
    });

    if (response.ok) {
      const result = await response.json();
      return { 
        success: true, 
        postId: result.data.id 
      };
    } else {
      const error = await response.text();
      return { 
        success: false, 
        error: `Twitter API error: ${error}` 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
```

### 4. **Scheduler Principal**

```typescript
// functions/src/socialMediaScheduler.ts
export const socialMediaProcessor = onSchedule(
  {
    schedule: "*/5 * * * *", // A cada 5 minutos
    timeZone: "UTC",
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async (event) => {
    const db = getFirestore();
    
    try {
      // 1. Buscar posts pendentes para publicar
      const now = new Date();
      const pendingPosts = await db
        .collection('socialMediaQueue')
        .where('status', '==', 'pending')
        .where('scheduledFor', '<=', now)
        .orderBy('scheduledFor', 'asc')
        .orderBy('priority', 'desc')
        .limit(10)
        .get();

      for (const doc of pendingPosts.docs) {
        const queueItem = doc.data() as QueuedPost;
        
        // 2. Buscar dados do post completo
        const postDoc = await db
          .collection('scheduledPosts')
          .doc(queueItem.postId)
          .get();
          
        if (!postDoc.exists) continue;
        const post = postDoc.data() as ScheduledPost;

        // 3. Buscar token do usuário para a plataforma
        const userAccountDoc = await db
          .collection('userSocialAccounts')
          .where('userId', '==', queueItem.userId)
          .where('platform', '==', queueItem.platform)
          .where('isActive', '==', true)
          .limit(1)
          .get();

        if (userAccountDoc.empty) {
          // Marcar como falha - usuário não tem conta conectada
          await doc.ref.update({
            status: 'failed',
            lastError: 'User account not connected for this platform'
          });
          continue;
        }

        const userAccount = userAccountDoc.docs[0].data() as UserSocialAccount;

        // 4. Verificar se token não expirou
        if (userAccount.expiresAt.toDate() < now) {
          // Tentar refresh do token
          const refreshed = await refreshToken(userAccount);
          if (!refreshed) {
            await doc.ref.update({
              status: 'failed',
              lastError: 'Token expired and refresh failed'
            });
            continue;
          }
        }

        // 5. Publicar no platform específico
        let result;
        switch (queueItem.platform) {
          case 'linkedin':
            result = await publishToLinkedIn(
              userAccount.accessToken, 
              post.content, 
              post.mediaUrls
            );
            break;
          case 'twitter':
            result = await publishToTwitter(
              userAccount.accessToken, 
              post.content, 
              post.mediaUrls
            );
            break;
          case 'facebook':
            result = await publishToFacebook(
              userAccount.accessToken, 
              post.content, 
              post.mediaUrls
            );
            break;
          case 'instagram':
            result = await publishToInstagram(
              userAccount.accessToken, 
              post.content, 
              post.mediaUrls
            );
            break;
          default:
            result = { success: false, error: 'Unsupported platform' };
        }

        // 6. Atualizar status do queue item
        if (result.success) {
          await doc.ref.update({
            status: 'completed',
            publishedAt: new Date()
          });

          // Atualizar resultado no post principal
          await postDoc.ref.update({
            [`results.${queueItem.platform}`]: {
              success: true,
              postId: result.postId
            }
          });
        } else {
          const attempts = queueItem.attempts + 1;
          if (attempts >= 3) {
            // Máximo de tentativas atingido
            await doc.ref.update({
              status: 'failed',
              lastError: result.error,
              attempts: attempts
            });
          } else {
            // Tentar novamente em 15 minutos
            await doc.ref.update({
              attempts: attempts,
              lastError: result.error,
              scheduledFor: new Date(now.getTime() + 15 * 60 * 1000)
            });
          }
        }

        // Atualizar último uso da conta
        await userAccountDoc.docs[0].ref.update({
          lastUsed: new Date()
        });
      }
    } catch (error) {
      console.error('Error in social media processor:', error);
    }
  }
);
```

---

## 🛠️ Setup e Configuração

### 1. **Variáveis de Ambiente**

```env
# OAuth Credentials
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret

TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret

FACEBOOK_CLIENT_ID=your_facebook_client_id
FACEBOOK_CLIENT_SECRET=your_facebook_client_secret

INSTAGRAM_CLIENT_ID=your_instagram_client_id
INSTAGRAM_CLIENT_SECRET=your_instagram_client_secret

# NextAuth
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your_nextauth_secret

# Firebase
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email
```

### 2. **Dependências Necessárias**

```json
{
  "dependencies": {
    "next-auth": "^4.24.5",
    "@next-auth/firebase-adapter": "^1.0.6",
    "firebase": "^10.7.1",
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^4.5.0"
  }
}
```

### 3. **OAuth App Configuration**

#### LinkedIn
- **Redirect URL**: `https://yourdomain.com/api/auth/callback/linkedin`
- **Scopes**: `r_liteprofile`, `r_emailaddress`, `w_member_social`

#### Twitter/X
- **Redirect URL**: `https://yourdomain.com/api/auth/callback/twitter`
- **Scopes**: `tweet.read`, `tweet.write`, `users.read`

#### Facebook
- **Redirect URL**: `https://yourdomain.com/api/auth/callback/facebook`
- **Scopes**: `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`

---

## 📊 Features Principais

### ✅ **O que o Sistema Oferece**

1. **🔐 OAuth Social Login**
   - Usuários conectam suas próprias contas
   - Tokens seguros e auto-renováveis
   - Suporte a múltiplas plataformas

2. **📝 Editor de Posts**
   - Rich text editor
   - Upload de imagens/vídeos
   - Preview em tempo real
   - Templates salvos

3. **⏰ Agendamento Inteligente**
   - Agendamento individual ou em lote
   - Fusos horários personalizados
   - Melhor horário sugerido
   - Calendário visual

4. **📊 Analytics e Relatórios**
   - Métricas de engagement
   - Histórico de posts
   - Performance por plataforma
   - Relatórios exportáveis

5. **🎯 Gestão de Fila**
   - Priorização de posts
   - Retry automático
   - Status em tempo real
   - Notificações de falhas

### 🚀 **Funcionalidades Avançadas**

1. **🤖 IA Integration**
   - Sugestões de conteúdo
   - Otimização de hashtags
   - Melhor horário de posting
   - Análise de sentimento

2. **👥 Multi-User Support**
   - Equipes e permissões
   - Aprovação de posts
   - Comentários internos
   - Histórico de alterações

3. **🔗 Cross-Platform Features**
   - Adaptação automática de conteúdo
   - Hashtags específicas por plataforma
   - Formatos otimizados
   - Links personalizados

---

## 🎯 Como Adaptar para Cliente

### 1. **Remover Elementos GateX**
```bash
# Scripts de limpeza
./scripts/remove-gatex-branding.sh
./scripts/update-configs.sh
./scripts/rebrand-components.sh
```

### 2. **Configurar Novo Branding**
```typescript
// config/branding.ts
export const BRAND_CONFIG = {
  name: "Social Media Manager",
  logo: "/logo-client.png",
  colors: {
    primary: "#your-primary-color",
    secondary: "#your-secondary-color"
  },
  domain: "yourdomain.com"
}
```

### 3. **Estrutura White-Label**
```
src/
├── core/                          # Core functionality (não tocar)
├── branding/                      # Client-specific branding
├── config/                        # Client configuration
└── customizations/                # Client customizations
```

---

## 📈 Roadmap e Extensões

### 🔮 **Próximas Features**

1. **📱 Mobile App** (React Native)
2. **🎨 Canva Integration** (Design templates)
3. **📺 Video Scheduling** (TikTok, YouTube Shorts)
4. **🤝 Team Collaboration** (Aprovações, comentários)
5. **📊 Advanced Analytics** (ROI tracking, competitor analysis)
6. **🔗 Zapier Integration** (Automations)
7. **💬 AI Chatbot** (Content suggestions)

### 💰 **Monetização**

1. **📦 Planos Freemium**
   - Free: 10 posts/mês
   - Pro: 100 posts/mês + analytics
   - Business: Unlimited + team features

2. **🏢 White-Label Licensing**
   - License por cliente
   - Customização completa
   - Suporte dedicado

---

## 🚀 Conclusão

Este sistema oferece uma solução completa e escalável para gerenciamento de redes sociais, com foco na experiência do usuário e na facilidade de uso. A arquitetura OAuth garante que cada usuário mantenha controle total sobre suas contas, enquanto o sistema oferece automação poderosa e insights valiosos.

**Ready to launch! 🎯**
