import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create default scoring configuration
  const defaultScoringConfig = await prisma.scoringConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      version: '1.0.0',
      isActive: true,
      config: {
        pillars: {
          'technical_readiness': {
            weight: 0.25,
            questions: {
              'tech_stack_maturity': {
                weight: 0.3,
                scoringFunction: 'linear',
                maxScore: 100,
              },
              'development_practices': {
                weight: 0.3,
                scoringFunction: 'linear',
                maxScore: 100,
              },
              'infrastructure_readiness': {
                weight: 0.4,
                scoringFunction: 'threshold',
                maxScore: 100,
              },
            },
          },
          'operational_readiness': {
            weight: 0.25,
            questions: {
              'monitoring_capabilities': {
                weight: 0.4,
                scoringFunction: 'linear',
                maxScore: 100,
              },
              'deployment_automation': {
                weight: 0.3,
                scoringFunction: 'linear',
                maxScore: 100,
              },
              'incident_response': {
                weight: 0.3,
                scoringFunction: 'linear',
                maxScore: 100,
              },
            },
          },
          'business_readiness': {
            weight: 0.25,
            questions: {
              'agent_strategy': {
                weight: 0.4,
                scoringFunction: 'linear',
                maxScore: 100,
              },
              'stakeholder_alignment': {
                weight: 0.3,
                scoringFunction: 'linear',
                maxScore: 100,
              },
              'success_metrics': {
                weight: 0.3,
                scoringFunction: 'linear',
                maxScore: 100,
              },
            },
          },
          'security_readiness': {
            weight: 0.25,
            questions: {
              'data_protection': {
                weight: 0.4,
                scoringFunction: 'threshold',
                maxScore: 100,
              },
              'access_controls': {
                weight: 0.3,
                scoringFunction: 'threshold',
                maxScore: 100,
              },
              'compliance_requirements': {
                weight: 0.3,
                scoringFunction: 'linear',
                maxScore: 100,
              },
            },
          },
        },
      },
      createdBy: 'system',
    },
  });

  console.log('✅ Created default scoring configuration:', defaultScoringConfig.id);

  // Create sample test user (for development)
  const testUser = await prisma.user.upsert({
    where: { clerkId: 'test_user_clerk_id' },
    update: {},
    create: {
      clerkId: 'test_user_clerk_id',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    },
  });

  console.log('✅ Created test user:', testUser.email);

  // Create sample audit session
  const testSession = await prisma.auditSession.upsert({
    where: { id: 'test-session-1' },
    update: {},
    create: {
      id: 'test-session-1',
      userId: testUser.id,
      status: 'DRAFT',
    },
  });

  console.log('✅ Created test audit session:', testSession.id);

  // Create sample answers for the test session
  const sampleAnswers = [
    {
      questionKey: 'company_size',
      stepId: 'step_1',
      value: { size: 'medium', employees: '50-200' },
    },
    {
      questionKey: 'tech_stack',
      stepId: 'step_2',
      value: { 
        frontend: ['React', 'TypeScript'], 
        backend: ['Node.js', 'PostgreSQL'],
        cloud: ['AWS', 'Vercel']
      },
    },
    {
      questionKey: 'current_ai_usage',
      stepId: 'step_3',
      value: { 
        using_ai: true, 
        tools: ['ChatGPT', 'GitHub Copilot'],
        use_cases: ['code_generation', 'documentation']
      },
    },
  ];

  for (const answer of sampleAnswers) {
    await prisma.auditAnswer.upsert({
      where: {
        unique_session_question: {
          auditSessionId: testSession.id,
          questionKey: answer.questionKey,
        },
      },
      update: {
        value: answer.value,
        updatedAt: new Date(),
      },
      create: {
        auditSessionId: testSession.id,
        questionKey: answer.questionKey,
        stepId: answer.stepId,
        value: answer.value,
      },
    });
  }

  console.log('✅ Created sample audit answers');

  // Create sample chat message
  await prisma.chatMessage.create({
    data: {
      auditSessionId: testSession.id,
      role: 'USER',
      content: 'Hello, can you help me understand what agent readiness means?',
      tokens: 12,
    },
  });

  await prisma.chatMessage.create({
    data: {
      auditSessionId: testSession.id,
      role: 'ASSISTANT',
      content: 'Agent readiness refers to how prepared your organization is to successfully implement and deploy AI agents. This includes technical infrastructure, operational processes, business strategy, and security measures.',
      tokens: 45,
      metadata: {
        stepContext: 'step_1',
        suggestions: ['technical_assessment', 'operational_review'],
      },
    },
  });

  console.log('✅ Created sample chat messages');

  // Create sample anonymous session
  const anonymousSession = await prisma.auditSession.create({
    data: {
      anonymousId: 'anonymous-demo-session',
      status: 'DRAFT',
    },
  });

  console.log('✅ Created anonymous demo session:', anonymousSession.id);

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });