const jwt = require("jsonwebtoken")
const SECRET = process.env.SECRET

async function authMiddleware(req,res,next){
const headers = req.headers.authorization

if (!headers){
    return res.status(401).json({
        success:false,
        message:"please login again"
    })
}

const token = headers.split(" ")[1]

try{
    
    const decoded = jwt.verify(token,process.env.SECRET)
    
     req.user = decoded
    
    return next()
}
catch(error){
return res.status(401).json({
    success:false,
    message:"invalid or expire token"
})
}

}

module.exports = authMiddleware