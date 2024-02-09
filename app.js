const express = require('express');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const io = require('socket.io')(8080, {
    cors: {
        origin: '*'
    }
});


// connect db
require('./db/connection')

// import files
const Users = require('./models/Users');
const Conversations = require('./models/Conversations')
const Messages = require('./models/Messages');
const { Socket } = require('socket.io');
const { emit } = require('nodemon');
// app Use
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
const port = process.env.PORT || 8000;
// socket.io
let users = [];
io.on('connection', socket => {
    console.log('User connected', socket.id);
    socket.on('addUser', userId => {
        const isUserExist = users.find(user => user.userId === userId)
        if (!isUserExist) {
            const user = { userId, socketId: socket.id }
            users.push(user);
            io.emit('getUsers', users)
        }

    });
    socket.on('sendMessage', async ({ senderId, receiverId, message, conversationId }) => {
        const receiver = users.find(user => user.userId === receiverId)
        const sender = users.find(user => user.userId === senderId)
        const user = await Users.findById(senderId)
        if (receiver) {
            io.to(receiver.socketId).to(sender.socketId).emit('getMessage', {

                senderId,
                message,
                conversationId,
                receiverId,
                user: { id: user._id, fullName: user.fullName, email: user.email }
            })
        }
    });




    socket.on('Disconnect', () => {
        users = users.filter(user => user.socketId !== socket.id)
        io.emit('getUsers', users)
    })
    // io.emit('getUsers',socket.userId);
})

// Routes
app.get('/', (req, res) => {
    res.send('welcome');

})
app.post('/api/register', async (req, res, next) => {
    try {
        const { fullName, email, password } = req.body;
        if (!fullName || !email || !password) {
            res.status(400).send('Please fill all required fields');
        } else {
            const isAlreadyExist = await Users.findOne({ email });
            if (isAlreadyExist) {
                res.status(400).send('User already exists');
            } else {
                const newUser = new Users({ fullName, email });

                // Use bcryptjs.hash with Promises or await
                const hashedPassword = await bcryptjs.hash(password, 10);
                newUser.set('password', hashedPassword);

                await newUser.save();

                res.status(200).send('User registered successfully');
            }
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal server error');
    }
});

app.post('/api/logIn', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).send('Please fill all required fields')
        } else {
            const user = await Users.findOne({ email });
            if (!user) {
                res.status(400).send('users already exists');
            } else {
                const validUser = await bcryptjs.compare(password, user.password)
                if (!validUser) {
                    res.status(400).send('user email or pass is incorrect')
                } else {
                    const payload = {
                        userId: user._id,
                        email: user.email
                    }
                    const jwt_SECRET_KEY = process.env.JWT_SECRET_KEY || 'This_IS_A_JWT_SECRET_KEY'

                    jwt.sign(payload, jwt_SECRET_KEY, { expiresIn: 84680 }, async (err, token) => {
                        await Users.updateOne({ _id: user._id }, {
                            $set: { token }
                        })
                        user.save();
                        res.status(200).json({ user: { id: user._id, email: user.email, fullName: user.fullName }, token: user.token })

                    })

                }


            }
        }

    } catch (error) {

        console.log(error, "Error");

    }
})
app.post('/api/conversation', async (req, res) => {
    try {
        const { senderId, receiverId } = req.body;
        const newConversation = new Conversations({ members: [senderId, receiverId] });
        await newConversation.save();
        res.status(200).send('conversation created successfully')
    } catch (error) {
        console.log(error, 'Error');

    }
})
app.get('/api/conversations/:userId', async (req, res) => {
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

        if (!senderId || !message) return res.status(400).send('Please fill all required fields');

        if (conversationId === 'new' && receiverId) {
            // Check if a conversation already exists between sender and receiver
            const existingConversation = await Conversations.findOne({
                members: { $all: [senderId, receiverId] }
            });

            if (existingConversation) {
                // Use existing conversation
                const newMessage = new Messages({ conversationId: existingConversation._id, senderId, message });
                await newMessage.save();
                return res.status(200).send('Message Sent Successfully');
            } else {
                // Create a new conversation
                const newConversation = new Conversations({ members: [senderId, receiverId] });
                await newConversation.save();
                const newMessage = new Messages({ conversationId: newConversation._id, senderId, message });
                await newMessage.save();
                return res.status(200).send('Message Sent Successfully');
            }
        } else if (!conversationId && !receiverId) {
            return res.status(400).send('Please fill all required fields');
        }

        // If conversationId is provided, use it
        const newMessage = new Messages({ conversationId, senderId, message });
        await newMessage.save();
        res.status(200).send('Message Sent Successfully');
    } catch (error) {
        console.log(error, 'Error');
        res.status(500).send('Internal server error');
    }
});

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