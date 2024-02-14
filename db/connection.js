const mongoose = require('mongoose');



const uri = `mongodb+srv://gestiak08:Y5no9kAGqcmDchbe@cluster0.a37lvgd.mongodb.net/?retryWrites=true&w=majority`
// const uri = `mongodb+srv://property-hunter:<password>@cluster0.vfvptvp.mongodb.net/?retryWrites=true&w=majority`

mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() =>  console.log('Connected to the db')).catch((e) =>  console.log('Error', e))