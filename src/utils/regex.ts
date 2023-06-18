export const isValidCollectionTicker = (ticker: string): boolean => {
  return /^[A-Z0-9]{3,10}-[a-z0-9]{6}$/.test(ticker);
};

export const isValidNftIdentifier = (identifier: string): boolean => {
  return /^[A-Za-z0-9]{3,10}-[A-Za-z0-9]{6}-[A-Za-z0-9]{2,5}(?:-\d+)?$/.test(
    identifier
  );
};
