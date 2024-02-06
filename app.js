const express = require('express');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');


// connect db
require('./db/connection')

// import files
const Users = require('./models/Users');
// const Conversations = require('./models/Conversations')
// const Messages = require('./models/Messages');
// const { Socket } = require('socket.io');
// const { emit } = require('nodemon');
// app Use
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
const port = process.env.PORT || 8000;
// socket.io


app.get('/', (req, res) => {
    res.send("Welcome")
})

app.post('/api/register', async (req, res, next) => {
    try {
        const { fullName, email, password } = req.body;

        if (!fullName || !email || !password) {
            res.status(404).send("Please enter the required fields")
        } else {
            const isAlreadyExist = await Users.findOne({ email })

            if (isAlreadyExist) {
                res.status(404).send('User already exists')
            } else {
                const newUser = new Users({
                    fullName,
                    email
                })
                bcryptjs.hash(password, 12, (err, hashedPassword) => {
                    newUser.set('password', hashedPassword)
                    newUser.save()
                    next()
                })
                return res.status(200).send("User registered successfully")
            }
        }
    } catch (error) {

    }
})

app.post('/api/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(404).send("Please enter the required fields")
        } else {
            const user = await Users.findOne({ email })

            if (!user) {
                res.status(400).send('User email or pass is incorrect')
            } else {
                const validateUser = await bcryptjs.compare(password, user.password)
                if (!validateUser) {
                    res.status(400).send('User email or pass is incorrect')
                } else {
                    const payload = {
                        userId: user._id,
                        email: user.email
                    }
                    const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "This is a JWT secret key"

                    jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: 84600 }, async (err, token) => {
                        await Users.updateOne({ _id: user._id }, {
                            $set: {
                                token
                            }
                        })
                        user.save()
                        next()
                    })
                    res.status(200).json({ user:{email:user.email,fullName:user.fullName}, token: user.token })
                }
            }
        }
    } catch (error) {
        console.log(error)
    }
})

app.listen(port, () => {
    console.log('listening on port' + port);
})