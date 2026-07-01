import { initFirebase, getDb } from '../firebaseAdmin.js';
import { deleteUser, deleteUserBySlug } from '../services/userDeletionService.js';

async function main() {
  await initFirebase();
  const db = getDb();

  if (!db) {
    console.error('[CLI-DELETION] Falha ao inicializar o Firestore.');
    process.exit(1);
  }

  // Parse command line arguments
  const args = process.argv.slice(2);
  let uid = "";
  let slug = "";
  let dryRun = true;

  for (const arg of args) {
    if (arg.startsWith('--uid=')) {
      uid = arg.split('=')[1];
    } else if (arg.startsWith('--slug=')) {
      slug = arg.split('=')[1];
    } else if (arg === '--apply') {
      dryRun = false;
    }
  }

  if (!uid && !slug) {
    console.log("================================================================");
    console.log("Nera - Ferramenta Administrativa de Exclusão de Usuários");
    console.log("================================================================");
    console.log("Uso:");
    console.log("  npx tsx server/scripts/deleteUser.ts --uid=<user_uid> [--apply]");
    console.log("  npx tsx server/scripts/deleteUser.ts --slug=<user_slug> [--apply]");
    console.log("\nArgumentos:");
    console.log("  --uid     UID do usuário no Firebase.");
    console.log("  --slug    Slug (nome do profissional) cadastrado.");
    console.log("  --apply   Executa a exclusão REAL. Se omitido, executa apenas o DRY-RUN (relatório).");
    console.log("================================================================");
    process.exit(1);
  }

  try {
    console.log(`[CLI-DELETION] Modo: ${dryRun ? 'DRY-RUN (Simulação)' : 'REAL (Exclusão definitiva)'}`);
    console.log(`[CLI-DELETION] Identificador: ${uid ? `UID: ${uid}` : `SLUG: ${slug}`}`);
    console.log(`[CLI-DELETION] Buscando dados...`);

    let report;
    if (uid) {
      report = await deleteUser(uid, { dryRun });
    } else {
      report = await deleteUserBySlug(slug, { dryRun });
    }

    console.log("\n================================================================");
    console.log("RELATÓRIO DE IMPACTO DA EXCLUSÃO");
    console.log("===============================================================");
    console.log(`UID do Usuário:        ${report.uid}`);
    console.log(`Slug Cadastrado:       ${report.slug || '(não possui ou não resolvido)'}`);
    console.log(`Existe no Auth:        ${report.authUser ? 'Sim' : 'Não'}`);
    console.log(`Perfil do Usuário:     ${report.profile} documento(s)`);
    console.log(`Agendamentos:          ${report.appointments} documento(s)`);
    console.log(`Clientes (Resumos):    ${report.clients} documento(s)`);
    console.log(`Bloqueios de Agenda:   ${report.blockedSlots} documento(s)`);
    console.log(`Eventos Analytics:     ${report.analyticsEvents} documento(s)`);
    console.log(`Histórico / Logs / Alertas: ${report.auditLogs} documento(s)`);
    console.log(`Arquivos no Storage:   ${report.storageFiles} arquivo(s)`);
    console.log(`Coleções Afetadas:     ${report.collectionsAffected.join(', ') || 'Nenhuma'}`);
    console.log(`Estimativa de Exclusões Totais: ${report.estimatedDeletes}`);
    console.log("----------------------------------------------------------------");
    console.log(`Registros de Terceiros a Anonimizar: ${report.anonymizedRecordsCount || 0}`);
    if (report.message) {
      console.log(`  Nota: ${report.message}`);
    }
    if (report.anonymizedDetails && Object.keys(report.anonymizedDetails).length > 0) {
      for (const [colName, count] of Object.entries(report.anonymizedDetails)) {
        console.log(`  - ${colName}: ${count} documento(s)`);
      }
    } else {
      console.log("  Nenhum registro de terceiro precisa de anonimização.");
    }
    console.log("================================================================");

    if (dryRun) {
      console.log("\n[CLI-DELETION] Simulação concluída. Nenhum dado foi alterado.");
      console.log("[CLI-DELETION] Para executar a exclusão REAL, adicione a flag --apply no final do comando.");
    } else {
      console.log("\n[CLI-DELETION] SUCESSO! Todos os dados e referências do usuário foram removidos com sucesso.");
    }

    process.exit(0);
  } catch (err: any) {
    console.error(`\n[CLI-DELETION] ERRO CRÍTICO: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[CLI-DELETION] Erro não tratado:', err);
  process.exit(1);
});
