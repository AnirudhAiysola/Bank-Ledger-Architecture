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

async function getUserAccountsController(req, res) {
  try {
    const accounts = await accountModel.find({ user: req.user._id });
    res.status(200).json({ accounts });
  } catch (error) {
    res.status(500).json({ message: "Error fetching accounts" });
  }
}

module.exports = {
  createAccountController,
  getUserAccountsController,
};
