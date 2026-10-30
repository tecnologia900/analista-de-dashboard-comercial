const { app, BrowserWindow, Menu, dialog } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

const unico = app.requestSingleInstanceLock();
if (!unico) app.quit();

let janela = null;
let filho = null;
let encerrando = false;
let avisou = false;

function caminhos() {
  if (app.isPackaged) {
    const base = process.resourcesPath;
    return {
      servidor: path.join(base, 'server', 'app.mjs'),
      web: path.join(base, 'web'),
    };
  }
  const raiz = path.resolve(__dirname, '..');
  return {
    servidor: path.join(raiz, 'server', 'dist', 'app.mjs'),
    web: path.join(raiz, 'web', 'dist'),
  };
}

function portaLivre() {
  return new Promise((resolve, reject) => {
    const servidor = net.createServer();
    servidor.once('error', reject);
    servidor.listen(0, '127.0.0.1', () => {
      const endereco = servidor.address();
      const porta = typeof endereco === 'object' && endereco ? endereco.port : 0;
      servidor.close(() => resolve(porta));
    });
  });
}

function esperar(url) {
  const inicio = Date.now();
  return new Promise((resolve, reject) => {
    const tentar = () => {
      if (encerrando) return reject(new Error('encerrado'));
      const pedido = http.get(url, (resposta) => {
        resposta.resume();
        if ((resposta.statusCode ?? 500) < 500) resolve();
        else if (Date.now() - inicio > 20000) reject(new Error('demora'));
        else setTimeout(tentar, 200);
      });
      pedido.on('error', () => {
        if (Date.now() - inicio > 20000) reject(new Error('demora'));
        else setTimeout(tentar, 200);
      });
    };
    tentar();
  });
}

function htmlAbertura() {
  return `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Painel do Gerente</title></head>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#101c2e;color:#e7ece8;font-family:Segoe UI,sans-serif">
<p style="font-size:18px">Abrindo o painel…</p>
</body></html>`)}`;
}

function encerrarFilho() {
  if (!filho || filho.killed) return;
  filho.kill();
}

function mostrarFalha(texto) {
  if (avisou) return;
  avisou = true;
  const detalhe = texto.trim().slice(-1200);
  dialog.showErrorBox('Painel do Gerente', detalhe || 'Não consegui abrir o painel nesta máquina.');
}

async function abrir() {
  const { servidor, web } = caminhos();
  if (!fs.existsSync(servidor) || !fs.existsSync(path.join(web, 'index.html'))) {
    mostrarFalha('Faltam os arquivos do painel. Gere o aplicativo de novo com npm run app.');
    app.quit();
    return;
  }

  Menu.setApplicationMenu(null);
  janela = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Painel do Gerente',
    backgroundColor: '#101c2e',
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  janela.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  await janela.loadURL(htmlAbertura());

  const porta = await portaLivre();
  const base = `http://127.0.0.1:${porta}`;
  const historico = path.join(process.env.APPDATA || path.join(app.getPath('home'), 'AppData', 'Roaming'), 'Painel do Gerente', 'historico');
  let erro = '';
  filho = spawn(process.execPath, [servidor], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      HOST: '127.0.0.1',
      PORT: String(porta),
      DASH_WEB_DIST: web,
      DASH_HISTORICO: historico,
      LOG_LEVEL: 'silent',
    },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  filho.stderr?.on('data', (parte) => {
    erro = (erro + parte.toString()).slice(-4000);
  });
  filho.on('exit', (codigo) => {
    if (encerrando || codigo === 0 || codigo === null) return;
    mostrarFalha(erro);
    app.quit();
  });

  try {
    await esperar(`${base}/api/saude`);
  } catch (falha) {
    if (falha instanceof Error && falha.message === 'encerrado') return;
    encerrando = true;
    encerrarFilho();
    mostrarFalha(erro);
    app.quit();
    return;
  }

  janela.webContents.on('will-navigate', (evento, url) => {
    if (!url.startsWith(`${base}/`)) evento.preventDefault();
  });
  await janela.loadURL(`${base}/`);
}

app.on('second-instance', () => {
  if (!janela) return;
  if (janela.isMinimized()) janela.restore();
  janela.focus();
});

app.on('before-quit', () => {
  encerrando = true;
  encerrarFilho();
});

app.on('window-all-closed', () => app.quit());

if (unico) app.whenReady().then(abrir);
