/* BomberBoyz 2 – innstillinger for felles (global) toppliste.
   Står url og key tomme, vises bare listen på denne enheten.
   Slå på global liste ved å fylle inn verdiene fra Supabase (Project Settings → API):
     provider: 'supabase', url: 'https://xxxx.supabase.co', key: '<anon public key>'
   eller fra en Cloudflare Worker:
     provider: 'worker', url: 'https://bomberboyz-top.<konto>.workers.dev', key: 'x'
   Se backend/README.md. */
window.BBX_CONFIG = {
  global: { provider: 'supabase', url: '', key: '' },
};
