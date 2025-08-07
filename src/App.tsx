// This is a sample application to demonstrate interaction with the OISY Wallet.
// It connects to the OISY signer, fetches balances for ICP and ckUSDC,
// and performs self-transfers of 1 token each, using the ICRC-1 standard.

import { useEffect, useState } from 'react';
import { PostMessageTransport } from '@slide-computer/signer-web';
import { Signer } from '@slide-computer/signer';
import { SignerAgent } from '@slide-computer/signer-agent';
import { HttpAgent } from '@dfinity/agent';
import { AccountIdentifier } from '@dfinity/ledger-icp';
import {
  decodeIcrcAccount,
  IcrcLedgerCanister,
  mapTokenMetadata,
  type IcrcAccount,
  type IcrcTokenMetadata,
} from '@dfinity/ledger-icrc';
import { Principal } from '@dfinity/principal';
import BigNumber from 'bignumber.js';

import ICPLogo from './assets/icp.svg';
import USDCLogo from './assets/usdc.svg';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

export default function App() {
  const TRANSFER_AMOUNT = 1;

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [anonymousAgent, setAnonymousAgent] = useState<HttpAgent | null>(null);
  const [oisySignerAgent, setOisySignerAgent] = useState<SignerAgent | null>(null);
  const [isOisyConnected, setOisyConnected] = useState(false);
  const [oisyIcpLedgerAgent, setOisyIcpLedgerAgent] = useState<IcrcLedgerCanister | null>(null);
  const [oisyCkUsdcLedgerAgent, setOisyCkUsdcLedgerAgent] = useState<IcrcLedgerCanister | null>(null);
  const [oisyPrincipal, setOisyPrincipal] = useState<Principal | null>(null);
  const [oisyAccountIdentifier, setOisyAccountIdentifier] = useState<AccountIdentifier | null>(null);
  const [icpMetadata, setIcpMetadata] = useState<IcrcTokenMetadata>();
  const [ckUsdcMetadata, setCkUsdcMetadata] = useState<IcrcTokenMetadata>();
  const [oisyIcpBalance, setOisyIcpBalance] = useState<bigint | null>(null);
  const [oisyCkUsdcBalance, setOisyCkUsdcBalance] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const oisyTransport = new PostMessageTransport({ url: 'https://oisy.com/sign' });
  const oisySigner = new Signer({ transport: oisyTransport });

  useEffect(() => {
    if (oisySignerAgent) {
      if (!oisyIcpLedgerAgent) {
        const agent = IcrcLedgerCanister.create({
          agent: oisySignerAgent,
          canisterId: Principal.fromText('ryjl3-tyaaa-aaaaa-aaaba-cai'),
        });
        setOisyIcpLedgerAgent(agent);
      }
      if (!oisyCkUsdcLedgerAgent) {
        const agent = IcrcLedgerCanister.create({
          agent: oisySignerAgent,
          canisterId: Principal.fromText('xevnm-gaaaa-aaaar-qafnq-cai'),
        });
        setOisyCkUsdcLedgerAgent(agent);
      }
    }
  }, [oisySignerAgent]);

  useEffect(() => {
    const fetchTokenData = async () => {
      if (anonymousAgent && oisyPrincipal) {
        const anonIcp = createAnonIcrcLedgerAgent(anonymousAgent, 'ryjl3-tyaaa-aaaaa-aaaba-cai');
        const anonCkUsdc = createAnonIcrcLedgerAgent(anonymousAgent, 'xevnm-gaaaa-aaaar-qafnq-cai');
        try {
          setIcpMetadata(mapTokenMetadata(await anonIcp.metadata({ certified: true })));
          setCkUsdcMetadata(mapTokenMetadata(await anonCkUsdc.metadata({ certified: true })));
          setOisyIcpBalance(await anonIcp.balance({ owner: oisyPrincipal }));
          setOisyCkUsdcBalance(await anonCkUsdc.balance({ owner: oisyPrincipal }));
        } catch (err) {
          console.error(err);
        }
      }
    };
    fetchTokenData();
  }, [anonymousAgent, oisyPrincipal]);

  const connect = async () => {
    const accounts = await oisySigner.accounts();
    const icrcAccount: IcrcAccount = decodeIcrcAccount(accounts[0].owner.toString());
    setOisyPrincipal(icrcAccount.owner);
    setOisyConnected(true);

    const legacyAccountIdentifier = AccountIdentifier.fromPrincipal({ principal: icrcAccount.owner });
    setOisyAccountIdentifier(legacyAccountIdentifier);

    const agent = await HttpAgent.create({ host: 'https://ic0.app' });
    const signerAgent = await SignerAgent.create({
      agent,
      signer: oisySigner,
      account: icrcAccount.owner,
    });

    setAnonymousAgent(agent);
    setOisySignerAgent(signerAgent);
  };

  const disconnect = () => {
    setAnonymousAgent(null);
    setOisySignerAgent(null);
    setOisyConnected(false);
    setOisyIcpLedgerAgent(null);
    setOisyCkUsdcLedgerAgent(null);
    setOisyPrincipal(null);
    setOisyAccountIdentifier(null);
    setIcpMetadata(undefined);
    setCkUsdcMetadata(undefined);
    setOisyIcpBalance(null);
    setOisyCkUsdcBalance(null);
    setError(null);
  };

  const createAnonIcrcLedgerAgent = (agent: HttpAgent, canisterId: string) =>
    IcrcLedgerCanister.create({ agent, canisterId: Principal.fromText(canisterId) });

  const formatAmount = (raw: bigint, decimals: number) =>
    new BigNumber(raw).dividedBy(10 ** decimals).toString();

  const isBalanceSufficient = (balance: bigint, metadata: IcrcTokenMetadata) => {
    const factor = new BigNumber(10).pow(metadata.decimals);
    const amount = new BigNumber(TRANSFER_AMOUNT).multipliedBy(factor);
    const fee = new BigNumber(metadata.fee);
    return new BigNumber(balance.toString()).gte(amount.plus(fee));
  };

  const toBaseUnits = (amount: number, decimals: number) =>
    BigInt(Math.round(amount * 10 ** decimals));

  const allTokensLoaded = () =>
    icpMetadata && ckUsdcMetadata && oisyIcpBalance !== null && oisyCkUsdcBalance !== null;

  const transferIcp = async () => {
    try {
      await oisyIcpLedgerAgent?.transfer({
        to: { owner: oisyPrincipal!, subaccount: [] },
        amount: toBaseUnits(TRANSFER_AMOUNT, icpMetadata!.decimals),
      });
    } catch (err: any) {
      setError(`ICP transfer failed: ${err.message || err}`);
    }
  };

  const transferCkUsdc = async () => {
    try {
      await oisyCkUsdcLedgerAgent?.transfer({
        to: { owner: oisyPrincipal!, subaccount: [] },
        amount: toBaseUnits(TRANSFER_AMOUNT, ckUsdcMetadata!.decimals),
      });
    } catch (err: any) {
      setError(`ckUSDC transfer failed: ${err.message || err}`);
    }
  };

  return (
    <div className={`min-h-screen px-4 py-6 flex justify-center ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}>
      <div className="w-full max-w-3xl">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <svg width="48" height="48" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="22" cy="22" r="22" fill="#06f"></circle>
              <path fillRule="evenodd" clipRule="evenodd" d="M24.412 33.4193L23.8827 35.7603C23.8037 36.1099 23.4693 36.3405 23.1152 36.2858C22.308 36.161 21.49 36.0177 20.6637 35.8594C20.2842 35.7867 20.0423 35.4133 20.1275 35.0365L20.6067 32.917C20.2711 32.8513 19.9334 32.7802 19.594 32.7042C19.288 32.6344 18.985 32.5615 18.6854 32.4855L18.2064 34.6044C18.1212 34.981 17.7426 35.214 17.3689 35.1168C16.5548 34.905 15.7547 34.6836 14.9723 34.4504C14.6284 34.3479 14.4251 33.9955 14.5043 33.6455L15.0308 31.3164C9.82695 29.2297 6.54161 25.683 7.93603 19.6262L8.27156 18.1421C9.62094 12.0626 14.1109 10.2811 19.7056 10.6393L20.2318 8.31177C20.3109 7.96173 20.646 7.73105 21.0006 7.78645C21.8072 7.91249 22.6247 8.05683 23.4507 8.21592C23.8299 8.28895 24.0714 8.66213 23.9863 9.03875L23.5073 11.1575C23.8104 11.2179 24.1153 11.2824 24.4215 11.3511C24.7609 11.4278 25.0965 11.5083 25.4277 11.5927L25.9065 9.4751C25.9917 9.09826 26.3707 8.86528 26.7445 8.96289C27.5586 9.17544 28.3586 9.39788 29.141 9.63241C29.4843 9.73534 29.6869 10.0874 29.6079 10.437L29.0801 12.7717C34.2161 14.858 37.4261 18.402 36.0643 24.4256L35.7288 25.9097C34.3909 31.9376 29.9492 33.7421 24.412 33.4193ZM31.9629 24.7039L32.1517 23.8687C33.4814 18.3434 29.0601 16.2797 23.6094 14.9676C18.0988 13.8015 13.2196 13.7626 12.0432 19.3226L11.8544 20.1578C10.5189 25.7084 14.9403 27.7721 20.4165 29.09C25.9016 30.2503 30.7807 30.2893 31.9629 24.7039Z" fill="white"></path>
            </svg>
            <h1 className="text-2xl font-bold">OISY Wallet Connect</h1>
          </div>
          <div className="flex items-center gap-3">
            {isOisyConnected ? (
              <Button variant="destructive" onClick={disconnect}>Disconnect</Button>
            ) : (
              <Button onClick={connect}>Connect</Button>
            )}
            <Sun className="h-5 w-5" />
            <Switch checked={isDarkMode} onCheckedChange={() => setIsDarkMode(!isDarkMode)} />
            <Moon className="h-5 w-5" />
          </div>
        </div>

        {error && <div className="mb-4 text-red-500 font-medium">{error}</div>}

        {isOisyConnected ? (
          <div className="space-y-4">
            <p><strong>Principal:</strong> {oisyPrincipal?.toString()}</p>
            <p><strong>Account ID (legacy):</strong> {oisyAccountIdentifier?.toHex()}</p>

            {allTokensLoaded() ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="p-4 border rounded-lg bg-muted/10">
                  <div className="flex items-center gap-3">
                    <img src={ICPLogo} alt="ICP" className="h-6 w-6" />
                    <p><strong>ICP:</strong> {formatAmount(oisyIcpBalance!, icpMetadata!.decimals)}</p>
                  </div>
                  <Button className="mt-2" onClick={transferIcp} disabled={!isBalanceSufficient(oisyIcpBalance!, icpMetadata!)}>
                    Transfer ICP
                  </Button>
                  <p className="text-sm text-muted-foreground mt-1">Transfers 1 ICP to your own OISY principal.</p>
                </div>

                <div className="p-4 border rounded-lg bg-muted/10">
                  <div className="flex items-center gap-3">
                    <img src={USDCLogo} alt="ckUSDC" className="h-6 w-6" />
                    <p><strong>ckUSDC:</strong> {formatAmount(oisyCkUsdcBalance!, ckUsdcMetadata!.decimals)}</p>
                  </div>
                  <Button className="mt-2" onClick={transferCkUsdc} disabled={!isBalanceSufficient(oisyCkUsdcBalance!, ckUsdcMetadata!)}>
                    Transfer ckUSDC
                  </Button>
                  <p className="text-sm text-muted-foreground mt-1">Transfers 1 ckUSDC to your own OISY principal.</p>
                </div>
              </div>
            ) : (
              <p>Loading balances...</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center text-center mt-16 max-w-xl mx-auto space-y-6">
            <p className="text-lg">This is a demo application to showcase how to connect to the <strong>OISY Wallet</strong>, fetch balances and perform token transfers using the ICRC-1 standard.</p>
          </div>
        )}

        <div className="mt-16 border-t pt-6 text-sm text-muted-foreground">
          <p className="mb-2 font-semibold">References</p>
          <ul className="space-y-1 list-disc list-inside">
            <li><a href="https://oisy.com" className="text-blue-600 hover:underline" target="_blank">OISY Wallet</a></li>
            <li><a href="https://github.com/dfinity/wg-identity-authentication/blob/main/topics/signer_standards_overview.md" className="text-blue-600 hover:underline" target="_blank">Signer Standards</a></li>
            <li><a href="https://github.com/dfinity/ICRC-1/tree/main/standards/ICRC-1" className="text-blue-600 hover:underline" target="_blank">ICRC-1 Token Standard</a></li>
            <li><a href="https://internetcomputer.org/docs/defi/token-ledgers/usage/icrc1_ledger_usage#from-a-web-application" className="text-blue-600 hover:underline" target="_blank">Using ICRC-1 from a Web App</a></li>
            <li><a href="https://internetcomputer.org/docs/defi/token-standards" className="text-blue-600 hover:underline" target="_blank">Token Standards on ICP</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
