const { build } = require('esbuild');

build({
  entryPoints: ['main.js'],
  bundle: true,
  outfile: '../image-deck.js',
  loader: { '.css': 'file' },
  logLevel: 'debug'
}).catch(() => process.exit(1));
