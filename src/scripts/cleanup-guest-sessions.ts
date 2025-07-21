#!/usr/bin/env tsx
// Scheduled cleanup script for guest sessions
// Part of Task 2.4: Guest User Flow Enhancement
// 
// Usage:
//   npm run cleanup:guests -- --dry-run
//   npm run cleanup:guests -- --days=60 --include-email
//   npm run cleanup:guests -- --force

import { PrismaClient } from '@prisma/client';
import { getGuestSessionsForCleanup, GUEST_SESSION_CONFIG } from '../utils/guestSession';

const prisma = new PrismaClient();

interface CleanupOptions {
  dryRun: boolean;
  olderThanDays: number;
  includeWithEmail: boolean;
  batchSize: number;
  force: boolean;
}

async function parseArgs(): Promise<CleanupOptions> {
  const args = process.argv.slice(2);
  
  const options: CleanupOptions = {
    dryRun: true,
    olderThanDays: GUEST_SESSION_CONFIG.CLEANUP_AFTER_DAYS,
    includeWithEmail: false,
    batchSize: 100,
    force: false,
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--force') {
      options.force = true;
      options.dryRun = false;
    } else if (arg === '--include-email') {
      options.includeWithEmail = true;
    } else if (arg.startsWith('--days=')) {
      const days = parseInt(arg.split('=')[1]);
      if (isNaN(days) || days < 1) {
        throw new Error('Invalid days value. Must be a positive integer.');
      }
      options.olderThanDays = days;
    } else if (arg.startsWith('--batch-size=')) {
      const size = parseInt(arg.split('=')[1]);
      if (isNaN(size) || size < 1) {
        throw new Error('Invalid batch size. Must be a positive integer.');
      }
      options.batchSize = size;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Guest Session Cleanup Script

Usage:
  npm run cleanup:guests [options]

Options:
  --dry-run              Show what would be deleted without actually deleting (default)
  --force                Actually perform the deletion
  --days=N               Delete sessions older than N days (default: ${GUEST_SESSION_CONFIG.CLEANUP_AFTER_DAYS})
  --include-email        Include sessions that have email captured (default: false)
  --batch-size=N         Process N sessions at a time (default: 100)
  --help, -h             Show this help message

Examples:
  npm run cleanup:guests                    # Dry run with default settings
  npm run cleanup:guests -- --force        # Actually delete old sessions
  npm run cleanup:guests -- --days=60      # Delete sessions older than 60 days
  npm run cleanup:guests -- --include-email --force  # Delete all old sessions including those with email
      `);
      process.exit(0);
    } else {
      console.warn(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

async function getCleanupStats(options: CleanupOptions) {
  console.log('📊 Analyzing guest sessions for cleanup...\n');

  const cutoffDate = new Date(Date.now() - options.olderThanDays * 24 * 60 * 60 * 1000);
  
  // Get comprehensive statistics
  const [
    totalGuests,
    eligibleSessions,
    withEmail,
    withoutEmail,
    withProgress,
  ] = await Promise.all([
    prisma.auditSession.count({
      where: { anonymousId: { not: null } },
    }),
    
    getGuestSessionsForCleanup({
      olderThanDays: options.olderThanDays,
      includeWithEmail: options.includeWithEmail,
      limit: 10000, // Large limit for counting
    }),
    
    prisma.auditSession.count({
      where: {
        anonymousId: { not: null },
        updatedAt: { lt: cutoffDate },
        guestEmail: { not: null },
      },
    }),
    
    prisma.auditSession.count({
      where: {
        anonymousId: { not: null },
        updatedAt: { lt: cutoffDate },
        guestEmail: null,
      },
    }),
    
    prisma.auditSession.count({
      where: {
        anonymousId: { not: null },
        updatedAt: { lt: cutoffDate },
        answers: { some: {} },
      },
    }),
  ]);

  // Calculate statistics
  const eligibleCount = eligibleSessions.length;
  const totalAnswers = eligibleSessions.reduce((sum, s) => sum + s._count.answers, 0);
  const totalMessages = eligibleSessions.reduce((sum, s) => sum + s._count.chatMessages, 0);

  console.log(`Current guest session statistics:`);
  console.log(`  Total guest sessions: ${totalGuests}`);
  console.log(`  Sessions older than ${options.olderThanDays} days: ${withEmail + withoutEmail}`);
  console.log(`    - With email captured: ${withEmail}`);
  console.log(`    - Without email: ${withoutEmail}`);
  console.log(`    - With some progress: ${withProgress}`);
  console.log(`  Eligible for cleanup: ${eligibleCount}`);
  console.log(`    - Answers to delete: ${totalAnswers}`);
  console.log(`    - Chat messages to delete: ${totalMessages}`);
  console.log(`  Cutoff date: ${cutoffDate.toISOString()}`);
  console.log('');

  return {
    eligibleSessions,
    stats: {
      totalGuests,
      eligibleCount,
      totalAnswers,
      totalMessages,
      withEmail,
      withoutEmail,
      withProgress,
    },
  };
}

async function performCleanup(eligibleSessions: any[], options: CleanupOptions) {
  if (eligibleSessions.length === 0) {
    console.log('✅ No sessions to clean up.');
    return { deleted: 0 };
  }

  console.log(`🧹 ${options.dryRun ? 'Would delete' : 'Deleting'} ${eligibleSessions.length} sessions...`);

  let deletedCount = 0;
  const { batchSize } = options;

  // Process in batches
  for (let i = 0; i < eligibleSessions.length; i += batchSize) {
    const batch = eligibleSessions.slice(i, i + batchSize);
    const sessionIds = batch.map(s => s.id);

    if (!options.dryRun) {
      try {
        await prisma.$transaction(async (tx) => {
          // Delete related data (cascade should handle this, but being explicit)
          await tx.chatMessage.deleteMany({
            where: { auditSessionId: { in: sessionIds } },
          });

          await tx.auditAnswer.deleteMany({
            where: { auditSessionId: { in: sessionIds } },
          });

          // Delete sessions
          await tx.auditSession.deleteMany({
            where: { id: { in: sessionIds } },
          });
        });
      } catch (error) {
        console.error(`❌ Error deleting batch ${Math.floor(i / batchSize) + 1}:`, error);
        throw error;
      }
    }

    deletedCount += batch.length;
    const progress = Math.round((deletedCount / eligibleSessions.length) * 100);
    console.log(`  ${options.dryRun ? 'Would process' : 'Processed'} batch ${Math.floor(i / batchSize) + 1}: ${deletedCount}/${eligibleSessions.length} (${progress}%)`);
  }

  return { deleted: deletedCount };
}

async function main() {
  try {
    console.log('🚀 Guest Session Cleanup Script Starting...\n');

    const options = await parseArgs();

    // Validate options
    if (!options.force && !options.dryRun) {
      console.error('❌ Error: Either --dry-run or --force must be specified');
      process.exit(1);
    }

    console.log(`Configuration:`);
    console.log(`  Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE DELETION'}`);
    console.log(`  Delete sessions older than: ${options.olderThanDays} days`);
    console.log(`  Include sessions with email: ${options.includeWithEmail}`);
    console.log(`  Batch size: ${options.batchSize}`);
    console.log('');

    // Get cleanup statistics
    const { eligibleSessions, stats } = await getCleanupStats(options);

    // Confirm deletion if not dry run
    if (!options.dryRun && eligibleSessions.length > 0) {
      console.log('⚠️  WARNING: This will permanently delete guest session data!');
      console.log(`   ${stats.eligibleCount} sessions, ${stats.totalAnswers} answers, ${stats.totalMessages} messages`);
      console.log('');
      
      // In a real script, you might want to add a confirmation prompt
      console.log('🔄 Proceeding with deletion in 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Perform cleanup
    const result = await performCleanup(eligibleSessions, options);

    // Summary
    console.log('');
    console.log('📋 Cleanup Summary:');
    console.log(`  Sessions ${options.dryRun ? 'that would be deleted' : 'deleted'}: ${result.deleted}`);
    console.log(`  Mode: ${options.dryRun ? 'DRY RUN - No data was actually deleted' : 'LIVE DELETION'}`);
    
    if (options.dryRun) {
      console.log('');
      console.log('💡 To actually perform the cleanup, run with --force instead of --dry-run');
    } else {
      console.log('');
      console.log('✅ Guest session cleanup completed successfully!');
    }

  } catch (error) {
    console.error('❌ Guest session cleanup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  main();
}