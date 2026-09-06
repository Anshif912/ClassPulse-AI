import { config } from '../config';
import { agoraService } from '../services/voice/agora.service';
import { AgoraClient, Agent, GeminiLive, Area } from 'agora-agents';
import path from 'path';

async function runGeminiLiveE2EVerification() {
  console.log('====================================================');
  console.log('🎙️ ClassPulse — Gemini Live & Agora Agent Verification');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // 1. Installed agora-agents version check
  console.log('--- 1. Agora Agents SDK Version ---');
  const pkg = require(path.resolve(__dirname, '../../node_modules/agora-agents/package.json'));
  assert(pkg.version === '2.7.0', `Installed agora-agents version is ${pkg.version}`);

  // 2. Configuration & Process Environment Derivation
  console.log('\n--- 2. Configuration Audit ---');
  assert(typeof config.gemini.apiKey === 'string', 'config.gemini.apiKey is derived from process.env');
  assert(typeof config.gemini.isConfigured === 'boolean', 'config.gemini.isConfigured is boolean');
  assert(config.gemini.isConfigured === Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0), 'config.gemini.isConfigured dynamically derives from process.env.GEMINI_API_KEY');

  // 3. Diagnostics endpoint check (Safe, no key exposure)
  console.log('\n--- 3. Backend Diagnostics Verification ---');
  const diag = agoraService.getDiagnostics();
  assert('configured' in diag && typeof diag.configured === 'boolean', 'Diagnostics returns configured: boolean');
  assert('geminiConfigured' in diag && typeof diag.geminiConfigured === 'boolean', 'Diagnostics returns geminiConfigured: boolean');
  assert(!('apiKey' in diag) && !('key' in diag), 'Diagnostics NEVER exposes GEMINI_API_KEY or secrets');
  assert(diag.mllmMode === 'GeminiLive', 'Diagnostics confirms MLLM mode = GeminiLive');
  assert(diag.transport === 'Agora RTC', 'Diagnostics confirms transport = Agora RTC');
  assert(diag.installedAgentsVersion === '2.7.0', 'Diagnostics reports exact agora-agents 2.7.0');

  // 4. GeminiLive MLLM Class Instantiation
  console.log('\n--- 4. GeminiLive MLLM Class Instantiation ---');
  const testKey = config.gemini.apiKey || 'test_placeholder_gemini_key_for_init';
  const mllm = new GeminiLive({
    apiKey: testKey,
    model: 'gemini-live-2.5-flash',
    voice: 'Aoede',
    transcribeAgent: true,
    transcribeUser: true,
    instructions: 'Test instructions',
  });

  const mllmConfig = mllm.toConfig();
  assert(mllmConfig.vendor === 'gemini', 'GeminiLive vendor is "gemini"');
  assert(mllmConfig.params?.model === 'gemini-live-2.5-flash', 'GeminiLive model is gemini-live-2.5-flash');
  assert(mllmConfig.params?.voice === 'Aoede', 'GeminiLive voice is Aoede');
  assert(mllmConfig.params?.transcribe_agent === true, 'GeminiLive transcribe_agent is enabled');
  assert(mllmConfig.params?.transcribe_user === true, 'GeminiLive transcribe_user is enabled');

  // 5. Agora Agent with MLLM Construction (Disables separate STT/TTS)
  console.log('\n--- 5. Agent + withMllm Construction ---');
  const dummyClient = new AgoraClient({
    area: Area.AP,
    appId: config.agora.appId || 'test_app_id_32chars_long_12345678',
    appCertificate: config.agora.appCertificate || 'test_cert_32chars_long_12345678',
  });

  const agent = new Agent({ client: dummyClient })
    .withInstructions('Test instructions')
    .withMllm(mllm);

  const session = agent.createSession({
    channel: 'test_ai_channel',
    agentUid: '9999',
    remoteUids: ['10001'],
    name: 'test_session',
  });

  assert(Boolean(session), 'AgentSession successfully created in MLLM mode');

  // 6. Error & Failure Diagnostics Classification
  console.log('\n--- 6. Failure State & Diagnostic Classification ---');
  
  // Test start with missing Gemini key
  const origKey = config.gemini.apiKey;
  (config.gemini as any).apiKey = '';
  const missingKeyRes = await agoraService.startAgentSession('cls_test', 1234, 'cls_test', 'sess_test');
  assert(missingKeyRes.state === 'unavailable', 'Missing Gemini key reports state: unavailable');
  assert(missingKeyRes.developerDiagnostic === 'Gemini Live not configured', 'Missing key developer diagnostic = "Gemini Live not configured"');
  assert(missingKeyRes.message === 'AI Voice unavailable', 'Missing key user message = "AI Voice unavailable"');

  // Restore key
  (config.gemini as any).apiKey = origKey;

  console.log('\n====================================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runGeminiLiveE2EVerification().catch((err) => {
  console.error('Fatal error in test:', err);
  process.exit(1);
});
