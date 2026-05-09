import type { FastifyPluginAsync, FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  VerifyIsUrl,
  CheckIsRecursive,
  NormalizeUrl,
  VerifyIsSecureUrl,
  GenerateShortId,
  applyNoIndexHeader,
  GenerateCreatedAt
} from "./service";
import { PostUrlBody, ResponseUrlBody } from "./schema";

export interface BodyRoute {
  original_url: string;
}

const ShortenerRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.route({
    method: "POST",
    url: "/",
    schema: {
      body: PostUrlBody,
      response: {
        201: ResponseUrlBody, // changed from 200 → 201 to match what we send back
      },
    },
    handler: async function (
      request: FastifyRequest<{ Body: BodyRoute }>,
      reply: FastifyReply
    ) {
      const { original_url } = request.body;

      // Step 1 — validate format, protocol, self-reference, length
      const validatedUrl = VerifyIsUrl(fastify, original_url);

      // Step 2 — parse into URL object for the recursive check
      const parsedUrl = new URL(validatedUrl);

      // Step 3 — block circular redirects (sh.pages.dev pointing to itself)
      CheckIsRecursive(fastify, parsedUrl);

      // Step 4 — Safe Browsing on the original URL before any modification
await VerifyIsSecureUrl(fastify, validatedUrl);

// Step 5 — normalize AFTER the security check
const normalizedUrl = NormalizeUrl(validatedUrl);
      // Step 6 — generate the short ID
      const shortId = GenerateShortId();
      const shortUrl = `https://sh.pages.dev/${shortId}`;
    // Step 7 — generate creation metadata for the DB
  const createdAt = GenerateCreatedAt();  

await fastify.db`
  INSERT INTO url_links ( original_url, short_url)
  VALUES ( ${normalizedUrl},${shortUrl})
`
// Step 8 — no index header
applyNoIndexHeader(reply);
      // Step 8 — return the result
      return reply.code(201).send({
        shortId,
        originalUrl: normalizedUrl,
        shortUrl: `https://sh.pages.dev/${shortId}`,
        createdAt
      });
    },
  });
};

export default ShortenerRoute;