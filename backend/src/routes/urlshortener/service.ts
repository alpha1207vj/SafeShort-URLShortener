import  { FastifyInstance } from "fastify";


export default function UrlShortenerFunction()
{

}

export function VerifyIsUrl(fastify: FastifyInstance, longUrl: string): string {
  
  let baseUrl: URL
  
  // Separate the URL parsing from your validation
  try {
    baseUrl = new URL(longUrl)
  } catch (error) {
    throw fastify.httpErrors.badRequest("The URL provided is not valid")
  }
// Validation outside try/catch so errors aren't swallowed
  // Validation outside try/catch so errors aren't swallowed
  if (baseUrl.protocol !== 'https:') {
    throw fastify.httpErrors.badRequest("Protocol must be strictly https")
  }
  // Validation outside try/catch verifying if the hostname is correct and not already used by the application
  if (baseUrl.hostname === "sh.pages.dev") {
    throw fastify.httpErrors.badRequest("URLs pointing to sh.pages.dev are not allowed")
  }

  return baseUrl.href
}

