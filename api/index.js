const express = require('express');
const app = express();
const dotenv = require('dotenv');
dotenv.config();

const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const weaviate = require('./connections/weaviate');
const weaviateRaw = require('weaviate-client').default;
const fs = require('fs');

const swaggerDefinition = JSON.parse(fs.readFileSync('./swagger.json', 'utf8'));
const options = {
  swaggerDefinition,
  apis: ['./index.js'], // Path to the API docs (this file)
}
const swaggerSpec = swaggerJsdoc(options);
// Server port configuration
const port = process.env.PORT || 3000;

// Helper function to find a collection by name
const findCollectionByName = async (name) => {
  const collections = await weaviate().collections.listAll();
  for (let c of collections) {
    if (c.name.toLowerCase() === name.toLowerCase()) {
      return await weaviate().collections.get(c.name);
    }
  }
  return null;
};

// Middleware to parse JSON requests
app.use(express.json());
// POST /collection endpoint to create a new collection
app.post('/collection/:name', async (req, res) => {
  const { name } = req.params;
  try {
    const newCollection = await weaviate().collections.create({
      name,
      properties: [
        {
          name: 'data',
          dataType: weaviateRaw.configure.dataType.TEXT,
          vectorizePropertyName: true,
          tokenization: 'lowercase',
        },
      ],
      vectorizers: weaviateRaw.configure.vectorizer.text2VecOpenAI(),
      generative: weaviateRaw.configure.generative.openAI(),
    });
    return res.json({ success: true, name: newCollection.name });
  } catch (e) {
    console.error("Error creating collection:", e.message);
    if (e?.message?.includes('already exists')) {
      return res.status(400).json({ error: "Collection already exists" });
    }
    return res.status(500).json({ error: e?.message || "Error creating collection" });
  }
});

// DELETE /collection/:name endpoint to delete a collection
app.delete('/collection/:name', async (req, res) => {
  const { name } = req.params;
  try {
    const collection = await findCollectionByName(name);
    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }
    await weaviate().collections.delete(collection.name);
    return res.json({ success: true, name: collection.name });
  } catch (e) {
    console.error("Error deleting collection:", e);
    return res.status(404).json({ error: "Collection not found" });
  }
});

// GET /collection/:name endpoint to get collection details by name
app.get('/collection/:name', async (req, res) => {
  const { name } = req.params;
  try {
    const collection = await findCollectionByName(name);
    return res.json({ name: collection.name, properties: collection.properties });
  } catch (e) {
    console.error(`Error fetching collection ${name}:`, e);
    return res.status(404).json({ error: `Collection ${name} not found` });
  }
});

// GET /collections endpoint to list all collections
app.get('/collections', async (req, res) => {
  try {
    const collections = await weaviate().collections.listAll();
    const collectionNames = collections.map(c => ({
      name: c.name,
      properties: c.properties,
      id: c.uuid
    }));
    return res.json(collectionNames);
  } catch (e) {
    console.error("Error fetching collections:", e);
    return res.status(500).json({ error: "Error fetching collections" });
  }
});

// GET /search/:collection endpoint to search within a collection
app.get('/search/:collection', async (req, res) => {
  const { collection } = req.params;
  let { limit = 20, search } = req.query;
  try {
    const c = await findCollectionByName(collection);
    const result = await c.query.nearText([search], {
      limit: parseInt(limit),
      returnProperties: ['data'],
      returnMetadata: ['distance']
    });
    return res.json(result);
  } catch (e) {
    console.error(`Error searching ${collection}:`, e);
    return res.status(404).json({ error: `Failed to search ${collection}` });
  }
});

// PUT /collection/:name endpoint to add data to a collection
app.put('/collection/:name', async (req, res) => {
  let { name } = req.params;
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: "No data provided" });

  try {
    const allCollections = await weaviate().collections.listAll();
    for (let c of allCollections) {
      if (c.name.toLowerCase() === name.toLowerCase()) {
        const exists = await weaviate().collections.exists(c.name);
        if (!exists) {
          return res.status(404).json({ error: `Collection ${name} not found` });
        }
        const collection = await weaviate().collections.get(c.name);
        const uuid = await collection.data.insert({ 'data': data });
        return res.json({ success: true, uuid });
      }
    }
  } catch (e) {
    console.error(`Error updating collection ${name}:`, e);
    return res.status(500).json({ error: "Error updating collection" });
  }
});

// GET /data/:collection endpoint to get data from a collection
app.get('/data/:collection', async (req, res) => {
  const { collection } = req.params;
  try {
    const c = await weaviate().collections.get(collection);
    const result = await c.data.list();
    return res.json(result);
  } catch (e) {
    console.error(`Error fetching data from collection ${collection}:`, e);
    return res.status(500).json({ error: "Error fetching data" });
  }
});

app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
