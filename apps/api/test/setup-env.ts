// Entorno para e2e: apunta a puertos cerrados para probar que /health no falla sin BD ni Redis.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test?connect_timeout=1';
process.env.REDIS_URL = 'redis://127.0.0.1:1';
process.env.JWT_SECRET = 'e2e-secreto-de-prueba-con-32-caracteres!';
process.env.JWT_REFRESH_SECRET = 'e2e-refresh-de-prueba-con-32-caracteres!';
process.env.CORS_ORIGIN = 'http://localhost:5173';
