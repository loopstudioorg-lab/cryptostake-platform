export default () => ({
  port: parseInt(process.env.PORT || '4000', 10),
  
  database: {
    url: process.env.DATABASE_URL,
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'access-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-me',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  encryption: {
    masterKey: process.env.MASTER_KEY || 'master-key-32-chars-change-me!',
  },
  
  blockchain: {
    ethereum: {
      rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
      confirmations: parseInt(process.env.ETHEREUM_CONFIRMATIONS || '12', 10),
    },
    bsc: {
      rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
      confirmations: parseInt(process.env.BSC_CONFIRMATIONS || '15', 10),
    },
    polygon: {
      rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      confirmations: parseInt(process.env.POLYGON_CONFIRMATIONS || '128', 10),
    },
  },
  
  security: {
    newAddressCooldownHours: parseInt(process.env.NEW_ADDRESS_COOLDOWN_HOURS || '24', 10),
    dailyWithdrawalLimitUsd: parseFloat(process.env.DAILY_WITHDRAWAL_LIMIT_USD || '10000'),
    largeWithdrawalThresholdUsd: parseFloat(process.env.LARGE_WITHDRAWAL_THRESHOLD_USD || '5000'),
    maxDailyWithdrawalRequests: parseInt(process.env.MAX_DAILY_WITHDRAWAL_REQUESTS || '5', 10),
  },
  
  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  },
});
