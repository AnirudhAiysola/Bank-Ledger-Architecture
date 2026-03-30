const accountModel = require("../models/account.model");

async function createAccountController(req, res) {
  try {
    const user = req.user;

    const account = await accountModel.create({
      user: user._id,
    });

    res.status(201).json({ account });
  } catch (error) {
    res.status(500).json({ message: "Error creating account" });
  }
}

module.exports = {
  createAccountController,
};
