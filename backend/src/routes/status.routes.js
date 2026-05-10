import {Router} from "express"
import { createStatuses, deleteStatus, getStatuses } from "../controller/status.controller.js"

const router = Router()

router.get("get_statuses",getStatuses)

router.post("create_statuses",createStatuses)

router.delete("delete_status/:id",deleteStatus)

export default router