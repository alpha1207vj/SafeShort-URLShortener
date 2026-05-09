

export const PostUrlBody = {
  type: 'object',
  properties: {
    original_url: { type: 'string' }
  },
}

export const ResponseUrlBody = 
{
    
        type: 'object',
        properties: {
           shortUrl: {type : "string"},   // "https://sh.pages.dev/aB3mKz"
           shortId: {type : "string"},   // "aB3mKz"
           originalUrl: {type : "string"} ,// "https://example.com/some/long/path" 
           createdAt: {type : "string"}     // "2026-05-09T20:38:50.138Z"
        }
}