const ngrok = require('@ngrok/ngrok');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function getAuthtoken() {
  if (process.env.NGROK_AUTHTOKEN) return process.env.NGROK_AUTHTOKEN;
  
  // Check Windows Registry User Environment
  try {
    const regOutput = execSync('reg.exe query HKCU\\Environment /v NGROK_AUTHTOKEN', { encoding: 'utf8' });
    const match = regOutput.match(/NGROK_AUTHTOKEN\s+REG_SZ\s+([^\r\n]+)/);
    if (match && match[1]) return match[1].trim();
  } catch {}

  // Check ngrok.yml
  try {
    const configPath = path.join(process.env.LOCALAPPDATA || '', 'ngrok', 'ngrok.yml');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const match = content.match(/authtoken:\s*([^\s\r\n]+)/);
      if (match) return match[1].replace(/["']/g, '');
    }
  } catch {}

  return null;
}

process.on('uncaughtException', (err) => {
  console.error('[TUNNEL UNCAUGHT EXCEPTION]', err.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[TUNNEL UNHANDLED REJECTION]', reason);
});

async function startTunnel() {
  const port = process.env.PORT || 3001;
  const authtoken = await getAuthtoken();
  const opts = { addr: port };
  if (authtoken) {
    opts.authtoken = authtoken;
  }

  try {
    console.log(`[TUNNEL] Starting ngrok forward on port ${port}...`);
    const listener = await ngrok.forward(opts);
    const publicUrl = listener.url();
    console.log(`[TUNNEL] ==========================================`);
    console.log(`[TUNNEL] NGROK PUBLIC URL: ${publicUrl}`);
    console.log(`[TUNNEL] ==========================================`);

    const envPath = path.resolve(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      if (envContent.includes('CLASSPULSE_PUBLIC_URL=')) {
        envContent = envContent.replace(
          /CLASSPULSE_PUBLIC_URL=.*/g,
          `CLASSPULSE_PUBLIC_URL=${publicUrl}`
        );
      } else {
        envContent += `\nCLASSPULSE_PUBLIC_URL=${publicUrl}\n`;
      }
      fs.writeFileSync(envPath, envContent, 'utf8');
    }

    // Un-ending keep-alive timer
    setInterval(() => {
      const ts = new Date().toISOString().substring(11, 19);
      console.log(`[TUNNEL KEEP-ALIVE ${ts}] ${publicUrl}`);
    }, 15000);
  } catch (err) {
    console.error(`[TUNNEL ERROR] ${err.message}`);
    setTimeout(startTunnel, 5000);
  }
}

startTunnel();