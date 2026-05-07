import { PostUrlBody } from './schema'
import { ResponseUrlBody } from './schema'
import { VerifyIsUrl } from './service'
import { FastifyPluginAsync } from 'fastify'
console.log('urlshortener route loaded')
const NewRoute: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.route({
  method: 'POST',
  url: '/',
  schema: {
    body: PostUrlBody,
    response: {
        200: ResponseUrlBody // It is best practice to specify the status code
      }
  },
  handler: function (request, reply) {
    const {original_url} = request.body as any
    const short_url = VerifyIsUrl(fastify,original_url)
    reply.send({short_url})
  }
})
}

export default NewRoute
