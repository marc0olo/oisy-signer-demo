export const cn = (...classes: (string | undefined | null | false)[]) => {
  return classes.filter(Boolean).join(' ');
};

export const toBaseUnits = (amount: number, decimals: number) => {
  return BigInt(Math.round(amount * 10 ** decimals));
};

export const toMainUnit = (amount: bigint, decimals: number) => {
  return Number(amount) / 10 ** decimals;
};
