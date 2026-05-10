import {Router} from "express"
import { updateMessage ,getMessages, deleteMessage, createMessage} from "../controller/message.controller.js"

const router = Router()


router.post("create_message/:id",createMessage)

router.get("get_messages/:id",getMessages)

router.delete("delete_message/:id",deleteMessage)

router.put("update_message/:id",updateMessage)


export default router