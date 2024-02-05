const express = require('express');
// const bcryptjs = require('bcryptjs');
// const jwt = require('jsonwebtoken');
const cors = require('cors');


// connect db
require('./db/connection')

// import files
// const Users = require('./models/Users');
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


app.get('/',(req,res)=>{
    res.send("Welcome")
})

app.listen(port, () => {
    console.log('listening on port' + port);
})