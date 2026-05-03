import { createApp } from "./app.module";

const app = createApp();
const port = Number(process.env.API_PORT ?? 3000);

app.listen(port, () => {
  console.info(`[sipena-api] listening on ${port}`);
});
