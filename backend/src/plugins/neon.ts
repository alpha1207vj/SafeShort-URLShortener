import fp from 'fastify-plugin'
import { neon,NeonQueryFunction } from '@neondatabase/serverless';


declare module 'fastify' {
  export interface FastifyInstance {
   db: NeonQueryFunction<any, any>; 
  }
}

export default fp(async (fastify) => {
        const connectionString = fastify.config.NEON_CUSTOM_STRING;
        const sql = neon(connectionString)
       fastify.decorate('db', sql);
},{name : "neon-db",  dependencies: ['env-plugin'] }
)

