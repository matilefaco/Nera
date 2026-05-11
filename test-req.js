import('./dist-server/server.js').then(async m => {
  console.log('Got server module');
  const app = await m.createServerApp();
  console.log('App created');
}).catch(e => {
  console.error('Fatal:', e);
});
