const kill = require('kill-port');

const rawPort = process.argv[2] || process.env.PORT || '5000';
const port = Number(rawPort);

if (!Number.isInteger(port) || port <= 0) {
  console.error(`Invalid port: ${rawPort}`);
  process.exit(1);
}

kill(port, 'tcp')
  .then(() => {
    console.log(`Port ${port} is free.`);
    process.exit(0);
  })
  .catch((error) => {
    // If no process is listening, continue silently.
    const message = String(error && error.message ? error.message : error || '');
    if (message.toLowerCase().includes('could not kill process') || message.toLowerCase().includes('no process')) {
      console.log(`Port ${port} is already free.`);
      process.exit(0);
      return;
    }

    console.error(`Failed to free port ${port}: ${message}`);
    process.exit(1);
  });
