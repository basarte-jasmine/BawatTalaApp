const originalEmitWarning = process.emitWarning.bind(process);

process.emitWarning = (warning, ...args) => {
  const warningCode = warning?.code || (typeof args[0] === "object" ? args[0]?.code : args[1]);

  if (warningCode === "DEP0040") {
    return;
  }

  return originalEmitWarning(warning, ...args);
};

require("dotenv").config();
const http = require("http");
const app = require("./app");
const { ensureDatabaseSchema, ensureStudentProfilePictureSchema } = require("./config/db");
const { ensureDefaultAdminAccount } = require("./api/admin.routes");
const appointmentRoutes = require("./api/appointment.routes");

const port = Number(process.env.PORT || 4000);
const skipStartupTasks =
  process.argv.includes("--skip-startup-tasks") ||
  String(process.env.SKIP_STARTUP_TASKS || "").trim().toLowerCase() === "true";

async function runStartupTasks() {
  if (skipStartupTasks) {
    console.log("Backend startup tasks skipped. Run without --skip-startup-tasks to apply database schema checks.");
    try {
      await ensureStudentProfilePictureSchema();
      console.log("Student profile picture schema check completed.");
    } catch (error) {
      console.error("Student profile picture schema check failed:", error?.message || error);
    }
    if (typeof appointmentRoutes.startPendingAppointmentExpiryWorker === "function") {
      appointmentRoutes.startPendingAppointmentExpiryWorker();
    }
    return;
  }

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

function checkExistingBackend() {
  return new Promise((resolve) => {
    const request = http.get(
      {
        host: "127.0.0.1",
        port,
        path: "/health",
        timeout: 1000,
      },
      (response) => {
        let body = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          try {
            const payload = JSON.parse(body);
            resolve(response.statusCode === 200 && payload?.ok === true);
          } catch {
            resolve(false);
          }
        });
      },
    );

    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => {
      resolve(false);
    });
  });
}

const listenHost = String(process.env.HOST || process.env.BIND_HOST || "0.0.0.0").trim() || "0.0.0.0";

function listLanBaseUrls(listenPort) {
  try {
    const os = require("os");
    const nets = os.networkInterfaces();
    const urls = [];
    for (const entries of Object.values(nets || {})) {
      for (const entry of entries || []) {
        if (!entry || entry.internal || entry.family !== "IPv4") continue;
        // Prefer private LAN ranges phones can actually reach on Wi-Fi.
        if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(entry.address)) {
          urls.push(`http://${entry.address}:${listenPort}`);
        }
      }
    }
    return [...new Set(urls)];
  } catch {
    return [];
  }
}

const server = app.listen(port, listenHost, () => {
  console.log(`Backend running on http://${listenHost}:${port}`);
  const lanUrls = listLanBaseUrls(port);
  if (lanUrls.length) {
    console.log(`LAN (phones on same Wi-Fi): ${lanUrls.join(" | ")}`);
    console.log(`Set mobile EXPO_PUBLIC_API_BASE_URL to one of those if devices cannot reach localhost.`);
  }
  void runStartupTasks();
});

server.on("error", async (error) => {
  if (error?.code === "EADDRINUSE") {
    const isBackendAlreadyRunning = await checkExistingBackend();

    if (isBackendAlreadyRunning) {
      console.log(`Backend is already running on port ${port}. You can keep using http://localhost:${port}.`);
      process.exit(0);
    }

    console.error(`Port ${port} is already in use by another app.`);
    console.error("Close the app using that port, or set a different PORT value in backend/.env.");
    console.error(`On Windows, you can find it with: C:\\Windows\\System32\\netstat.exe -ano -p tcp | findstr :${port}`);
    process.exit(1);
  }

  console.error("Failed to start backend:", error?.message || error);
  process.exit(1);
});
