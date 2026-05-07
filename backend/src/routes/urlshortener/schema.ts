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
          //id : {type : 'number'},
          short_url: { type: 'string' },
          //creation_date : {type : 'string'},
          //creation_time : {type : 'string'}
        }
}