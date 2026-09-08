const fs = require("fs");
const path = require("path");
const os = require("os");

const PORTA_PADRAO = 3344;

function caminhoConfig(dadosDir) {
  return path.join(dadosDir, "config.json");
}

function lerConfig(dadosDir) {
  const caminho = caminhoConfig(dadosDir);
  if (!fs.existsSync(caminho)) return null;
  try {
    return JSON.parse(fs.readFileSync(caminho, "utf8"));
  } catch {
    return null; // config corrompida — trata como se não existisse, o setup roda de novo
  }
}

function salvarConfig(dadosDir, config) {
  fs.mkdirSync(dadosDir, { recursive: true });
  const completo = { porta: PORTA_PADRAO, ...config };
  fs.writeFileSync(caminhoConfig(dadosDir), JSON.stringify(completo, null, 2));
  return completo;
}

// Acha o IP da máquina na rede local (ex: 192.168.1.23), ignorando
// interfaces internas (localhost) e virtuais óbvias.
function ipLocal() {
  const interfaces = os.networkInterfaces();
  for (const nome of Object.keys(interfaces)) {
    for (const iface of interfaces[nome]) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "127.0.0.1";
}

module.exports = { lerConfig, salvarConfig, ipLocal, PORTA_PADRAO };
