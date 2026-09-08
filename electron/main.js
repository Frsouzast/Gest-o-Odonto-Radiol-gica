const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const { iniciarServidor } = require("../server/start");
const { lerConfig, salvarConfig, ipLocal, PORTA_PADRAO } = require("../server/config");

Menu.setApplicationMenu(null); // tira a barra File/Edit/View/Window — não é usada aqui

let janelaPrincipal = null;

async function abrirJanelaPrincipal(config, dadosDir) {
  const frontendDist = path.join(__dirname, "..", "frontend", "dist");

  if (config.modo === "servidor") {
    let expressApp;
    try {
      expressApp = await iniciarServidor(dadosDir);
    } catch (err) {
      dialog.showErrorBox("Erro ao iniciar", `Não foi possível iniciar os dados do aplicativo:\n\n${err.message}\n\nOs dados ficam em: ${dadosDir}`);
      app.quit();
      return;
    }
    const express = require("express");
    expressApp.use(express.static(frontendDist));

    const porta = config.porta || PORTA_PADRAO;
    // 0.0.0.0 (não 127.0.0.1): precisa aceitar conexões vindas de outros
    // computadores da rede local, não só desta máquina.
    const server = expressApp.listen(porta, "0.0.0.0", () => {
      const ip = ipLocal();
      janelaPrincipal = new BrowserWindow({ width: 1280, height: 840, title: "Precificação Clínica (Servidor)" });
      janelaPrincipal.loadURL(`http://127.0.0.1:${porta}/?modo=servidor&enderecoRede=${ip}:${porta}`);
      janelaPrincipal.on("closed", () => {
        janelaPrincipal = null;
        server.close();
      });
    });
    server.on("error", (err) => {
      dialog.showErrorBox(
        "Não foi possível abrir a porta",
        `A porta ${porta} já está em uso (talvez o programa já esteja aberto?).\n\nDetalhe: ${err.message}`
      );
      app.quit();
    });
  } else {
    // Modo cliente: não sobe servidor nem banco locais. Só abre a tela,
    // apontando as chamadas de API pro endereço do servidor configurado.
    const porta = config.porta || PORTA_PADRAO;
    const apiBase = `http://${config.servidorHost}:${porta}`;
    janelaPrincipal = new BrowserWindow({ width: 1280, height: 840, title: "Precificação Clínica (Cliente)" });
    janelaPrincipal.loadFile(path.join(frontendDist, "index.html"), {
      query: { modo: "cliente", apiBase },
    });
    janelaPrincipal.on("closed", () => (janelaPrincipal = null));
  }
}

async function iniciar() {
  const dadosDir = app.getPath("userData");
  const configExistente = lerConfig(dadosDir);

  if (configExistente) {
    return abrirJanelaPrincipal(configExistente, dadosDir);
  }

  // Primeira execução: pergunta servidor ou cliente antes de abrir o app de verdade.
  const janelaSetup = new BrowserWindow({
    width: 520,
    height: 560,
    resizable: false,
    title: "Configuração inicial",
    webPreferences: {
      preload: path.join(__dirname, "setup-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  janelaSetup.setMenuBarVisibility(false);
  janelaSetup.loadFile(path.join(__dirname, "setup.html"));

  ipcMain.handleOnce("salvar-modo", async (event, escolha) => {
    const config = salvarConfig(dadosDir, escolha);
    janelaSetup.close();
    await abrirJanelaPrincipal(config, dadosDir);
  });
}

app.whenReady().then(iniciar);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) iniciar();
});
