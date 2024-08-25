const app = require("./app");
const dotenv = require("dotenv");
const mongoose = require('mongoose');

require('dotenv').config();

process.on("uncaughtException", (err) => {
    console.log(err);
    process.exit(1)
})




const http = require("http");

const server =  http.createServer(app);


const DB = process.env.DBURI.replace('<db_password>', process.env.DBPASSWORD);
mongoose.connect(DB, {
    useNewUrlParser: true,
    // useCreateIndex: true,
    // useFindAndModify: false,
    // useUnifiedToplogy: true,
})
.then((con) => {
    console.log("DB Connection successful");
})




const port = process.env.PORT || 5000;





server.listen(port, () => {
    console.log(`App is Running on ${port}`)
});






process.on("unhandledRejection", (err) => {
    console.log(err);
    server.close(() => {
        process.exit(1)
    })
})