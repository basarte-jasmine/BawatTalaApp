require("dotenv").config();
const app = require("./app");
const { ensureDatabaseSchema } = require("./config/db");
const { ensureDefaultAdminAccount } = require("./api/admin.routes");

const port = Number(process.env.PORT || 4000);

async function bootstrap() {
  await ensureDatabaseSchema();
  await ensureDefaultAdminAccount();

  app.listen(port, () => {
    console.log(`Backend running on port ${port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start backend:", error);
  process.exit(1);
});
