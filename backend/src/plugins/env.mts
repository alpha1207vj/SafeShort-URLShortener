
import fastifyEnv from "@fastify/env";
import type  { FastifyInstance } from "fastify";
import fp from "fastify-plugin"

declare module 'fastify' {
  interface FastifyInstance {
    config: {
      PORT: number;
      NEON_CUSTOM_STRING: string;
    },
    
  }
}

const schema = {
  type: 'object',
  required: [ 'PORT' ,'NEON_CUSTOM_STRING'],
  properties: {
    PORT: {
      type: 'string',
      default: 3000
    },
    NEON_CUSTOM_STRING :
    {
      type : 'string',
      
    }
  }
}

const options = {
  confKey: 'config', 
  schema: schema,
  dotenv: true
}

export default fp(async(fastify:FastifyInstance)=>
{
  await fastify.register(fastifyEnv, options);
},{ name: 'env-plugin' })