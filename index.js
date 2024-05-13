const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000

// middleware
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    ,
  ],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.as3doaz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    const foodsCollection = client.db('FoodItem').collection('AllFood')
    const purchaseCollection = client.db('FoodItem').collection('AllPurchase')
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    app.get('/foods', async (req, res) => {      
      const result = await foodsCollection.find().toArray()
      res.send(result)
    })

    app.get('/searchFoods', async (req, res) => {
      const search = req.query.search
      let options = {}
      let query = {
        food_name: { $regex: search, $options: 'i' },
      }
      const result = await foodsCollection.find(query, options).toArray()
      res.send(result)
    })
    // get data by email

    app.get("/foods/email/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await foodsCollection.find(query).toArray();
      res.send(result);
    });

    app.get('/foods/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await foodsCollection.findOne(query);
      res.send(result);
    })

    app.post("/addFoods", async (req, res) => {
      console.log(req.body);
      const result = await foodsCollection.insertOne(req.body);
      console.log(result);
      res.send(result)
    })


    app.post("/purchase", async (req, res) => {

      const purchaseData=req.body
      console.log(req.body);
      const result = await purchaseCollection.insertOne(purchaseData);

      // const updateDoc={
      //   $inc:{purchase_count: 1},
      // }
      // const foodQuery={_id: new ObjectId(purchaseData.foodId)}
      // const updatePurchaseCount=await foodsCollection.updateOne(foodQuery,updateDoc)

      // console.log(updatePurchaseCount);
      res.send(result)
    })

    app.get("/purchase/:email", async (req, res) => {
      const email = req.params.email;
      const query = {
        purchaseEmail: email };
      const result = await purchaseCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/purchase/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await purchaseCollection.deleteOne(query)
      res.send(result)
    })
    
    app.put('/foods/:id', async (req, res) => {
      const id = req.params.id
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true }
      const updateFood = req.body
      const food = {

        $set: {
          food_name: updateFood.food_name,
          food_image: updateFood.food_image,
          food_category: updateFood.food_category,
          price: updateFood.price,
          Quantity: updateFood.Quantity,
          short_description: updateFood.short_description,
          food_origin: updateFood.food_origin,

        },
      }
      const result = await foodsCollection.updateOne(filter, food, options)
      res.send(result)
    })

    app.delete("/foods/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await foodsCollection.deleteOne(query)
      res.send(result)
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('running')
})

app.listen(port, () => {
  console.log(`server is running in port ${port}`);
})