import { getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logSystemActivity } from "./logSystem";
import { postToLinkedIn, postToTelegram, postToX, renderTemplateFromJob, SocialMediaJob } from "./socialMediaPromotionScheduler";

interface QueueJob {
  id: string;
  jobId: string;
  jobTitle: string;  // CORRETO: API salva como 'jobTitle', não 'title'
  companyName: string;
  status: 'pending' | 'sent' | 'failed';
  platforms: string[] | { linkedin?: boolean; telegram?: boolean; x?: boolean } | any;
  addedBy: string;
  addedAt: string;
  queuePosition: number;
}

/**
 * Função para processar jobs da fila de social media
 * REGRAS: 
 * - Processa APENAS 1 job por execução
 * - Usa o mesmo template dos automáticos
 * - Remove da fila após envio
 */
export async function processSocialMediaQueue(): Promise<void> {
  const db = getFirestore();
  
  try {
    console.log('[SocialQueue] Starting social media queue processing...');
    console.log('[SocialQueue] 🔍 Debugging: Checking database connection...');
    
    // DEBUG: Verificar conexão e total de docs
    const totalDocs = await db.collection('socialMediaQueue').get();
    console.log(`[SocialQueue] 📊 Total documents in socialMediaQueue: ${totalDocs.size}`);
    
    // 1. Buscar APENAS o próximo job da fila (ordenado por queuePosition - FIFO)
    const queueRef = db.collection('socialMediaQueue');
    console.log('[SocialQueue] 🔍 Executing query: status == pending, orderBy queuePosition asc, limit 1');
    
    const pendingJobs = await queueRef
      .where('status', '==', 'pending')
      .orderBy('queuePosition', 'asc')  // Primeiro a entrar, primeiro a sair (FIFO)
      .limit(1)  // APENAS 1 JOB POR VEZ
      .get();
    
    console.log(`[SocialQueue] 📋 Pending jobs found: ${pendingJobs.size}`);
    
    if (pendingJobs.empty) {
      console.log('[SocialQueue] ❌ No pending jobs found in queue');
      
      // DEBUG: Vamos verificar todos os status existentes
      const allJobs = await db.collection('socialMediaQueue').get();
      const statusCount: { [key: string]: number } = {};
      allJobs.forEach(doc => {
        const status = doc.data().status || 'undefined';
        statusCount[status] = (statusCount[status] || 0) + 1;
      });
      console.log('[SocialQueue] 📊 Status breakdown:', statusCount);
      
      return;
    }
    
    const queueDoc = pendingJobs.docs[0];
    const queueJob = { id: queueDoc.id, ...queueDoc.data() } as QueueJob;
    
    console.log(`[SocialQueue] ✅ Processing job: "${queueJob.jobTitle}" (ID: ${queueJob.jobId})`);
    console.log(`[SocialQueue] 📝 Queue job data:`, {
      id: queueJob.id,
      jobId: queueJob.jobId,
      jobTitle: queueJob.jobTitle,
      companyName: queueJob.companyName,
      status: queueJob.status,
      platforms: queueJob.platforms,
      queuePosition: queueJob.queuePosition
    });
    
    try {
      // 2. Buscar dados completos do job
      const jobRef = db.collection('jobs').doc(queueJob.jobId);
      const jobDoc = await jobRef.get();
      
      if (!jobDoc.exists) {
        console.log(`[SocialQueue] Job ${queueJob.jobId} not found, removing from queue`);
        await queueDoc.ref.delete();
        return;
      }
      
      const jobData = jobDoc.data();
      
      // 3. Buscar template centralizado (MESMO dos automáticos)
      const templateSnap = await db.collection("config").doc("socialMediaTemplate").get();
      const templateData = (templateSnap && templateSnap.exists && typeof templateSnap.data === 'function')
        ? templateSnap.data() ?? {}
        : {};
      const template = templateData.template ||
        "🚀 New job: {{title}} at {{companyName}}!\nCheck it out and apply now!\n{{jobUrl}}";
      const templateMediaUrl = templateData.mediaUrl || "";
      
      // 4. Formatar job usando o MESMO template dos automáticos
      const job: SocialMediaJob = {
        id: queueJob.jobId,
        title: jobData?.title || '',
        companyName: jobData?.companyName || '',
        mediaUrl: jobData?.mediaUrl || templateMediaUrl
      };
      
      const message = renderTemplateFromJob(template, job);
      const jobForSend = { ...job, shortDescription: message };
      
      // 5. Enviar para redes sociais (usando as mesmas funções dos automáticos)
      console.log(`[SocialQueue] Sending "${job.title}" to social media platforms...`);
      
      const results = {
        linkedin: false,
        telegram: false,
        x: false
      };
      
      // Enviar apenas para as plataformas selecionadas
      // Converter objeto platforms para array (compatibilidade com API)
      let platforms: string[] = ['linkedin', 'telegram', 'x']; // padrão
      
      if (queueJob.platforms) {
        if (Array.isArray(queueJob.platforms)) {
          // Se já é array, usar diretamente
          platforms = queueJob.platforms;
        } else if (typeof queueJob.platforms === 'object') {
          // Se é objeto (formato da API), converter para array
          platforms = [];
          if (queueJob.platforms.linkedin) platforms.push('linkedin');
          if (queueJob.platforms.telegram) platforms.push('telegram');
          if (queueJob.platforms.x) platforms.push('x');
        }
      }
      
      console.log(`[SocialQueue] Selected platforms: ${platforms.join(', ')}`);
      
      if (platforms.includes('linkedin')) {
        results.linkedin = await postToLinkedIn(jobForSend);
      }
      if (platforms.includes('telegram')) {
        results.telegram = await postToTelegram(jobForSend);
      }
      if (platforms.includes('x')) {
        results.x = await postToX(jobForSend);
      }
      
      // 6. Marcar como processado e REMOVER da fila
      await queueDoc.ref.update({
        status: 'sent',
        sentAt: new Date().toISOString(),
        results: results
      });
      
      // 7. Log da atividade
      await logSystemActivity(
        "system",
        "SocialMediaQueueScheduler",
        {
          jobId: queueJob.jobId,
          jobTitle: job.title,
          companyName: job.companyName,
          platforms: platforms,
          results: results,
          queuePosition: 1,
          timestamp: new Date().toISOString(),
          status: "success"
        }
      );
      
      console.log(`[SocialQueue] ✅ Successfully sent "${job.title}" to social media`);
      console.log(`[SocialQueue] Results: LinkedIn=${results.linkedin}, Telegram=${results.telegram}, X=${results.x}`);
      
    } catch (jobError: any) {
      console.error(`[SocialQueue] ❌ Error processing job ${queueJob.jobId}:`, jobError.message);
      
      // Marcar como falha
      await queueDoc.ref.update({
        status: 'failed',
        failedAt: new Date().toISOString(),
        error: jobError.message
      });
      
      // Log do erro específico do job
      await logSystemActivity(
        "system",
        "SocialMediaQueueScheduler",
        {
          jobId: queueJob.jobId,
          jobTitle: queueJob.jobTitle,
          error: jobError.message,
          timestamp: new Date().toISOString(),
          status: "job_failed"
        }
      );
    }
    
  } catch (error: any) {
    console.error('[SocialQueue] ❌ Critical error in queue processing:', error.message);
    
    // Log do erro crítico
    await logSystemActivity(
      "system",
      "SocialMediaQueueScheduler",
      {
        error: error.message,
        timestamp: new Date().toISOString(),
        status: "critical_error"
      }
    );
  }
}

