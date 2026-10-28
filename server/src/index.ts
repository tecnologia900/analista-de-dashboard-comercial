import { criarServidor } from './app.js';

const porta = Number(process.env.PORT ?? 3333);
const host = process.env.HOST ?? '0.0.0.0';
const app = await criarServidor();
await app.listen({ port: porta, host });
