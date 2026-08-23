function getBlobOptions() {
  const storeId = process.env.BLOB_STORE_ID;
  const oidcToken = process.env.VERCEL_OIDC_TOKEN;
  const readWriteToken = process.env.BLOB_READ_WRITE_TOKEN;

  if (oidcToken || storeId) {
    return {
      access: 'public',
      ...(storeId ? { storeId } : {}),
      ...(oidcToken ? { oidcToken } : {})
    };
  }

  if (readWriteToken) return { access: 'public', token: readWriteToken };
  throw new Error('Vercel Blob is not configured. Set BLOB_STORE_ID with Vercel OIDC or BLOB_READ_WRITE_TOKEN.');
}

module.exports = { getBlobOptions };
