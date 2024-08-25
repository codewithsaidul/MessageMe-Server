const router = require("express").Router();

const authController = require("../controllers/authControllers")
const userController = require("../controllers/userController");






router.patch("/update-me", authController.protect, userController.updateMe)


module.exports = router