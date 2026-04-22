require("dotenv").config();
const app = require("./app");
const { ensureDatabaseSchema } = require("./config/db");
const { ensureDefaultAdminAccount } = require("./api/admin.routes");
const appointmentRoutes = require("./api/appointment.routes");

const port = Number(process.env.PORT || 4000);

async function runStartupTasks() {
  try {
    await ensureDatabaseSchema();
    await ensureDefaultAdminAccount();
    if (typeof appointmentRoutes.startPendingAppointmentExpiryWorker === "function") {
      appointmentRoutes.startPendingAppointmentExpiryWorker();
    }
    console.log("Backend startup tasks completed.");
  } catch (error) {
    console.error("Backend startup tasks failed:", error?.message || error);
  }
}

const server = app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
  void runStartupTasks();
});

server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Another app is already listening there.`);
    process.exit(1);
  }

  console.error("Failed to start backend:", error?.message || error);
  process.exit(1);
});
