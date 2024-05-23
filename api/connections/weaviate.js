const weaviate = require('weaviate-client').default;
let client = null
setTimeout(async () => {
  client = await weaviate.connectToLocal({
    // port: process.env.WEAVIATE_PORT,
    host: `${process.env.WEAVIATE_HOST}`,
    headers: {
      'X-OpenAI-Api-Key': process.env.OPENAI_API_KEY,
    }
  }
  )
  const meta = await client.getMeta()
  if (meta) {
    console.log('Connected to Weaviate:', meta.version);
  }
})

module.exports = () => client;