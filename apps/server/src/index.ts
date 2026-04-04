import { config } from "./config.js";
import { buildServer } from "./server.js";

const start = async () => {
  const app = buildServer();

  try {
    await app.listen({
      port: config.PORT,
      host: config.HOST
    });
    app.log.info(`MyMuse server started at ${config.HOST}:${config.PORT}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();
