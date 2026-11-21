import net from 'node:net';

const PORTS = [
  { port: 4000, service: 'API' },
  { port: 3000, service: 'web' },
];

function isBusy(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const finish = (busy) => {
      socket.destroy();
      resolve(busy);
    };
    socket.setTimeout(500);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

const busy = [];
for (const entry of PORTS) {
  if (await isBusy(entry.port)) busy.push(entry);
}

if (busy.length > 0) {
  console.error('No se puede iniciar: ya hay algo escuchando en');
  for (const { port, service } of busy) {
    console.error(`  - ${service} (127.0.0.1:${port})`);
  }
  console.error('');
  console.error('Suele ser una instancia vieja de la app (por ejemplo, un `npm run start`');
  console.error('anterior) que sigue ocupando el puerto. Revisá con:');
  console.error("  ss -ltnp | grep -E ':(3000|4000)\\b'");
  console.error('y cerrá ese proceso antes de volver a ejecutar `npm run dev`.');
  process.exit(1);
}
