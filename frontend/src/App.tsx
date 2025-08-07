import { useEffect, useState } from 'react';
import { Moon, Sun, ExternalLink, Copy, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import ICPLogo from './assets/icp.svg';
import USDCLogo from './assets/usdc.svg';
import OISYLogo from './assets/oisy.svg';
import { useOisyWallet } from './hooks/useOisyWallet';

export default function App() {
  const {
    connect,
    disconnect,
    isConnected,
    principal,
    accountIdentifier,
    isLoading,
    icpBalance,
    ckUsdcBalance,
    icpMetadata,
    ckUsdcMetadata,
    transferIcp,
    transferCkUsdc,
  } = useOisyWallet();

  const [darkMode, setDarkMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<React.ReactNode | null>(null);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => setSuccess('Copied to clipboard'))
      .catch(() => setError('Failed to copy'));
  };

  const handleTransfer = async (token: 'ICP' | 'ckUSDC') => {
    const result = token === 'ICP' ? await transferIcp() : await transferCkUsdc();

    if (result.success && result.blockIndex !== undefined) {
      const url =
        token === 'ICP'
          ? `https://dashboard.internetcomputer.org/transaction/${result.blockIndex}`
          : `https://dashboard.internetcomputer.org/ethereum/xevnm-gaaaa-aaaar-qafnq-cai/transaction/${result.blockIndex}`;

      setSuccess(
        <span>
          {token} transfer successful.{' '}
          <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
            View on Dashboard
          </a>
        </span>
      );
    } else {
      setError(result.message);
    }
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-900'} px-4 sm:px-6 lg:px-8 py-6`}>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <img src={OISYLogo} alt="OISY" className="w-10 h-10" />
            <h1 className="text-xl font-semibold">OISY Signer Demo</h1>
          </div>
          <div className="flex items-center gap-4">
            <Switch checked={darkMode} onCheckedChange={setDarkMode} />
            {darkMode ? <Moon size={18} /> : <Sun size={18} />}
            <Button onClick={isConnected ? disconnect : connect}>
              {isConnected ? 'Disconnect' : 'Connect'}
            </Button>
          </div>
        </header>

        {/* Disconnected Intro */}
        {!isConnected && (
          <div className="space-y-4 text-sm sm:text-base max-w-2xl">
            <p>
              This example demonstrates how to interact with the <strong>OISY Wallet</strong> using the <strong>Signer Standard</strong> and <strong>ICRC-1</strong> tokens.
            </p>
            <p>
              After connecting your wallet, you’ll be able to view your balances for <strong>ICP</strong> and <strong>ckUSDC</strong> and trigger a test transfer of 1 token to your own principal.
            </p>
            <p>
              This app is purely for demonstration purposes and does not store any user data.
            </p>
            <p>
              Click <strong>Connect</strong> at the top right to begin, or explore the references below to learn more.
            </p>
          </div>
        )}

        {/* Wallet Info & Token Cards */}
        {isConnected && (
          <div className="space-y-6">
            <div className="space-y-1 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold whitespace-nowrap">Principal:</span>
                <span className="break-all">{principal?.toString()}</span>
                <button
                  onClick={() => copyToClipboard(principal!.toString())}
                  className="text-muted-foreground hover:text-zinc-900 dark:hover:text-white transition"
                  title="Copy to clipboard"
                >
                  <Copy size={14} />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold whitespace-nowrap">AccountIdentifier:</span>
                <span className="break-all">{accountIdentifier?.toHex()}</span>
                <button
                  onClick={() => copyToClipboard(accountIdentifier!.toHex())}
                  className="text-muted-foreground hover:text-zinc-900 dark:hover:text-white transition"
                  title="Copy to clipboard"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-10 text-muted-foreground">
                <div className="flex items-center gap-3 text-base">
                  <Loader2 className="animate-spin" size={20} />
                  Loading token balances...
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* ICP Card */}
                <div className="p-4 border rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <img src={ICPLogo} alt="ICP" className="w-5 h-5" />
                    <span>ICP</span>
                    <a href={`https://dashboard.internetcomputer.org/account/${accountIdentifier?.toHex()}`} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                      <ExternalLink size={14} />
                    </a>
                  </div>
                  <div className="text-sm">
                    Balance: {icpBalance && icpMetadata ? (Number(icpBalance) / 10 ** icpMetadata.decimals) : '...'}
                  </div>
                  <Button onClick={() => handleTransfer('ICP')} disabled={isLoading}>Transfer ICP</Button>
                  <p className="text-xs text-muted-foreground">
                    Transfers 1 ICP to your own OISY principal for testing.
                  </p>
                </div>

                {/* ckUSDC Card */}
                <div className="p-4 border rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <img src={USDCLogo} alt="ckUSDC" className="w-5 h-5" />
                    <span>ckUSDC</span>
                    <a href={`https://dashboard.internetcomputer.org/ethereum/xevnm-gaaaa-aaaar-qafnq-cai/account/${principal?.toString()}`} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                      <ExternalLink size={14} />
                    </a>
                  </div>
                  <div className="text-sm">
                    Balance: {ckUsdcBalance && ckUsdcMetadata ? (Number(ckUsdcBalance) / 10 ** ckUsdcMetadata.decimals) : '...'}
                  </div>
                  <Button onClick={() => handleTransfer('ckUSDC')} disabled={isLoading}>Transfer ckUSDC</Button>
                  <p className="text-xs text-muted-foreground">
                    Transfers 1 ckUSDC to your own OISY principal for testing.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Toasts */}
        {(isLoading || error || success) && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-[90%] sm:w-auto max-w-xl">
            {success && (
              <div className="bg-green-500 text-white px-4 py-2 rounded flex items-start justify-between gap-4 shadow-md">
                <div className="text-sm">{success}</div>
                <button onClick={() => setSuccess(null)}>
                  <X size={16} />
                </button>
              </div>
            )}

            {error && (
              <div className="bg-red-500 text-white px-4 py-2 rounded flex items-start justify-between gap-4 shadow-md mt-2">
                <div className="text-sm">{error}</div>
                <button onClick={() => setError(null)}>
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <footer className="pt-10 text-sm border-t mt-10 space-y-2 text-muted-foreground">
          <p>References:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <a className="text-blue-600 underline inline-flex items-center gap-1" href="https://oisy.com" target="_blank" rel="noreferrer">
                OISY Wallet <ExternalLink size={14} />
              </a>
            </li>
            <li>
              <a className="text-blue-600 underline inline-flex items-center gap-1" href="https://github.com/dfinity/wg-identity-authentication/blob/main/topics/signer_standards_overview.md" target="_blank" rel="noreferrer">
                Signer Standards <ExternalLink size={14} />
              </a>
            </li>
            <li>
              <a className="text-blue-600 underline inline-flex items-center gap-1" href="https://github.com/dfinity/ICRC-1/tree/main/standards/ICRC-1" target="_blank" rel="noreferrer">
                ICRC-1 Token Standard <ExternalLink size={14} />
              </a>
            </li>
            <li>
              <a className="text-blue-600 underline inline-flex items-center gap-1" href="https://internetcomputer.org/docs/defi/token-ledgers/usage/icrc1_ledger_usage#from-a-web-application" target="_blank" rel="noreferrer">
                Using ICRC-1 Ledger <ExternalLink size={14} />
              </a>
            </li>
            <li>
              <a className="text-blue-600 underline inline-flex items-center gap-1" href="https://internetcomputer.org/docs/defi/token-standards" target="_blank" rel="noreferrer">
                Token Standards on ICP <ExternalLink size={14} />
              </a>
            </li>
          </ul>
        </footer>
      </div>
    </div>
  );
}
