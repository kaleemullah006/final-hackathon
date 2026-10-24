const User = require("../models/user")
const SECRET =process.env.SECRET
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")


async function signupService({name,email,password}){
    try{
        

    if(!name || !email || !password){
       
          throw new Error ("invalid credencial")
      
    }

    const normalizedEmail = email.trim().toLowerCase()

    const existingUser = await User.findOne({email:normalizedEmail})

    if(existingUser){

       throw new Error ("user already availabe")
    }
    
const hashedPassword = await bcrypt.hash(password,10)


    const user = await User.create({
        name:name.trim(),
        email:normalizedEmail,
        password:hashedPassword})

        return {
                id: user._id,
                name: user.name,
                email:user.email
                
            }
        

        }
    catch(error){
        console.error("signup error", error.message)
        throw error;

       
        
    }
   
   
}
async function loginService({email,password}){
    try{
        

    if( !email || !password){
       
          throw new Error ("invalid credencial")
      
    }

    const normalizedEmail = email.trim().toLowerCase()

    const user = await User.findOne({email:normalizedEmail})

    if(!user){

       throw new Error ("invalid credencial")
    }
    const isPasswordCorrect = await bcrypt.compare(password, user.password)
    
    if(!isPasswordCorrect){
        throw new Error("invalid credencial")
    }
    
    const token = await jwt.sign({id:user._id, email:user.email, name: user.name,}, process.env.SECRET,{expiresIn:"1d"})
    return {
        id: user._id,
        name:user.name,
        email:user.email,
        token:token
        
            }
        

        }
    catch(error){
        console.error("login error", error.message)
        throw error;

       
        
    }
   
   
}

module.exports = {signupService,loginService}