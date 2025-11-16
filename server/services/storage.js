/*
  Service de stockage unifié (local ou S3/R2)
  - En mode local: rien à faire ici (les fichiers sont écrits par Multer sur le disque)
  - En mode S3/R2: upload en buffer et lecture/stream vers la réponse HTTP

  Variables d'environnement attendues pour S3/R2:
    STORAGE_DRIVER=s3
    S3_BUCKET=nom-du-bucket
    S3_REGION=auto (ou us-east-1)
    S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
    S3_ACCESS_KEY_ID=...
    S3_SECRET_ACCESS_KEY=...
*/

const { Readable } = require('stream');

// Nettoie les variables d'environnement: supprime espaces et guillemets autour
function cleanEnv(val) {
  try {
    return String(val ?? '').trim().replace(/^['"]|['"]$/g, '');
  } catch (_) {
    return '';
  }
}

let S3Client, PutObjectCommand, GetObjectCommand;
try {
  ({ S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3'));
} catch (_) {
  // Dépendance pas encore installée, pas bloquant tant que le mode S3 n'est pas activé
}

const USE_S3 = cleanEnv(process.env.STORAGE_DRIVER).toLowerCase() === 's3';

let s3 = null;
function getS3Client() {
  if (!USE_S3) return null;
  if (s3) return s3;
  if (!S3Client) throw new Error('Le module @aws-sdk/client-s3 est manquant. Installez-le d\'abord.');

  const region = cleanEnv(process.env.S3_REGION) || 'auto';
  const endpoint = cleanEnv(process.env.S3_ENDPOINT);
  const accessKeyId = cleanEnv(process.env.S3_ACCESS_KEY_ID);
  const secretAccessKey = cleanEnv(process.env.S3_SECRET_ACCESS_KEY);

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('Configuration S3/R2 incomplète: S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY requis');
  }

  s3 = new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
  return s3;
}

function isS3Enabled() {
  return USE_S3;
}

async function uploadBuffer(key, contentType, buffer) {
  if (!USE_S3) return false;
  if (!key || !buffer) throw new Error('uploadBuffer: paramètres invalides');
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET manquant');
  const client = getS3Client();
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType || 'application/octet-stream',
  });
  await client.send(cmd);
  return true;
}

async function streamToResponse(res, key) {
  if (!USE_S3) throw new Error('streamToResponse appelé sans S3');
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET manquant');
  const client = getS3Client();
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  const data = await client.send(cmd);
  if (data.ContentType) res.set('Content-Type', data.ContentType);
  if (data.ContentLength != null) res.set('Content-Length', String(data.ContentLength));
  if (data.ETag) res.set('ETag', data.ETag);
  // data.Body est un stream Node.js
  const bodyStream = data.Body;
  if (bodyStream && typeof bodyStream.pipe === 'function') {
    bodyStream.pipe(res);
  } else if (bodyStream) {
    Readable.from(bodyStream).pipe(res);
  } else {
    res.status(404).send('Fichier non trouvé');
  }
}

module.exports = {
  isS3Enabled,
  uploadBuffer,
  streamToResponse,
};
