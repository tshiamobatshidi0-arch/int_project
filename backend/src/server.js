import express  from "express"
import dotenv from "dotenv"
import userMiddleware from "./middleware/user.middleware.js"
import userRoutes from "./routes/user.routes.js"
import messageRoutes from "./routes/message.route.js"
import statusRoutes from "./routes/status.routes.js"

dotenv.config()
const PORT = process.env.PORT||5000
const app = express()

app.use(express.json())
app.use(userMiddleware)

app.use("api/users/",userRoutes)
app.use("api/messages/",messageRoutes)
app.use("/api/statuses/",statusRoutes)
 

app.listen(PORT,()=>console.log(`Application runing on port ${PORT}`))