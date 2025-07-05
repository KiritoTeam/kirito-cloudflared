Para instalar a @kirito/cloudflared na sua aplicação basta utilizar 

```npm i @kirito/cloudflared.subservice```

No console.

# Rotas da KiritoApi

```js
const Cloudflared = require('@kirito/cloudflared.subservice');

async function startTunnel(port) {
  try {      
    const bin = await Cloudflared.install_cloudflared();
    if (!bin) {
      console.error("❌ Não foi possível instalar o binário do cloudflared.");
      return;
    }

    const tunnel = new Cloudflared(`http://localhost:${port}`);

    tunnel.on("ready", (info) => {
      console.log(`✅ Cloudflare Tunnel pronto: ${info.url}`);
    });

    tunnel.on("subservice", (info) => {
      console.log(`🔹 Subserviço disponível: [${info.type}] ${info.url}`);
    });

    tunnel.on("timeout", () => {
      console.error("❌ Timeout ao iniciar o túnel Cloudflare: Tunnel could not be started within o tempo limite.");
    });

    tunnel.on("error", (err) => {
      console.error("❌ Erro ao iniciar túnel Cloudflare:", err);
    });

    await tunnel.start(120000); // 2 minutos
  } catch (err) {
    console.error("❌ Erro ao iniciar túnel:", err.message);
  }
}

// Exemplo de uso
startTunnel(3000);

```

Agradecemos por utilizar nossa package.

