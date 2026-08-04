const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const srcDir = path.join(rootDir, 'src');
const stagingDir = path.join(distDir, 'widget-runtime-staging');

const entries = [
  { type: 'file', source: 'server.js' },
  { type: 'file', source: 'gameEvents.js' },
];

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function removeDirectoryIfExists(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

function copyFileIntoStaging(sourcePath, targetPath) {
  ensureDirectory(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
}

function copyDirectoryIntoStaging(sourceDir, targetDir) {
  ensureDirectory(path.dirname(targetDir));
  fs.cpSync(sourceDir, targetDir, { recursive: true });
}

function getTimestamp() {
  const date = new Date();
  const pad = (n) => String(n).padStart(2, '0');

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('');
}

async function buildZip() {
  ensureDirectory(distDir);
  removeDirectoryIfExists(stagingDir);
  ensureDirectory(stagingDir);

  const outputFileName = `widget-node-runtime-${getTimestamp()}.zip`;
  const outputPath = path.join(distDir, outputFileName);
  const outputRelativePath = path.relative(rootDir, outputPath);

  const output = fs.createWriteStream(outputPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  const done = new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
  });

  archive.pipe(output);

  for (const entry of entries) {
    const absoluteSource = path.join(rootDir, entry.source);
    const absoluteTarget = path.join(stagingDir, entry.source);

    if (!fs.existsSync(absoluteSource)) {
      if (entry.optional) {
        continue;
      }
      throw new Error(`No existe la ruta requerida: ${entry.source}`);
    }

    if (entry.type === 'file') {
      copyFileIntoStaging(absoluteSource, absoluteTarget);
      continue;
    }

    copyDirectoryIntoStaging(absoluteSource, absoluteTarget);
  }

  execSync('npm ci --omit=dev', {
    cwd: stagingDir,
    stdio: 'inherit'
  });

  archive.directory(stagingDir, false);

  await archive.finalize();
  await done;

  removeDirectoryIfExists(stagingDir);

  const sizeBytes = fs.statSync(outputPath).size;
  console.log(`Paquete Node creado: ${outputRelativePath}`);
  console.log(`Tamanio: ${sizeBytes} bytes`);
  console.log('Este zip se puede ejecutar con: node server.js');

  const manifestPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('No se encontró package.json en el paquete.');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log(`Version: ${manifest.version}`);

  const updateJsonPath = path.join(srcDir, 'update.json');
  if (!fs.existsSync(updateJsonPath)) {
    throw new Error('No se encontró update.json en src.');
  }

  const updateJson = JSON.parse(fs.readFileSync(updateJsonPath, 'utf-8'));
  updateJson.version = manifest.version;
  updateJson.zip = outputFileName;

  fs.writeFileSync(updateJsonPath, JSON.stringify(updateJson, null, 2), 'utf-8');
  console.log(`update.json actualizado con version: ${manifest.version}`);
}

buildZip().catch((error) => {
  console.error('Error al crear el paquete.');
  console.error(error.message);
  process.exit(1);
});
