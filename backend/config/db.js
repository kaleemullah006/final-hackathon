const mongoose = require("mongoose");

const dns = require("node:dns");


dns.setServers(["1.1.1.1", "8.8.8.8"]);

const connectDB = async ()=>{
    try{

        await mongoose.connect(process.env.MONGO_URI)
        console.log("mongodb connected successfully")
    }
catch(error){
console.error("mongodb connection failed !", error.message)
process.exit(1)
}



}
module.exports = connectDB