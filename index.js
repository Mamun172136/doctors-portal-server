const express = require('express')
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const port = 5000;
require('dotenv').config();
// doctor_admin
//TnYihDCpQkQ3rw6e
app.use(cors());
app.use(express.json())
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uierb3o.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJwt(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'unauthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' });
        }
        req.decoded = decoded;
        next();
    });
}
async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db('doctors_portal').collection('services');
        const bookingCollection = client.db('doctors_portal').collection('bookings');
        const userCollection = client.db('doctors_portal').collection('users');
        const doctorCollection = client.db('doctors_portal').collection('doctor');
        console.log('db connecdted');

        const veriyAdmin = async(req,res,next) =>{
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({email:requester});
            if(requesterAccount.role === 'admin'){
                next();
            }else{
                return res.status(403).send({ message: 'forbidden access' });
            }
        }

        app.get('/service', async (req, res) => {
            console.log('db connecdted');
            const query = {};
            const cursor = serviceCollection.find(query).project({name:1});
            const services = await cursor.toArray()
            console.log(services);
            res.send(services);
        })

        /***********
        post for booking
        *************/
        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }

            const exists = await bookingCollection.findOne(query);
            if (exists) {
                return res.send({
                    success: false,
                    booking: exists
                })
            }
            const result = bookingCollection.insertOne(booking)
            res.send({ success: true, result });

        })

        app.post('/doctor',verifyAdmin, async(req,res)=>{
            const doctor = req.body;
            const result = await doctorCollection.insertOne(doctor);
            res.send(result);
        })
        app.get('/doctor',verifyJwt,verifyAdmin, async(req,res)=>{
            
            const doctors = await doctorCollection.find().toArray;
            res.send(doctors);

        })

        /****** 
        available slots 
        */
        app.get('/available', async (req, res) => {
            const date = req.query.date || 'May 11,2022';
            const services = await serviceCollection.find().toArray();
            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray();
            services.forEach(service => {
                const serviceBookings = bookings.filter(book => book.treatment === service.name);
                const bookedSlots = serviceBookings.map(s => s.slot);
                const availableSlots = service.slots.filter(slot => !bookedSlots.includes(slot));
                service.slots = availableSlots;
            })
            // console.log('response');
            res.send(services);
        })
        app.get('/booking', verifyJwt, async (req, res) => {
            const patient = req.query.patient;
            const decodedEmail = req.decoded.email;
            console.log('line 86 from booking',decodedEmail);
            if (patient === decodedEmail) {
                const query = { patient: patient };
                const bookings = await bookingCollection.find(query).toArray();
                console.log('line 89 from booking',bookings);
                res.send(bookings);
            }
            else {
                return res.status(403).send({ message: 'forbidden access' });
              }

        })
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email }
            const options = { upsert: true }
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1HR' })
            res.send({ result, token });

        })
        app.put('/user/admin/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;
           // console.log(email);
            const requester = req.decoded.email;
            // console.log(requester);
            
            
            const requesterAccount = await userCollection.findOne({email:requester});
          
           
            if (requesterAccount?.role === 'admin') {
                const filter = { email: email }
                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result);
            }
            else{
                res.status(403).send({message:'You can not make admin.Forbidden Access '});
            }


        })
        app.get('/admin/:email', async(req,res)=>{
            const email = req.params.email;
            const user = await userCollection.findOne({email:email});
            const isAdmin =  user.role === 'admin';
            res.send({admin:isAdmin});
        })

        //// get all users

        app.get('/user', verifyJwt, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        })

    }
    finally {

    }

}
run().catch(console.dir);
app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
})