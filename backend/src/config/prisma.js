const { PrismaClient } = require("../../node_modules/.prisma/smart-journey-client-v4");

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

module.exports = prisma;
