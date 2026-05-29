export const RYP_MINT_ADDRESS = "CFPzKkPYqpyfNJp3WDB4dykMemfhwYrV9cgNUy7nsoPD";
export const RYP_DECIMALS = 6;
export const RYP_CONFIRMED_SUPPLY = "49,999,999.429327";

export function shortAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

