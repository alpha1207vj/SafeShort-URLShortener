import { join } from 'node:path'
import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload'
import { FastifyPluginAsync, FastifyServerOptions } from 'fastify'


export interface AppOptions extends FastifyServerOptions, Partial<AutoloadPluginOptions> {

}
// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {
}

const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts
): Promise<void> => {

  await fastify.register(AutoLoad, {
    dir: join(__dirname, 'plugins'),
    options: opts
  })

  await fastify.register(AutoLoad, {
    dir: join(__dirname, 'routes'),
    options: { prefix: "/v1" }
  })

  // Warmup — runs after all plugins are loaded, before server accepts requests
  fastify.addHook("onReady", async function () {
    try {
      await fetch(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${process.env.GOOGLE_SAFE_BROWSING_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client: { clientId: "safeshort-url-shortener", clientVersion: "1.0.0" },
            threatInfo: {
              threatTypes: ["MALWARE", "SOCIAL_ENGINEERING"],
              platformTypes: ["ANY_PLATFORM"],
              threatEntryTypes: ["URL"],
              threatEntries: [{ url: "https://google.com/" }],
            },
          }),
        }
      );
      this.log.info("Safe Browsing API connection warmed up");
    } catch {
      this.log.warn("Safe Browsing API warmup failed — first request may be slow");
    }
  });
  // Warm up Neon database connection
  try {
    await fastify.db`SELECT 1`
    fastify.log.info("Neon database connection warmed up");
  } catch {
    fastify.log.warn("Neon database warmup failed — first request may be slow");
  }
}

export default app
export { app, options }
