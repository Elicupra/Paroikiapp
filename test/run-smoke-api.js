const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runNode(scriptPath, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd,
      stdio: 'inherit',
      shell: false,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with exit code ${code}`));
    });
  });
}

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);

    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      resolve(false);
    });

    socket.connect(port, host);
  });
}

(async () => {
  let serverProcess;
  let startedByRunner = false;

  try {
    const alreadyRunning = await isPortOpen(3001);

    if (alreadyRunning) {
      console.log('Backend ya está corriendo en puerto 3001, reutilizando...');
    } else {
      console.log('Iniciando backend para smoke API...');
      serverProcess = spawn(process.execPath, ['src/server.js'], {
        cwd: backendDir,
        stdio: 'inherit',
        shell: false,
      });
      startedByRunner = true;
      await wait(2500);
    }

    console.log('Ejecutando smoke API...');
    await runNode(path.join(rootDir, 'test', 'smoke-admin-assignments.js'), rootDir);

    console.log('\nSmoke API completado correctamente');
    process.exit(0);
  } catch (error) {
    console.error('\nSmoke API falló:', error.message);
    process.exit(1);
  } finally {
    if (startedByRunner && serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGTERM');
    }
  }
})();
