import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers, JsonRpcProvider, Wallet, Contract, formatUnits, parseUnits } from 'ethers';
import { PrismaService } from '../../prisma/prisma.service';

// Standard ERC-20 ABI for Transfer events and balance checks
const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

interface ChainProvider {
  chainId: string;
  provider: JsonRpcProvider;
  confirmations: number;
}

@Injectable()
export class BlockchainService implements OnModuleInit {
  private providers: Map<string, ChainProvider> = new Map();

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.initializeProviders();
  }

  private async initializeProviders() {
    const chains = await this.prisma.chain.findMany({
      where: { isActive: true },
    });

    for (const chain of chains) {
      try {
        const provider = new JsonRpcProvider(chain.rpcUrl, {
          chainId: chain.chainId,
          name: chain.name,
        });
        
        this.providers.set(chain.id, {
          chainId: chain.id,
          provider,
          confirmations: chain.confirmationsRequired,
        });

        console.log(`✅ Connected to ${chain.name} (chainId: ${chain.chainId})`);
      } catch (error) {
        console.error(`❌ Failed to connect to ${chain.name}:`, error);
      }
    }
  }

  getProvider(chainId: string): JsonRpcProvider | null {
    return this.providers.get(chainId)?.provider || null;
  }

  async getBlockNumber(chainId: string): Promise<number> {
    const provider = this.getProvider(chainId);
    if (!provider) throw new Error(`Provider not found for chain: ${chainId}`);
    return provider.getBlockNumber();
  }

  async getNativeBalance(chainId: string, address: string): Promise<string> {
    const provider = this.getProvider(chainId);
    if (!provider) throw new Error(`Provider not found for chain: ${chainId}`);
    
    const balance = await provider.getBalance(address);
    return formatUnits(balance, 18);
  }

  async getTokenBalance(
    chainId: string,
    tokenAddress: string,
    walletAddress: string,
  ): Promise<{ balance: string; decimals: number }> {
    const provider = this.getProvider(chainId);
    if (!provider) throw new Error(`Provider not found for chain: ${chainId}`);

    const contract = new Contract(tokenAddress, ERC20_ABI, provider);
    
    const [balance, decimals] = await Promise.all([
      contract.balanceOf(walletAddress),
      contract.decimals(),
    ]);

    return {
      balance: formatUnits(balance, decimals),
      decimals: Number(decimals),
    };
  }

  async getTransactionReceipt(chainId: string, txHash: string) {
    const provider = this.getProvider(chainId);
    if (!provider) throw new Error(`Provider not found for chain: ${chainId}`);
    
    return provider.getTransactionReceipt(txHash);
  }

  async getTransactionConfirmations(chainId: string, txHash: string): Promise<number> {
    const provider = this.getProvider(chainId);
    if (!provider) throw new Error(`Provider not found for chain: ${chainId}`);

    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return 0;

    const currentBlock = await provider.getBlockNumber();
    return currentBlock - receipt.blockNumber + 1;
  }

  async sendNativeToken(
    chainId: string,
    privateKey: string,
    toAddress: string,
    amount: string,
  ): Promise<{ txHash: string; nonce: number }> {
    const provider = this.getProvider(chainId);
    if (!provider) throw new Error(`Provider not found for chain: ${chainId}`);

    const wallet = new Wallet(privateKey, provider);
    
    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: parseUnits(amount, 18),
    });

    return {
      txHash: tx.hash,
      nonce: tx.nonce,
    };
  }

  async sendERC20Token(
    chainId: string,
    privateKey: string,
    tokenAddress: string,
    toAddress: string,
    amount: string,
    decimals: number,
  ): Promise<{ txHash: string; nonce: number }> {
    const provider = this.getProvider(chainId);
    if (!provider) throw new Error(`Provider not found for chain: ${chainId}`);

    const wallet = new Wallet(privateKey, provider);
    const contract = new Contract(tokenAddress, ERC20_ABI, wallet);

    const amountWei = parseUnits(amount, decimals);
    const tx = await contract.transfer(toAddress, amountWei);

    return {
      txHash: tx.hash,
      nonce: tx.nonce,
    };
  }

  async estimateGas(
    chainId: string,
    params: {
      from: string;
      to: string;
      value?: bigint;
      data?: string;
    },
  ): Promise<bigint> {
    const provider = this.getProvider(chainId);
    if (!provider) throw new Error(`Provider not found for chain: ${chainId}`);

    return provider.estimateGas(params);
  }

  async getGasPrice(chainId: string): Promise<bigint> {
    const provider = this.getProvider(chainId);
    if (!provider) throw new Error(`Provider not found for chain: ${chainId}`);

    const feeData = await provider.getFeeData();
    return feeData.gasPrice || BigInt(0);
  }

  // Watch for new deposits to an address
  async *watchDeposits(
    chainId: string,
    addresses: string[],
    fromBlock: number,
  ): AsyncGenerator<{
    txHash: string;
    logIndex: number | null;
    toAddress: string;
    fromAddress: string;
    amount: string;
    isNative: boolean;
    tokenAddress?: string;
    blockNumber: number;
  }> {
    const provider = this.getProvider(chainId);
    if (!provider) throw new Error(`Provider not found for chain: ${chainId}`);

    const addressSet = new Set(addresses.map(a => a.toLowerCase()));
    const currentBlock = await provider.getBlockNumber();

    // Process historical blocks
    for (let block = fromBlock; block <= currentBlock; block += 1000) {
      const toBlock = Math.min(block + 999, currentBlock);

      // Check native transfers (requires iterating transactions)
      // For production, use archive nodes with trace APIs
      
      // Check ERC-20 transfers
      const assets = await this.prisma.asset.findMany({
        where: {
          chain: { id: chainId },
          isNative: false,
          contractAddress: { not: null },
        },
      });

      for (const asset of assets) {
        if (!asset.contractAddress) continue;

        const contract = new Contract(asset.contractAddress, ERC20_ABI, provider);
        const filter = contract.filters.Transfer(null, [...addressSet]);

        try {
          const events = await contract.queryFilter(filter, block, toBlock);

          for (const event of events) {
            if (!event.args) continue;
            const [from, to, value] = event.args;
            
            if (addressSet.has(to.toLowerCase())) {
              yield {
                txHash: event.transactionHash,
                logIndex: event.index,
                toAddress: to,
                fromAddress: from,
                amount: formatUnits(value, asset.decimals),
                isNative: false,
                tokenAddress: asset.contractAddress,
                blockNumber: event.blockNumber,
              };
            }
          }
        } catch (error) {
          console.error(`Error querying events for ${asset.symbol}:`, error);
        }
      }
    }
  }

  getExplorerUrl(chainId: string, txHash: string): string | null {
    // This would be looked up from the chain config
    const explorerUrls: Record<string, string> = {
      ethereum: 'https://etherscan.io/tx/',
      bsc: 'https://bscscan.com/tx/',
      polygon: 'https://polygonscan.com/tx/',
    };

    // In production, get this from the chain record
    for (const [, url] of Object.entries(explorerUrls)) {
      return `${url}${txHash}`;
    }

    return null;
  }
}
