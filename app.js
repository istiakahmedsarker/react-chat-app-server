const express = require('express');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');


// connect db
require('./db/connection')

// import files
const Users = require('./models/Users');
const Conversations = require('./models/Conversations')
const Messages = require('./models/Messages');
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
                    res.status(200).json({ user: { email: user.email, fullName: user.fullName }, token: user.token })
                }
            }
        }
    } catch (error) {
        console.log(error)
    }
})

app.post('/api/conversation', async (req, res) => {
    try {
        const { senderId, receiverId } = req.body
        const newConversation = new Conversations({ members: [senderId, receiverId] })
        await newConversation.save()
        res.status(200).send("Conversation created succesfully")
    } catch (error) {
        console.log("Error", error)
    }
})

app.get('/api/conversation/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const conversations = await Conversations.find({ members: { $in: [userId] } });
        const conversationUserData = Promise.all(conversations.map(async (conversation) => {
            const receiverId = conversation.members.find((member) => member !== userId);
            const user = await Users.findById(receiverId);
            return {
                user: { receiverId: user._id, email: user.email, fullName: user.fullName }, conversationId: conversation._id

            }
        }))
        res.status(200).json(await conversationUserData);

    } catch (error) {
        console.log(error, 'Error');
    }
})

app.post('/api/message', async (req, res) => {
    try {
        const { conversationId, senderId, message, receiverId = '' } = req.body;
        console.log(conversationId, senderId, message, receiverId);
        if (!senderId || !message) return res.status(400).send('Please fill all required fields');
        if (conversationId === 'new' && receiverId) {
            const newConversation = new Conversations({ members: [senderId, receiverId] });
            await newConversation.save();
            const newMessage = new Messages({ conversationId: newConversation._id, senderId, message });
            await newMessage.save()
            return res.status(200).send('Message Sent Successfully')
        } else if (!conversationId && !receiverId) {
            return res.status(400).send('Please fill all required fields')
        }
        const newMessage = new Messages({ conversationId, senderId, message });
        await newMessage.save();
        res.status(200).send('Message sent Successfully');
    } catch (error) {
        console.log(error, 'Error');
    }
})

app.get('/api/message/:conversationId', async (req, res) => {
    try {
        const checkMessages = async (conversationId) => {
            const messages = await Messages.find({ conversationId });
            const messageUserData = await Promise.all(messages.map(async (message) => {
                const user = await Users.findById(message.senderId);
                return { user: { id: user._id, email: user.email, fullName: user.fullName }, message: message.message };
            }));
            res.status(200).json(messageUserData);
        };

        const conversationId = req.params.conversationId;

        if (conversationId === 'new') {
            const checkConversation = await Conversations.find({ members: { $all: [req.query.senderId, req.query.receiverId] } });

            if (checkConversation.length > 0) {
                checkMessages(checkConversation[0]._id);
            } else {
                return res.status(200).json([]);
            }
        } else {
            checkMessages(conversationId);
        }

    } catch (error) {
        console.log('Error', error);

    }
});

app.get('/api/users/:userId', async (req, res) => {
    try {
        const userId = req.params.userId
        const users = await Users.find({ _id: { $ne: userId } });
        const usersData = Promise.all(users.map(async (user) => {
            return { user: { email: user.email, fullName: user.fullName, receiverId: user._id } }
        }))
        res.status(200).json(await usersData);
    } catch (error) {
        console.log('Error', error);

    }
})

app.listen(port, () => {
    console.log('listening on port' + port);
})