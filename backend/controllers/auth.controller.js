const { signupService, loginService } = require("../services/auth.service")

const signup = async (req, res) => {
    const { name, email, password } = req.body
    try {
        const user = await signupService({ name, email, password })

        return res.status(201).json({
            success: true,
            message: "user created successfully",
            id: user.id,
            name: user.name,
            email: user.email
        })

    }

    catch (error) {
        if (error.message === "user already availabe") {
            return res.status(409).json({
                success: false,
                message: "user already available"
            })
        } else {
            return res.status(500).json({
                success: false,
                message: "signup failed"
            })
        }


    }

}
const login = async (req, res) => {
    const {  email, password } = req.body
    try {
        const user = await loginService({email, password })

        return res.status(200).json({
            message: "user login successfully",
            success: true,
            id: user.id,
            email: user.email,
            token:user.token
        })

    }

    catch (error) {
        if (error.message === "invalid credencial") {
            return res.status(401).json({
                success: false,
                message: "invalid credencial"
            })
        } else {
            return res.status(500).json({
                success: false,
                message: "login failed "
            })
        }


    }

}

module.exports = { signup ,login}