require("dotenv").config()
const express = require("express")
const cors = require("cors")
const connectDB = require("./config/db");
const authRouter = require("./routers/auth.router");

const app = express()
app.use(cors())
app.use(express.json())




// SIGNUP ////////

app.use("/auth",authRouter)

const  startServer = async ()=>{
    try{

        await connectDB()
        
        const PORT = process.env.PORT || 5000
        app.listen(PORT,()=>{
            console.log(`server running on port ! ${PORT}`)
        })
    }
    catch(error){
console.error("server startup failed", error.message)
proccess.exit(1)

    }
}
startServer()


