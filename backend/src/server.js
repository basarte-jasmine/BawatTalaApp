require("dotenv").config();
const app = require("./app");
const { ensureDatabaseSchema } = require("./config/db");
const { ensureDefaultAdminAccount } = require("./api/admin.routes");

const port = Number(process.env.PORT || 4000);

async function bootstrap() {
  await ensureDatabaseSchema();
  await ensureDefaultAdminAccount();

  const server = app.listen(port, () => {
    console.log(`Backend running on port ${port}`);
  });

  server.on("error", (error) => {
    if (error?.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Another app is already listening there.`);
      process.exit(1);
    }

    console.error("Failed to start backend:", error?.message || error);
    process.exit(1);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start backend:", error?.message || error);
  process.exit(1);
});
