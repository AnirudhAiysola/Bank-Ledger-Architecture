const transactionModel = require("../models/transaction.model");
const ledgerModel = require("../models/ledger.model");
const accountModel = require("../models/account.model");
const emailService = require("../services/email.service");
const mongoose = require("mongoose");

/**
 * - Create a new transaction
 * THE 10-STEP TRANSFER FLOW:
 * 1. Validate request
 * 2. Validate idempotency key
 * 3. Check account status
 * 4. Derive sender balance from ledger
 * 5. Create transaction (PENDING)
 * 6. Create DEBIT ledger entry
 * 7. Create CREDIT ledger entry
 * 8. Mark transaction COMPLETED
 * 9. Commit MongoDB session
 * 10. Send email notification
 */

async function createTransaction(req, res) {
  try {
    const { fromAccount, toAccount, amount, idempotencyKey } = req.body;

    // Step 1: Validate request
    if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
      return res.status(400).json({
        message:
          "fromAccount, toAccount, amount, and idempotencyKey are required",
      });
    }
    const fromUserAccount = await accountModel.findOne({ _id: fromAccount });
    const toUserAccount = await accountModel.findOne({ _id: toAccount });
    if (!fromUserAccount || !toUserAccount) {
      return res
        .status(404)
        .json({ message: "One or both accounts not found" });
    }

    // Step 2: Validate idempotency key
    const isTransactionExists = await transactionModel.findOne({
      idempotencyKey,
    });
    if (isTransactionExists) {
      if (isTransactionExists.status === "COMPLETED") {
        return res.status(200).json({
          message: "Transaction already completed",
          transaction: isTransactionExists,
        });
      }
      if (isTransactionExists.status === "PENDING") {
        return res.status(200).json({
          message: "Transaction is still pending",
        });
      }
      if (isTransactionExists.status === "FAILED") {
        return res.status(500).json({
          message: "Transaction failed previously. Please try again.",
        });
      }
      if (isTransactionExists.status === "REVERSED") {
        return res.status(500).json({
          message: "Transaction reversed previously. Please try again.",
        });
      }
    }
    // Step 3: Check account status
    if (
      fromUserAccount.status !== "ACTIVE" ||
      toUserAccount.status !== "ACTIVE"
    ) {
      return res
        .status(400)
        .json({ message: "One or both accounts are not active" });
    }
    // Step 4: Derive sender balance from ledger
    const balance = await fromUserAccount.getBalance();
    if (balance < amount) {
      return res.status(400).json({ message: "Insufficient funds" });
    }

    // Step 5: Create transaction (PENDING)
    const session = await mongoose.startSession();
    session.startTransaction();

    const transaction = await transactionModel.create(
      {
        fromAccount,
        toAccount,
        amount,
        idempotencyKey,
        status: "PENDING",
      },
      { session },
    );

    // Step 6: Create DEBIT ledger entry
    const debitLedgerEntry = await ledgerModel.create(
      {
        account: fromAccount,
        type: "DEBIT",
        amount,
        transaction: transaction._id,
      },
      { session },
    );
    // Step 7: Create CREDIT ledger entry
    const creditLedgerEntry = await ledgerModel.create(
      {
        account: toAccount,
        type: "CREDIT",
        amount,
        transaction: transaction._id,
      },
      { session },
    );

    // Step 8: Mark transaction COMPLETED
    transaction.status = "COMPLETED";
    await transaction.save({ session });

    // Step 9: Commit MongoDB session
    await session.commitTransaction();
    session.endSession();

    // Step 10: Send email notification (async, no need to await)
    emailService.sendTransactionEmail(
      req.user.email,
      req.user.name,
      amount,
      toAccount,
    );

    return res.status(201).json({
      message: "Transaction completed successfully",
      transaction,
    });
  } catch (error) {
    console.error("Error creating transaction:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
async function createInitialFundsTransaction(req, res) {
  const { toAccount, amount, idempotencyKey } = req.body;

  if (!toAccount || !amount || !idempotencyKey) {
    return res.status(400).json({
      message: "toAccount, amount and idempotencyKey are required",
    });
  }

  const toUserAccount = await accountModel.findOne({
    _id: toAccount,
  });

  if (!toUserAccount) {
    return res.status(400).json({
      message: "Invalid toAccount",
    });
  }

  const fromUserAccount = await accountModel.findOne({
    user: req.user._id,
  });

  if (!fromUserAccount) {
    return res.status(400).json({
      message: "System user account not found",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  const transaction = new transactionModel({
    fromAccount: fromUserAccount._id,
    toAccount,
    amount,
    idempotencyKey,
    status: "PENDING",
  });

  const debitLedgerEntry = await ledgerModel.create(
    [
      {
        account: fromUserAccount._id,
        amount: amount,
        transaction: transaction._id,
        type: "DEBIT",
      },
    ],
    { session },
  );

  const creditLedgerEntry = await ledgerModel.create(
    [
      {
        account: toAccount,
        amount: amount,
        transaction: transaction._id,
        type: "CREDIT",
      },
    ],
    { session },
  );

  transaction.status = "COMPLETED";
  await transaction.save({ session });

  await session.commitTransaction();
  session.endSession();

  return res.status(201).json({
    message: "Initial funds transaction completed successfully",
    transaction: transaction,
  });
}

module.exports = {
  createTransaction,
  createInitialFundsTransaction,
};
