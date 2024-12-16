const router = require("express").Router();

const authController = require("../controllers/authControllers")
const userController = require("../controllers/userController");



router.patch("/update-me", authController.protect, userController.updateMe);


router.get("/get-users", authController.protect,  userController.getUsers)
router.get("/get-friends", authController.protect,  userController.getFriends)
router.get("/get-request", authController.protect,  userController.getRequest)


module.exports = router;