/**
 * Função agendada para executar às 09:00 UTC
 * Processa 1 job da fila manual
 */
export const scheduledSocialMediaQueue9AM = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: "UTC",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async (event) => {
    console.log('[SocialQueue] 09:00 UTC execution started');
    await processSocialMediaQueue();
    console.log('[SocialQueue] 09:00 UTC execution completed');
  }
);

/**
 * Função agendada para executar às 12:00 UTC  
 * Processa 1 job da fila manual
 */
export const scheduledSocialMediaQueue12PM = onSchedule(
  {
    schedule: "0 12 * * *",
    timeZone: "UTC", 
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async (event) => {
    console.log('[SocialQueue] 12:00 UTC execution started');
    await processSocialMediaQueue();
    console.log('[SocialQueue] 12:00 UTC execution completed');
  }
);

/**
 * Função agendada para executar às 18:00 UTC
 * Processa 1 job da fila manual  
 */
export const scheduledSocialMediaQueue6PM = onSchedule(
  {
    schedule: "0 18 * * *",
    timeZone: "UTC",
    memory: "256MiB", 
    timeoutSeconds: 120,
  },
  async (event) => {
    console.log('[SocialQueue] 18:00 UTC execution started');
    await processSocialMediaQueue();
    console.log('[SocialQueue] 18:00 UTC execution completed');
  }
);
