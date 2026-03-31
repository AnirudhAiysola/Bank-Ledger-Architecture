const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const accountController = require("../controllers/account.controller");

const router = express.Router();

/**
 * - POST /api/accounts
 * - Create a new account for the authenticated user
 */
router.post(
  "/",
  authMiddleware.authMiddleware,
  accountController.createAccountController,
);

/**
 * - GET /api/accounts
 * - Get all accounts for logged in user
 * - Protected route, requires authentication
 */
router.get(
  "/",
  authMiddleware.authMiddleware,
  accountController.getUserAccountsController,
);

/**
 * - Get /api/accounts/balance/:accountId
 * - Get the balance of a specific account by its ID for the authenticated user
 * - Protected route, requires authentication
 * - Get the total balance of all accounts for the authenticated user
 * - Protected route, requires authentication
 */

router.get(
  "/balance/:accountId",
  authMiddleware.authMiddleware,
  accountController.getAccountBalanceController,
);

module.exports = router;
