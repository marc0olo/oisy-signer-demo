import { useState, useEffect } from 'react'
import './App.css'
import { PostMessageTransport } from "@slide-computer/signer-web";
import { Signer } from "@slide-computer/signer";
import { SignerAgent } from "@slide-computer/signer-agent";
import { HttpAgent } from "@dfinity/agent"
import { AccountIdentifier } from '@dfinity/ledger-icp';
import { decodeIcrcAccount, IcrcLedgerCanister, mapTokenMetadata, type IcrcAccount, type IcrcTokenMetadata } from '@dfinity/ledger-icrc';
import { Principal } from '@dfinity/principal';
import BigNumber from 'bignumber.js';

function App() {

  const TRANSFER_AMOUNT: number = 1;

  const [anonymousAgent, setAnonymousAgent] = useState<HttpAgent | null>(null);
  const [oisySignerAgent, setOisySignerAgent] = useState<SignerAgent | null>(null);
  const [isOisyConnected, setOisyConnected] = useState<boolean>(false);
  const [oisyIcpLedgerAgent, setOisyIcpLedgerAgent] = useState<IcrcLedgerCanister | null>(null);
  const [oisyCkUsdcLedgerAgent, setOisyCkUsdcLedgerAgent] = useState<IcrcLedgerCanister | null>(null);
  const [oisyPrincipal, setOisyPrincipal] = useState<Principal | null>(null);
  const [oisyAccountIdentifier, setOisyAccountIdentifier] = useState<AccountIdentifier | null>(null);
  const [icpMetadata, setIcpMetadata] = useState<IcrcTokenMetadata | undefined>(undefined);
  const [oisyIcpBalance, setOisyIcpBalance] = useState<bigint | null >(null);
  const [oisyCkUsdcBalance, setOisyCkUsdcBalance] = useState<bigint | null >(null);
  const [ckUsdcMetadata, setCkUsdcMetadata] = useState<IcrcTokenMetadata | undefined>(undefined);

  const oisyTransport = new PostMessageTransport({
    url: 'https://oisy.com/sign'
  });
  const oisySigner = new Signer({transport: oisyTransport});

  // the oisyIcpLedgerAgent and oisyCkUsdcLedgerAgent are initialized to call one of the following canister functions:
  // "icrc1_transfer", "icrc2_approve", "icrc2_transfer_from"
  useEffect(() => {
    if (oisySignerAgent && !oisyIcpLedgerAgent) {
      const oisyIcpLedgerAgent = IcrcLedgerCanister.create({
        agent: oisySignerAgent,
        canisterId: Principal.fromText('ryjl3-tyaaa-aaaaa-aaaba-cai'), // ICP ledger
      });
      setOisyIcpLedgerAgent(oisyIcpLedgerAgent);
    };
    if (oisySignerAgent && !oisyCkUsdcLedgerAgent) {
      const oisyCkUsdcLedgerAgent = IcrcLedgerCanister.create({
        agent: oisySignerAgent,
        canisterId: Principal.fromText('xevnm-gaaaa-aaaar-qafnq-cai'), // ckUSDC ledger
      });
      setOisyCkUsdcLedgerAgent(oisyCkUsdcLedgerAgent);
    };
  }, [oisySignerAgent, oisyIcpLedgerAgent, oisyCkUsdcLedgerAgent]);


  useEffect(() => {
    const fetchTokenData = async () => {
      if(anonymousAgent && oisyPrincipal) {
        const anonIcpLedgerAgent = createAnonIcrcLedgerAgent(anonymousAgent, 'ryjl3-tyaaa-aaaaa-aaaba-cai'); // ICP ledger
        const anonCkUsdcLedgerAgent = createAnonIcrcLedgerAgent(anonymousAgent, 'xevnm-gaaaa-aaaar-qafnq-cai'); // ckUSDC ledger
        // we need to perform this call with the anonymous agent, using the oisy signer agent would fail
        // the oisy signer only supports calling following canister functions: "icrc1_transfer", "icrc2_approve", "icrc2_transfer_from"
        try {
          setIcpMetadata(mapTokenMetadata(await anonIcpLedgerAgent.metadata({certified: true})));
          setCkUsdcMetadata(mapTokenMetadata(await anonCkUsdcLedgerAgent.metadata({certified: true})));
          setOisyIcpBalance(await anonIcpLedgerAgent.balance({ owner: oisyPrincipal! }));
          setOisyCkUsdcBalance(await anonCkUsdcLedgerAgent.balance({ owner: oisyPrincipal! }));
        } catch (error) {
          console.log(error);
        }
      }
    }
    fetchTokenData();
  }, [anonymousAgent, oisyPrincipal]);

  const connect = async () => {
    const accounts = await oisySigner.accounts();
    // we use the main principal (owner) without subaccount here because we know that no subaccount is provided by OISY
    const icrcAccount: IcrcAccount = decodeIcrcAccount(accounts[0].owner.toString());
    setOisyPrincipal(icrcAccount.owner);
    setOisyConnected(true);
    // note:
    //    the Principal + Subaccount representation of the signer lib currently cannot be directly passed to AccountIdentifier.fromPrincipal
    //    AccountIdentifier is typically only needed to transfer ICP to/from exchanges
    //    IcrcAccount is the recommended way of dealing with accounts as it is standardized and more transparent
    //      e.g. there is now way to resolve a Subaccount when dealing with the AccountIdentifier representation
    const legacyAccountIdentifier = AccountIdentifier.fromPrincipal({principal: icrcAccount.owner});
    // the Hex representation is actually the value being used for that
    setOisyAccountIdentifier(legacyAccountIdentifier);
    // the default agent is used to perform query calls to canisters using the anonymous identity
    const anonymousAgent = await HttpAgent.create({
      host: 'https://ic0.app'
    });
    // init oisy signer agent which is required to call canisters
    const signerAgent = await SignerAgent.create({
        agent: anonymousAgent,
        signer: oisySigner,
        account: icrcAccount.owner
    });
    setAnonymousAgent(anonymousAgent);
    setOisySignerAgent(signerAgent);
  };

  const disconnect = async () => {
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
  };

  const createAnonIcrcLedgerAgent = (anonymousAgent: HttpAgent, canisterId: string) => {
    return IcrcLedgerCanister.create({
      agent: anonymousAgent,
      canisterId: Principal.fromText(canisterId),
    });
  };

  const formatAmount = (rawNumber: bigint, decimals: number): string => {
    return new BigNumber(rawNumber).dividedBy(10 ** decimals).toString();
  };

  const isBalanceSufficient = (balance: bigint, metadata: IcrcTokenMetadata) => {
    // for a custom transfer amount we would pass as param to this function
    const factor = new BigNumber(10).pow(metadata.decimals);
    const amountInBaseUnits = new BigNumber(TRANSFER_AMOUNT).multipliedBy(factor);
    const feeInBaseUnits = new BigNumber(metadata.fee); 
    const totalRequired = amountInBaseUnits.plus(feeInBaseUnits);

    console.log(`${metadata.symbol} balance: ${balance}`);
    console.log(`${metadata.symbol} required: ${totalRequired.toFixed()}`);

    // Convert bigint balance to BigNumber safely
    return new BigNumber(balance.toString()).gte(totalRequired);
  }

  // utility function to calculate the base units needed for a transfer
  const toBaseUnits = (amount: number, decimals: number) => {
    const factor = 10 ** decimals;
    return BigInt(Math.round(amount * factor));
  }

  // before displaying the balances and the transfer buttons, we want to make sure all token data is loaded
  const allTokensLoaded = () => {
    return icpMetadata && ckUsdcMetadata && oisyIcpBalance && oisyCkUsdcBalance;
  }

  // will transfer ICP from the OISY principal to itself
  const transferIcp = () => {
    oisyIcpLedgerAgent?.transfer({
      to: { owner: oisyPrincipal!, subaccount: []},
      amount: toBaseUnits(TRANSFER_AMOUNT, icpMetadata!.decimals)
    }).catch(error => {
      alert(error);
    });
  };

  // will transfer 1 ckUSDC from the OISY principal to itself
  const transferCkUsdc = () => {
    oisyCkUsdcLedgerAgent?.transfer({
      to: { owner: oisyPrincipal!, subaccount: []},
      amount: toBaseUnits(TRANSFER_AMOUNT, ckUsdcMetadata!.decimals)
    }).catch(error => {
      alert(error);
    });
  };

  return (
    <>
      <div>
        <a href="https://oisy.com" target="_blank">
          <svg width="100" height="100" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg"><g style={{"color": "#06f"}}><circle cx="22" cy="22" r="22" fill="currentColor"></circle></g><path fillRule="evenodd" clipRule="evenodd" d="M24.412 33.4193L23.8827 35.7603C23.8037 36.1099 23.4693 36.3405 23.1152 36.2858C22.308 36.161 21.49 36.0177 20.6637 35.8594C20.2842 35.7867 20.0423 35.4133 20.1275 35.0365L20.6067 32.917C20.2711 32.8513 19.9334 32.7802 19.594 32.7042C19.288 32.6344 18.985 32.5615 18.6854 32.4855L18.2064 34.6044C18.1212 34.981 17.7426 35.214 17.3689 35.1168C16.5548 34.905 15.7547 34.6836 14.9723 34.4504C14.6284 34.3479 14.4251 33.9955 14.5043 33.6455L15.0308 31.3164C9.82695 29.2297 6.54161 25.683 7.93603 19.6262L8.27156 18.1421C9.62094 12.0626 14.1109 10.2811 19.7056 10.6393L20.2318 8.31177C20.3109 7.96173 20.646 7.73105 21.0006 7.78645C21.8072 7.91249 22.6247 8.05683 23.4507 8.21592C23.8299 8.28895 24.0714 8.66213 23.9863 9.03875L23.5073 11.1575C23.8104 11.2179 24.1153 11.2824 24.4215 11.3511C24.7609 11.4278 25.0965 11.5083 25.4277 11.5927L25.9065 9.4751C25.9917 9.09826 26.3707 8.86528 26.7445 8.96289C27.5586 9.17544 28.3586 9.39788 29.141 9.63241C29.4843 9.73534 29.6869 10.0874 29.6079 10.437L29.0801 12.7717C34.2161 14.858 37.4261 18.402 36.0643 24.4256L35.7288 25.9097C34.3909 31.9376 29.9492 33.7421 24.412 33.4193ZM31.9629 24.7039L32.1517 23.8687C33.4814 18.3434 29.0601 16.2797 23.6094 14.9676C18.0988 13.8015 13.2196 13.7626 12.0432 19.3226L11.8544 20.1578C10.5189 25.7084 14.9403 27.7721 20.4165 29.09C25.9016 30.2503 30.7807 30.2893 31.9629 24.7039Z" fill="white"></path></svg>
        </a>
      </div>
      <h1>OISY Wallet Connect</h1>
      {isOisyConnected ? (
        <div>
          <button onClick={() => disconnect()}>
            Disconnect
          </button>
          <p>
            Principal: {oisyPrincipal ? oisyPrincipal.toString() : 'loading ...'}
          </p>
          <p>
            AccountIdentifier (legacy for exchanges): {oisyAccountIdentifier ? oisyAccountIdentifier.toHex() : 'loading ...'}
          </p>
          {allTokensLoaded() ? (
            <>
              <div>
                <p>
                  {/* we know that metadata and balances are available */}
                  ICP Balance: {formatAmount(oisyIcpBalance!, icpMetadata!.decimals)}
                </p>
                <button onClick={() => transferIcp()} disabled={!isBalanceSufficient(oisyIcpBalance!, icpMetadata!)}>
                  Transfer ICP
                </button>
              </div>
              <div>
                <p>
                  ckUSDC Balance: {formatAmount(oisyCkUsdcBalance!, ckUsdcMetadata!.decimals)}
                </p>
                <button onClick={() => transferCkUsdc()} disabled={!isBalanceSufficient(oisyCkUsdcBalance!, ckUsdcMetadata!)}>
                  Transfer ckUSDC
                </button>
              </div>
            </>
          ) : (
            <div>
              Loading balances ...
            </div>
          )}
        </div>
      ) : (
        <div>
          <button onClick={() => connect()}>
            Connect
          </button>
        </div>
      )}
    </>
  )
}

export default App
