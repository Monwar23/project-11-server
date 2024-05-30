const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt=require('jsonwebtoken')
const cookieParser = require('cookie-parser')
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express()
const port = process.env.PORT || 5000

// middleware
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://dinedash.netlify.app',
    ,
  ],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())

// verify jwt middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token
  if (!token) return res.status(401).send({ message: 'unauthorized access' })
  if (token) {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        console.log(err)
        return res.status(401).send({ message: 'unauthorized access' })
      }
      console.log(decoded)

      req.user = decoded
      next()
    })
  }
}

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
    const galleryCollection=client.db('FoodItem').collection('AllFeedback')
    const paymentCollection=client.db('FoodItem').collection('payment')
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();


    // jwt generate
    app.post('/jwt', async (req, res) => {
      const email = req.body
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '7d',
      })
      res.cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    }
  )

    // Clear token on logout
    app.get('/logout', (req, res) => {
      res
        .clearCookie('token', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          maxAge: 0,
        })
        .send({ success: true })
    })
    

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

    app.get("/foods/email/:email", verifyToken, async (req, res) => {
      const tokenEmail = req.user.email
      const email = req.params.email;
      if (tokenEmail !== email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
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

      const purchaseQuantity=purchaseData.purchaseQuantity

      const updateDoc={
        $inc:{purchase_count: purchaseQuantity},
      }
      const foodQuery={_id: new ObjectId(purchaseData.foodId)}
      const updatePurchaseCount=await foodsCollection.updateOne(foodQuery,updateDoc)

      const decrementDoc = {
        $inc: { Quantity: purchaseQuantity * -1 }, 
    };
    const updateQuantity = await foodsCollection.updateOne(foodQuery, decrementDoc);
      console.log(updatePurchaseCount);
      res.send(result)
    })

    app.get("/purchase/:email",verifyToken, async (req, res) => {
      const tokenEmail = req.user.email
      const email = req.params.email;
      if (tokenEmail !== email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

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

    app.post("/addFeedback", async (req, res) => {
      
          const { imageUrl, username, feedback } = req.body;
          const result = await galleryCollection.insertOne({ imageUrl, username, feedback });
          res.send(result)
      }
  );

  app.get('/feedback', async (req, res) => {      
    const result = await galleryCollection.find().toArray()
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

    // payment intent
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, 'amount inside the intent')
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    });

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      //  carefully delete each item from the cart
      console.log('payment info', payment);
      const query = {
        _id: {
          $in: payment.cartIds.map(id => new ObjectId(id))
        }
      };

      const deleteResult = await purchaseCollection.deleteMany(query);

      res.send({ paymentResult, deleteResult });
    })



    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
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